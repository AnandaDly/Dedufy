class ThesisExaminerApp {
  constructor() {
    // --- Konfigurasi Model & Aplikasi ---
    this.FAST_MODEL = "llama-3.1-8b-instant";
    this.POWERFUL_MODEL = "llama-3.3-70b-versatile";
    this.MAX_FILE_SIZE_MB = 5;
    this.MAX_CACHE_SIZE = 50;
    // --- PERBAIKAN #6: Tambahkan batas maksimal untuk riwayat chat ---
    this.MAX_HISTORY_LENGTH = 50;
    this.SESSION_STORAGE_KEY = "thesisExaminerSession";

    // --- Manajemen State ---
    this.state = {
      sessionId: null, // ID unik untuk setiap sesi file
      sessionContext: "",
      chatHistory: [],
      sessionActive: false,
      file: null,
      questionsAsked: 0,
      maxQuestions: 10,
      difficulty: "adaptive",
      currentLevel: "medium",
      agentMode: "friendly",
      language: "indonesian",
      scoreHistory: [], // Untuk adaptasi kesulitan berbasis tren
      // Artefak analisis
      structureMap: null,
      textChunks: [],
      chapterAnalyses: null,
      conceptGraph: null,
      strategicWeaknesses: null,
      hybridIndex: {},
      // --- PERBAIKAN #5: Map tetap digunakan, logika LRU diimplementasikan saat akses ---
      queryCache: new Map(),
    };

    // --- Referensi Elemen DOM ---
    this.dom = {
      dropzone: document.getElementById("dropzone"),
      fileInput: document.getElementById("fileInput"),
      filePreview: document.getElementById("file-preview"),
      fileName: document.getElementById("file-name"),
      fileSize: document.getElementById("file-size"),
      removeFileBtn: document.getElementById("remove-file-btn"),
      difficultySelect: document.getElementById("difficultySelect"),
      agentModeSelect: document.getElementById("agentModeSelect"),
      languageSelect: document.getElementById("languageSelect"),
      uploadForm: document.getElementById("upload-form"),
      startBtn: document.getElementById("startBtn"),
      materialSection: document.getElementById("material-section"),
      loadingSpinner: document.getElementById("loading-spinner"),
      chatSection: document.getElementById("chat-section"),
      chatBox: document.getElementById("chatBox"),
      answerInput: document.getElementById("answerInput"),
      sendBtn: document.getElementById("sendBtn"),
      restartBtn: document.getElementById("restartBtn"),
      typingIndicator: document.getElementById("typing-indicator"),
    };

    this.init();
  }

  init() {
    this.handleFileSelect = this.handleFileSelect.bind(this);
    this.handleFileDrop = this.handleFileDrop.bind(this);
    this.removeFile = this.removeFile.bind(this);
    this.startSession = this.startSession.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.restartSession = this.restartSession.bind(this);

    // Setup event listeners...
    this.dom.dropzone.addEventListener("click", () =>
      this.dom.fileInput.click()
    );
    this.dom.fileInput.addEventListener("change", this.handleFileSelect);
    this.dom.dropzone.addEventListener("dragover", this.handleDragOver);
    this.dom.dropzone.addEventListener("dragleave", this.handleDragLeave);
    this.dom.dropzone.addEventListener("drop", this.handleFileDrop);
    this.dom.removeFileBtn.addEventListener("click", this.removeFile);
    this.dom.uploadForm.addEventListener("submit", this.startSession);
    this.dom.sendBtn.addEventListener("click", this.sendMessage);
    this.dom.restartBtn.addEventListener("click", this.restartSession);
    this.dom.languageSelect.addEventListener(
      "change",
      (e) => (this.state.language = e.target.value)
    );
    this.dom.answerInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.loadSessionFromStorage();
  }

  saveSessionToStorage() {
    try {
      const stateToSave = { ...this.state, sessionContext: "" };
      // Ubah Map menjadi array untuk serialisasi JSON
      stateToSave.queryCache = Array.from(this.state.queryCache.entries());
      localStorage.setItem(
        this.SESSION_STORAGE_KEY,
        JSON.stringify(stateToSave)
      );
    } catch (e) {
      console.error("Gagal menyimpan sesi:", e);
    }
  }

  loadSessionFromStorage() {
    try {
      const savedStateJSON = localStorage.getItem(this.SESSION_STORAGE_KEY);
      if (savedStateJSON) {
        const savedState = JSON.parse(savedStateJSON);
        
        // Ubah array cache kembali menjadi Map
        if (Array.isArray(savedState.queryCache)) {
            savedState.queryCache = new Map(savedState.queryCache);
        } else {
            savedState.queryCache = new Map();
        }

        Object.assign(this.state, {
          ...savedState,
          file: null,
          sessionContext: "",
        });

        if (this.state.sessionActive) {
          this.dom.materialSection.classList.add("hidden");
          this.dom.chatSection.classList.remove("hidden");
          this.dom.loadingSpinner.classList.add("hidden");

          this.renderMessage(
            "ai",
            "Sesi sebelumnya berhasil dipulihkan. Silakan unggah kembali file yang sama untuk melanjutkan."
          );
          this.dom.filePreview.classList.add("hidden");
          this.dom.dropzone.classList.remove("hidden");

          this.state.chatHistory.forEach((msg) => {
            if (msg.role === "user") {
              this.renderMessage("user", msg.content);
            } else if (msg.role === "assistant") {
              const parsedContent = this.safeJsonParse(msg.content);
              if (parsedContent?.feedback)
                this.renderMessage(
                  "ai",
                  `*Feedback: ${parsedContent.feedback}*`
                );
              if (parsedContent?.next_question)
                this.renderMessage("ai", parsedContent.next_question);
            }
          });

          this.setInputDisabled(true);
        }
      }
    } catch (e) {
      console.error("Gagal memuat sesi:", e);
      localStorage.removeItem(this.SESSION_STORAGE_KEY);
    }
  }

  renderMessage(role, content) {
    const messageEl = document.createElement("div");
    const isAI = role === "ai";
    const avatar = isAI
      ? `<span class="flex-shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-200">🤖</span>`
      : `<span class="flex-shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-600 text-white">👤</span>`;
    const bubbleClasses = isAI
      ? "bg-gray-200 rounded-lg rounded-tl-none text-sm text-gray-800"
      : "bg-teal-500 rounded-lg rounded-br-none text-sm text-white";
    const layoutClasses = isAI
      ? "flex items-start gap-3"
      : "flex items-start justify-end gap-3";
    messageEl.innerHTML = `<div class="${layoutClasses}">${
      isAI ? avatar : ""
    }<div class="p-3 ${bubbleClasses}">${content.replace(/\n/g, "<br>")}</div>${
      !isAI ? avatar : ""
    }</div>`;
    this.dom.chatBox.insertBefore(messageEl, this.dom.typingIndicator);
    this.dom.chatBox.scrollTop = this.dom.chatBox.scrollHeight;
  }

  showTypingIndicator(show) {
    this.dom.typingIndicator.classList.toggle("hidden", !show);
    if (show) this.dom.chatBox.scrollTop = this.dom.chatBox.scrollHeight;
  }
  setInputDisabled(disabled) {
    this.dom.answerInput.disabled = disabled;
    this.dom.sendBtn.disabled = disabled;
    this.dom.sendBtn.classList.toggle("opacity-50", disabled);
    this.dom.sendBtn.classList.toggle("cursor-not-allowed", disabled);
  }
  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add("border-teal-400", "bg-teal-50");
  }
  handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove("border-teal-400", "bg-teal-50");
  }
  handleFileDrop(e) {
    e.preventDefault();
    this.handleDragLeave({
      preventDefault: () => {},
      currentTarget: this.dom.dropzone,
    });
    if (e.dataTransfer.files.length) this.handleFile(e.dataTransfer.files[0]);
  }
  handleFileSelect(e) {
    if (e.target.files.length) this.handleFile(e.target.files[0]);
  }

  async handleFile(file) {
    if (file.size > this.MAX_FILE_SIZE_MB * 1024 * 1024) {
      this.renderMessage(
        "ai",
        `❌ **Error:** Ukuran file melebihi batas ${this.MAX_FILE_SIZE_MB} MB.`
      );
      this.dom.fileInput.value = "";
      return;
    }

    if (this.state.sessionActive && this.state.sessionId) {
      this.renderMessage("ai", "File diterima. Melanjutkan sesi...");
      this.setInputDisabled(false);
    } else {
      this.restartSession(false);
      // --- PERBAIKAN #7: Gunakan crypto.randomUUID() untuk ID sesi yang unik secara global ---
      this.state.sessionId = crypto.randomUUID();
    }

    this.state.file = file;
    this.dom.fileName.textContent = file.name;
    this.dom.fileSize.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
    this.dom.filePreview.classList.remove("hidden");
    this.dom.dropzone.classList.add("hidden");
    this.dom.startBtn.disabled = false;
    try {
      this.state.sessionContext = await this.readFileContent(file);
    } catch (err) {
      this.renderMessage("ai", `❌ Error membaca file: ${err.message}`);
      this.removeFile();
    }
  }

  removeFile() {
    this.state.file = null;
    this.state.sessionContext = "";
    this.dom.fileInput.value = "";
    this.dom.filePreview.classList.add("hidden");
    this.dom.dropzone.classList.remove("hidden");
    this.dom.startBtn.disabled = true;
    this.restartSession();
  }
  readFileContent(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onerror = () =>
        reject(new DOMException("Problem parsing input file."));
      reader.onload = async () => {
        try {
          const buffer = reader.result;
          if (ext === "txt") resolve(new TextDecoder().decode(buffer));
          else if (ext === "pdf") {
            const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
            let text = "";
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              text += content.items.map((item) => item.str).join(" ") + "\n\n";
            }
            resolve(text);
          } else if (ext === "docx") {
            const result = await mammoth.extractRawText({
              arrayBuffer: buffer,
            });
            resolve(result.value);
          } else
            reject(
              new Error("Unsupported format. Please use .txt, .pdf, or .docx.")
            );
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }
  
  async callGroqWithRetry(payload, retries = 3, delay = 1000, timeout = 30000) {
    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const responsePromise = fetch("/api/groq-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        const response = await responsePromise;
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status >= 400 && response.status < 500) {
            return {
              error: {
                message:
                  errorData.error?.message || `Error: ${response.status}`,
              },
            };
          }
          throw new Error(`HTTP Error: ${response.status}`);
        }
        return await response.json();
      } catch (err) {
        if (err.name === 'AbortError') {
          console.warn(`Percobaan API gagal karena timeout (${timeout / 1000} detik).`);
          if (i === retries - 1) {
            return {
              error: {
                message: `Permintaan gagal karena timeout setelah ${retries} kali percobaan.`,
              },
            };
          }
        } else if (i === retries - 1) {
            return {
              error: {
                message: `Gagal setelah ${retries} kali percobaan: ${err.message}`,
              },
            };
        }
        
        console.warn(
          `Percobaan API gagal (${i + 1}/${retries}). Mencoba lagi dalam ${
            delay / 1000
          } detik...`
        );
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2;
      }
    }
  }

  safeJsonParse(jsonString) {
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      console.error("Gagal mem-parsing JSON:", jsonString, e);
      return null;
    }
  }

  async semanticChunking(textSample) {
    const prompt = `Your task is to act as a document structure analyzer. Read the provided text and identify the main semantic sections or chapters.
    Return a valid JSON object with a single key "chapters", which is an array of objects. Each object should have a "number" and a "title".
    Example: {"chapters": [{"number": 1, "title": "Introduction"}, {"number": 2, "title": "Literature Review"}]}.
    If you cannot identify clear chapters, return an empty array.`;

    const data = await this.callGroqWithRetry({
      model: this.FAST_MODEL,
      messages: [
        {
          role: "user",
          content: prompt + `\n\nTEXT TO ANALYZE:\n---\n${textSample}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });
    if (data.error)
      throw new Error(`Gagal menganalisis struktur: ${data.error.message}`);

    const content = this.safeJsonParse(data.choices?.[0]?.message?.content);
    if (!content || !Array.isArray(content.chapters)) {
      console.warn(
        "Semantic chunking gagal, menggunakan fallback dokumen penuh."
      );
      return { chapters: [] };
    }
    return content;
  }

  smartChunking(fullText, structure) {
    const chunks = [];
    if (!structure.chapters || structure.chapters.length === 0) {
      return [{ number: 1, title: "Full Document", content: fullText }];
    }
    for (let i = 0; i < structure.chapters.length; i++) {
      const chapter = structure.chapters[i];
      if (!chapter || typeof chapter.number === "undefined") continue;

      const nextChapter = structure.chapters[i + 1];
      // --- PERBAIKAN #8: Regex dibuat lebih fleksibel untuk menangani format judul yang berbeda ---
      // Mencari 'BAB', 'CHAPTER', 'BAGIAN' diikuti oleh angka Arab atau Romawi.
      const pattern = new RegExp(
        `(BAB|CHAPTER|BAGIAN)\\s+(?:${chapter.number}|${toRoman(chapter.number)})[\\s\\.\\n]`,
        "i"
      );
      const match = fullText.match(pattern);

      if (!match) continue;

      const startIndex = match.index;
      let endIndex = fullText.length;
      if (nextChapter && typeof nextChapter.number !== "undefined") {
        const nextPattern = new RegExp(
           `(BAB|CHAPTER|BAGIAN)\\s+(?:${nextChapter.number}|${toRoman(nextChapter.number)})[\\s\\.\\n]`,
          "i"
        );
        const nextMatch = fullText
          .substring(startIndex + match[0].length)
          .match(nextPattern);
        if (nextMatch) {
          endIndex = startIndex + match[0].length + nextMatch.index;
        }
      }
      chunks.push({
        number: chapter.number,
        title: chapter.title || `Chapter ${chapter.number}`,
        content: fullText.substring(startIndex, endIndex),
      });
    }
    // Tambahkan helper function untuk konversi ke angka romawi jika diperlukan
    function toRoman(num) {
        const roman = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1};
        let str = '';
        for (let i of Object.keys(roman)) {
            let q = Math.floor(num / roman[i]);
            num -= q * roman[i];
            str += i.repeat(q);
        }
        return str;
    }

    return chunks;
  }

  async parallelDeepDive(chunks) {
    const analysisPromises = chunks.map((chunk) => {
      const perChapterPrompt = `Analyze this chapter. Extract: main argument, key concepts, methodology, findings, and potential weaknesses. Return a detailed JSON object.`;
      return this.callGroqWithRetry({
        model: this.POWERFUL_MODEL,
        messages: [
          {
            role: "system",
            content: `You are analyzing Chapter ${chunk.number}: ${chunk.title}.`,
          },
          {
            role: "user",
            // --- PERBAIKAN #3: Hapus .substring() untuk mengirim seluruh konten bab ---
            content: `CONTENT:\n---\n${chunk.content}\n---\nINSTRUCTIONS:\n${perChapterPrompt}`,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });
    });
    const results = await Promise.all(analysisPromises);
    return results.map((res, index) => {
      if (res.error)
        throw new Error(
          `Analisis bab ${chunks[index].number} gagal: ${res.error.message}`
        );
      const analysis = this.safeJsonParse(res.choices?.[0]?.message?.content);
      if (!analysis)
        throw new Error(
          `Respons analisis tidak valid untuk bab ${chunks[index].number}.`
        );
      return {
        chapter: chunks[index].number,
        title: chunks[index].title,
        analysis: analysis,
      };
    });
  }

  async synthesizeAndStrategize(chapterAnalyses) {
    const prompt = `TASK 1: SYNTHESIS: Build a concept graph, identify cross-chapter themes. TASK 2: STRATEGY: Identify methodological gaps, weak evidence, and alternative perspectives. Return a single valid JSON object with keys "conceptGraph" and "strategicWeaknesses".`;
    const data = await this.callGroqWithRetry({
      model: this.POWERFUL_MODEL,
      messages: [
        {
          role: "user",
          content: `ANALYSES: --- ${JSON.stringify(
            chapterAnalyses,
            null,
            2
          )} --- ${prompt}`,
        },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });
    if (data.error) throw new Error(`Gagal sintesis: ${data.error.message}`);
    const content = this.safeJsonParse(data.choices?.[0]?.message?.content);
    if (!content) throw new Error("Respons sintesis tidak valid dari AI.");
    return content;
  }

  buildHybridIndex(chapterAnalyses) {
    const index = { keywordSearch: new Map() };
    if (!Array.isArray(chapterAnalyses)) return index;

    chapterAnalyses.forEach((item) => {
      if (!item?.analysis) return;
      const concepts = item.analysis.key_concepts;
      if (Array.isArray(concepts)) {
        concepts.forEach((concept) => {
          const term = (
            typeof concept === "string" ? concept : concept?.term
          )?.toLowerCase();
          if (term) index.keywordSearch.set(term, item.chapter);
        });
      }
    });
    return index;
  }

  async startSession(e) {
    e.preventDefault();
    if (!this.state.sessionContext) {
      alert("Silakan unggah file materi terlebih dahulu!");
      return;
    }

    this.state.difficulty = this.dom.difficultySelect.value;
    this.state.agentMode = this.dom.agentModeSelect.value;
    this.state.language = this.dom.languageSelect.value;
    this.state.currentLevel =
      this.state.difficulty === "adaptive" ? "medium" : this.state.difficulty;

    this.state.sessionActive = true;
    this.dom.materialSection.classList.add("hidden");
    this.dom.loadingSpinner.classList.remove("hidden");

    try {
      this.renderMessage("ai", "Memulai analisis... [Langkah 1/5]");
      this.state.structureMap = await this.semanticChunking(
        this.state.sessionContext.substring(0, 10000)
      );
      this.renderMessage(
        "ai",
        `Struktur ditemukan (${
          this.state.structureMap?.chapters?.length || 0
        } bab). Memotong teks... [Langkah 2/5]`
      );
      this.state.textChunks = this.smartChunking(
        this.state.sessionContext,
        this.state.structureMap
      );
      this.renderMessage(
        "ai",
        `Menganalisis ${this.state.textChunks.length} bab secara paralel... [Langkah 3/5]`
      );
      this.state.chapterAnalyses = await this.parallelDeepDive(
        this.state.textChunks
      );
      this.renderMessage(
        "ai",
        "Analisis bab selesai. Mensintesis & menyusun strategi... [Langkah 4/5]"
      );
      const combinedAnalysis = await this.synthesizeAndStrategize(
        this.state.chapterAnalyses
      );
      this.state.conceptGraph = combinedAnalysis.conceptGraph;
      this.state.strategicWeaknesses = combinedAnalysis.strategicWeaknesses;
      this.renderMessage("ai", "Membangun indeks pencarian... [Langkah 5/5]");
      this.state.hybridIndex = this.buildHybridIndex(
        this.state.chapterAnalyses
      );

      this.dom.loadingSpinner.classList.add("hidden");
      this.dom.chatSection.classList.remove("hidden");
      this.setInputDisabled(false);
      this.renderMessage(
        "ai",
        "Analisis selesai. Sistem siap. Saya akan memulai dengan pertanyaan pertama."
      );
      const firstQuestionPrompt = this.buildExaminerPrompt();
      const aiResult = await this.callGroqWithRetry({
        model: this.POWERFUL_MODEL,
        messages: [{ role: "user", content: firstQuestionPrompt }],
        response_format: { type: "json_object" },
      });
      if (aiResult.error) throw new Error(aiResult.error.message);
      const firstQuestion = this.safeJsonParse(
        aiResult.choices?.[0]?.message?.content
      );

      if (firstQuestion?.next_question) {
        this.renderMessage("ai", firstQuestion.next_question);
        
        const assistantMessage = { role: "assistant", content: JSON.stringify(firstQuestion) };
        this.state.chatHistory.push(assistantMessage);
        // --- PERBAIKAN #6: Pangkas riwayat chat jika melebihi batas ---
        if (this.state.chatHistory.length > this.MAX_HISTORY_LENGTH) {
            this.state.chatHistory.shift();
        }

        this.state.questionsAsked++;
      }
      this.saveSessionToStorage();
    } catch (error) {
      console.error("Setup Phase Failed:", error);
      this.renderMessage(
        "ai",
        `❌ **Error Fatal:** ${error.message}. Sesi tidak dapat dimulai. Silakan mulai ulang.`
      );
      this.dom.loadingSpinner.classList.add("hidden");
      this.setInputDisabled(true);
    }
  }

  async retrieveContent(query) {
    const cacheKey = query.toLowerCase();
    // --- PERBAIKAN #5: Implementasi logika LRU pada cache hit ---
    if (this.state.queryCache.has(cacheKey)) {
      const value = this.state.queryCache.get(cacheKey);
      // Hapus dan set ulang untuk memindahkannya ke akhir (menjadi yang terbaru)
      this.state.queryCache.delete(cacheKey);
      this.state.queryCache.set(cacheKey, value);
      return value;
    }

    const queryWords = query.toLowerCase().split(/\s+/);
    for (const word of queryWords) {
      if (this.state.hybridIndex.keywordSearch.has(word)) {
        const chapterNum = this.state.hybridIndex.keywordSearch.get(word);
        const analysis = this.state.chapterAnalyses.find(
          (c) => c.chapter === chapterNum
        );
        const result = {
          source: `ch${chapterNum}`,
          content: analysis,
          type: "Index Hit",
        };

        // --- PERBAIKAN #5: Implementasi logika penggusuran LRU/FIFO ---
        // Dengan Map, key pertama adalah yang paling lama dimasukkan (atau diakses)
        if (this.state.queryCache.size >= this.MAX_CACHE_SIZE) {
          const oldestKey = this.state.queryCache.keys().next().value;
          this.state.queryCache.delete(oldestKey);
        }
        this.state.queryCache.set(cacheKey, result);
        return result;
      }
    }

    console.log("QUERY: Index Miss. Triggering AI Semantic Fallback.");
    const prompt = `You are a semantic router. Your task is to find the most relevant chapters to answer the user's query based on the document's structure.
      Return a valid JSON object with a single key "relevant_chapters", which is an array of chapter numbers.
      Example: {"relevant_chapters": [2, 4]}.`;

    const data = await this.callGroqWithRetry({
      model: this.FAST_MODEL,
      messages: [
        { role: "system", content: "You are a semantic router." },
        {
          role: "user",
          content: `DOCUMENT STRUCTURE: ${JSON.stringify(
            this.state.structureMap
          )}\n\nUSER QUERY: "${query}"\n\n${prompt}`,
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    if (data.error) {
      console.error("AI Semantic Fallback failed:", data.error.message);
      return { source: "error", content: [], type: "AI Fallback Failed" };
    }

    const parsed = this.safeJsonParse(data.choices?.[0]?.message?.content);
    const relevantChapters = parsed?.relevant_chapters || [];
    const analyses = this.state.chapterAnalyses.filter((c) =>
      relevantChapters.includes(c.chapter)
    );
    const result = {
      source: `ch${relevantChapters.join(",")}`,
      content: analyses,
      type: "AI Fallback",
    };

    if (this.state.queryCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.state.queryCache.keys().next().value;
      this.state.queryCache.delete(oldestKey);
    }
    this.state.queryCache.set(cacheKey, result);
    return result;
  }

  buildExaminerPrompt(context = null) {
    const { language, agentMode, difficulty, currentLevel } = this.state;

    const languageInstruction =
      language === "indonesian"
        ? "ATURAN KETAT: Anda HARUS menggunakan Bahasa Indonesia untuk semua pertanyaan dan umpan balik."
        : "STRICT RULE: You MUST use English for all questions and feedback.";

    const difficultyInstructions = {
      easy: "Formulasikan pertanyaan yang langsung dan faktual berdasarkan konteks.",
      medium:
        "Formulasikan pertanyaan yang meminta pengguna menghubungkan konsep atau menjelaskan 'mengapa' di balik sebuah fakta dari konteks.",
      hard: "Formulasikan pertanyaan menantang yang mengkritik asumsi, menanyakan implikasi, atau menyajikan perspektif alternatif berdasarkan konteks.",
    };

    const agentModeInstructions = {
      strict:
        "Anda adalah Penguji Tesis 'Strict Teacher'. Anda bersikap kritis, langsung pada intinya, dan memberikan kritik yang tajam namun membangun. Harapkan jawaban yang presisi dan jangan ragu untuk menantang klaim pengguna.",
      friendly:
        "Anda adalah Penguji Tesis 'Friendly Tutor'. Anda bersikap suportif, positif, dan membimbing. Ajukan pertanyaan yang mendalam dengan nada yang memotivasi. Berikan pujian untuk jawaban yang baik sebelum memberikan kritik.",
      exam: "Anda adalah 'Exam Simulator'. Anda bersikap formal, netral, dan objektif. Ajukan pertanyaan satu per satu TANPA memberikan umpan balik (kunci 'feedback' dalam JSON HARUS string kosong). Tujuannya adalah untuk menguji, bukan mengajar.",
    };

    const currentDifficulty =
      difficulty === "adaptive" ? currentLevel : difficulty;
    const difficultyInstruction = difficultyInstructions[currentDifficulty];
    const agentModeInstruction = agentModeInstructions[agentMode];

    let prompt = `You are a Thesis Examiner.
    ---
    **PERATURAN ANDA**
    1. **Kepribadian:** ${agentModeInstruction}
    2. **Bahasa:** ${languageInstruction}
    3. **Tingkat Kesulitan:** ${difficultyInstruction}
    ---
    `;

    if (context) {
      prompt += `A user has provided an answer. I have retrieved relevant context from their thesis to help you evaluate it.
        RICH CONTEXT: --- ${JSON.stringify(context, null, 2)} ---
        CHAT HISTORY: --- ${JSON.stringify(
          this.state.chatHistory.slice(-4)
        )} ---
        Based on ALL the information above, evaluate the user's last answer and formulate your next question.
        Return a single valid JSON object: {"feedback": "...", "next_question": "...", "score": 0-100}`;
    } else {
      prompt += `Based on the analysis, ask the very first question to the student.
        ANALYSIS: ${JSON.stringify(
          this.state.strategicWeaknesses || this.state.conceptGraph,
          null,
          2
        )}
        Return a single valid JSON object: {"feedback": "", "next_question": "...", "score": 0}`;
    }
    return prompt;
  }

  adaptDifficulty(score) {
    if (this.state.difficulty !== "adaptive") return;

    this.state.scoreHistory.push(score);
    if (this.state.scoreHistory.length > 5) {
      this.state.scoreHistory.shift();
    }

    const recentScores = this.state.scoreHistory.slice(-3);
    if (recentScores.length < 3) return; // Tunggu sampai ada cukup data

    const averageScore =
      recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

    console.log(
      `Adapting difficulty. Recent scores: [${recentScores.join(
        ", "
      )}], Average: ${averageScore.toFixed(1)}`
    );

    if (averageScore > 85 && this.state.currentLevel !== "hard") {
      this.state.currentLevel =
        this.state.currentLevel === "easy" ? "medium" : "hard";
      console.log(
        `Trend positif. Kesulitan dinaikkan ke: ${this.state.currentLevel}`
      );
    } else if (averageScore < 45 && this.state.currentLevel !== "easy") {
      this.state.currentLevel =
        this.state.currentLevel === "hard" ? "medium" : "easy";
      console.log(
        `Trend negatif. Kesulitan diturunkan ke: ${this.state.currentLevel}`
      );
    }
  }

  async sendMessage() {
    if (!this.state.sessionActive || this.dom.sendBtn.disabled) return;
    const answer = this.dom.answerInput.value.trim();
    if (!answer) return;

    const userMessage = { role: "user", content: answer };
    this.renderMessage("user", answer);
    this.state.chatHistory.push(userMessage);
    // --- PERBAIKAN #6: Pangkas riwayat chat jika melebihi batas ---
    if (this.state.chatHistory.length > this.MAX_HISTORY_LENGTH) {
        this.state.chatHistory.shift();
    }

    this.dom.answerInput.value = "";
    this.setInputDisabled(true);
    this.showTypingIndicator(true);

    if (this.state.questionsAsked >= this.state.maxQuestions) {
      this.renderMessage(
        "ai",
        "Sesi ujian selesai. Terima kasih atas partisipasi Anda!"
      );
      this.showTypingIndicator(false);
      this.setInputDisabled(false);
      this.state.sessionActive = false;
      return;
    }

    const context = await this.retrieveContent(answer);
    const examinerPrompt = this.buildExaminerPrompt(context);

    const aiResult = await this.callGroqWithRetry({
      model: this.POWERFUL_MODEL,
      messages: [{ role: "user", content: examinerPrompt }],
      response_format: { type: "json_object" },
    });
    if (aiResult.error) {
      this.renderMessage(
        "ai",
        `❌ Maaf, terjadi kesalahan: ${aiResult.error.message}`
      );
      this.showTypingIndicator(false);
      this.setInputDisabled(false);
      return;
    }
    const response = this.safeJsonParse(
      aiResult.choices?.[0]?.message?.content
    );
    if (!response) {
      this.renderMessage(
        "ai",
        `❌ Maaf, saya menerima respons tidak valid dan tidak dapat melanjutkan.`
      );
      this.showTypingIndicator(false);
      this.setInputDisabled(false);
      return;
    }

    this.adaptDifficulty(response.score);
    
    if (this.state.agentMode !== "exam" && response.feedback) {
      this.renderMessage("ai", `*Feedback: ${response.feedback}*`);
    }

    if (response.next_question) {
      this.renderMessage("ai", response.next_question);
      const assistantMessage = { role: "assistant", content: JSON.stringify(response) };
      this.state.chatHistory.push(assistantMessage);
      // --- PERBAIKAN #6: Pangkas riwayat chat jika melebihi batas ---
      if (this.state.chatHistory.length > this.MAX_HISTORY_LENGTH) {
          this.state.chatHistory.shift();
      }

      this.state.questionsAsked++;
    } else {
      this.renderMessage(
        "ai",
        "Saya tidak dapat menghasilkan pertanyaan berikutnya. Sesi mungkin perlu dimulai ulang."
      );
    }
    
    this.saveSessionToStorage();

    this.showTypingIndicator(false);
    this.setInputDisabled(false);
    this.dom.answerInput.focus();
  }

  restartSession(resetUI = true) {
    localStorage.removeItem(this.SESSION_STORAGE_KEY);
    Object.assign(this.state, {
      sessionId: null,
      sessionContext: "",
      chatHistory: [],
      sessionActive: false,
      questionsAsked: 0,
      file: null,
      difficulty: "adaptive",
      currentLevel: "medium",
      agentMode: "friendly",
      language: "indonesian",
      structureMap: null,
      textChunks: [],
      chapterAnalyses: null,
      conceptGraph: null,
      strategicWeaknesses: null,
      hybridIndex: {},
      queryCache: new Map(),
    });
    if (resetUI) {
      this.dom.chatBox.innerHTML = "";
      this.dom.chatBox.appendChild(this.dom.typingIndicator);
      this.dom.materialSection.classList.remove("hidden");
      this.dom.chatSection.classList.add("hidden");
      this.dom.loadingSpinner.classList.add("hidden");
      this.setInputDisabled(false);
      this.dom.difficultySelect.value = "adaptive";
      this.dom.agentModeSelect.value = "friendly";
      this.dom.languageSelect.value = "indonesian";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ThesisExaminerApp();
});
