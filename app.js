// =======================================================================
// AI THESIS EXAMINER - ENHANCED HIERARCHICAL ARCHITECTURE
// Diadopsi dari spesifikasi profesional "Material Analyst Agent Workflows"
// Alur Kerja:
// 1. Pemindaian Struktur Cepat -> 2. Pemotongan Teks Cerdas -> 3. Analisis Mendalam Paralel
// 4. Sintesis Konsep -> 5. Identifikasi Kelemahan -> 6. Pembangunan Indeks Hibrida
// =======================================================================
class ThesisExaminerApp {
  constructor() {
    // --- Konfigurasi Model ---
    // Model cepat untuk tugas-tugas struktural
    this.FAST_MODEL = "llama-3.1-8b-instant";
    // Model kuat untuk analisis mendalam
    this.POWERFUL_MODEL = "llama-3.3-70b-versatile";

    // --- Manajemen State untuk Arsitektur Baru ---
    this.state = {
      // State sesi & UI
      sessionContext: "",
      chatHistory: [],
      sessionActive: false,
      file: null,
      questionsAsked: 0,
      maxQuestions: 10,
      
      // Pengaturan kepribadian agen
      difficulty: "adaptive",
      currentLevel: "medium",
      agentMode: "friendly",
      language: "indonesian",

      // Artefak dari fase penyiapan (setup phase)
      structureMap: null,       // Output dari Langkah 1
      textChunks: [],           // Output dari Langkah 2
      chapterAnalyses: null,    // Output dari Langkah 3
      conceptGraph: null,       // Output dari Langkah 4
      strategicWeaknesses: null,// Output dari Langkah 5
      hybridIndex: {},          // Output dari Langkah 6
      queryCache: new Map(),    // Untuk menyimpan hasil pencarian AI
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

  // --- Metode Inisialisasi dan UI Dasar (Sebagian besar tidak berubah) ---
  init() {
    this.handleFileSelect = this.handleFileSelect.bind(this);
    this.handleFileDrop = this.handleFileDrop.bind(this);
    this.removeFile = this.removeFile.bind(this);
    this.startSession = this.startSession.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.restartSession = this.restartSession.bind(this);
    this.dom.dropzone.addEventListener("click", () => this.dom.fileInput.click());
    this.dom.fileInput.addEventListener("change", this.handleFileSelect);
    this.dom.dropzone.addEventListener("dragover", this.handleDragOver);
    this.dom.dropzone.addEventListener("dragleave", this.handleDragLeave);
    this.dom.dropzone.addEventListener("drop", this.handleFileDrop);
    this.dom.removeFileBtn.addEventListener("click", this.removeFile);
    this.dom.uploadForm.addEventListener("submit", this.startSession);
    this.dom.sendBtn.addEventListener("click", this.sendMessage);
    this.dom.restartBtn.addEventListener("click", this.restartSession);
    this.dom.languageSelect.addEventListener("change", (e) => (this.state.language = e.target.value));
    this.dom.answerInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    });
  }

  renderMessage(role, content) {
    const messageEl = document.createElement("div");
    const isAI = role === "ai";
    const avatar = isAI ? `<span class="flex-shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-200">🤖</span>` : `<span class="flex-shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-600 text-white">👤</span>`;
    const bubbleClasses = isAI ? "bg-gray-200 rounded-lg rounded-tl-none text-sm text-gray-800" : "bg-teal-500 rounded-lg rounded-br-none text-sm text-white";
    const layoutClasses = isAI ? "flex items-start gap-3" : "flex items-start justify-end gap-3";
    messageEl.innerHTML = `<div class="${layoutClasses}">${isAI ? avatar : ""}<div class="p-3 ${bubbleClasses}">${content.replace(/\n/g, "<br>")}</div>${!isAI ? avatar : ""}</div>`;
    this.dom.chatBox.insertBefore(messageEl, this.dom.typingIndicator);
    this.dom.chatBox.scrollTop = this.dom.chatBox.scrollHeight;
  }
  
  showTypingIndicator(show) { this.dom.typingIndicator.classList.toggle("hidden", !show); if (show) this.dom.chatBox.scrollTop = this.dom.chatBox.scrollHeight; }
  setInputDisabled(disabled) { this.dom.answerInput.disabled = disabled; this.dom.sendBtn.disabled = disabled; this.dom.sendBtn.classList.toggle("opacity-50", disabled); this.dom.sendBtn.classList.toggle("cursor-not-allowed", disabled); }
  handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add("border-teal-400", "bg-teal-50"); }
  handleDragLeave(e) { e.preventDefault(); e.currentTarget.classList.remove("border-teal-400", "bg-teal-50"); }
  handleFileDrop(e) { e.preventDefault(); this.handleDragLeave({ preventDefault: () => {}, currentTarget: this.dom.dropzone }); if (e.dataTransfer.files.length) this.handleFile(e.dataTransfer.files[0]); }
  handleFileSelect(e) { if (e.target.files.length) this.handleFile(e.target.files[0]); }
  async handleFile(file) { this.state.file = file; this.dom.fileName.textContent = file.name; this.dom.fileSize.textContent = `(${(file.size / 1024).toFixed(1)} KB)`; this.dom.filePreview.classList.remove("hidden"); this.dom.dropzone.classList.add("hidden"); this.dom.startBtn.disabled = false; try { this.state.sessionContext = await this.readFileContent(file); } catch (err) { this.renderMessage("ai", `❌ Error reading file: ${err.message}`); this.removeFile(); }}
  removeFile() { this.state.file = null; this.state.sessionContext = ""; this.dom.fileInput.value = ""; this.dom.filePreview.classList.add("hidden"); this.dom.dropzone.classList.remove("hidden"); this.dom.startBtn.disabled = true; this.restartSession(); }
  readFileContent(file) { const ext = file.name.split(".").pop().toLowerCase(); const reader = new FileReader(); return new Promise((resolve, reject) => { reader.onerror = () => reject(new DOMException("Problem parsing input file.")); reader.onload = async () => { try { const buffer = reader.result; if (ext === "txt") resolve(new TextDecoder().decode(buffer)); else if (ext === "pdf") { const pdf = await pdfjsLib.getDocument({ data: buffer }).promise; let text = ""; for (let i = 1; i <= pdf.numPages; i++) { const page = await pdf.getPage(i); const content = await page.getTextContent(); text += content.items.map((item) => item.str).join(" ") + "\n\n"; } resolve(text); } else if (ext === "docx") { const result = await mammoth.extractRawText({ arrayBuffer: buffer }); resolve(result.value); } else reject(new Error("Unsupported format. Please use .txt, .pdf, or .docx.")); } catch (error) { reject(error); } }; reader.readAsArrayBuffer(file); }); }
  async callGroq(payload) { try { const response = await fetch("/api/groq-proxy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); if (!response.ok) { const errorData = await response.json(); return { error: { message: errorData.error?.message || `HTTP Error: ${response.status}` } }; } return await response.json(); } catch (err) { return { error: { message: `Network Error: ${err.message}` } }; } }

  // =============================================================
  // SETUP PHASE: Diorkestrasi oleh startSession()
  // =============================================================

  // STEP 1: Pemindaian struktur cepat menggunakan model cepat
  async quickStructureScan(textSample) {
    const prompt = `Extract ONLY the chapter titles and numbers from this thesis text. Return a single, valid JSON object like {"chapters": [{"number": 1, "title": "Introduction"}, {"number": 2, "title": "Literature Review"}]}.`;
    const data = await this.callGroq({ model: this.FAST_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.1, response_format: { type: "json_object" } });
    if (data.error) throw new Error("Gagal memindai struktur dokumen.");
    return JSON.parse(data.choices[0].message.content);
  }

  // STEP 2: Pemotongan teks cerdas (pemrosesan lokal)
  smartChunking(fullText, structure) {
    const chunks = [];
    if (!structure.chapters || structure.chapters.length === 0) return [{ number: 1, title: "Full Document", content: fullText }];
    
    for (let i = 0; i < structure.chapters.length; i++) {
      const chapter = structure.chapters[i];
      const nextChapter = structure.chapters[i + 1];
      const pattern = new RegExp(`(BAB|CHAPTER)\\s+${chapter.number}[\\s\\n]`, 'i');
      const match = fullText.match(pattern);
      if (!match) continue;

      const startIndex = match.index;
      let endIndex = fullText.length;
      if (nextChapter) {
        const nextPattern = new RegExp(`(BAB|CHAPTER)\\s+${nextChapter.number}[\\s\\n]`, 'i');
        const nextMatch = fullText.substring(startIndex + match[0].length).match(nextPattern);
        if (nextMatch) endIndex = startIndex + match[0].length + nextMatch.index;
      }
      chunks.push({ number: chapter.number, title: chapter.title, content: fullText.substring(startIndex, endIndex) });
    }
    return chunks.length > 0 ? chunks : [{ number: 1, title: "Full Document", content: fullText }];
  }

  // STEP 3: Analisis mendalam paralel
  async parallelDeepDive(chunks) {
    const analysisPromises = chunks.map(chunk => {
      const perChapterPrompt = `Analyze this chapter for examination purposes. Extract: main argument, key concepts with definitions, methodology details, specific claims/findings, and potential weaknesses. Return a detailed JSON object.`;
      return this.callGroq({
        model: this.POWERFUL_MODEL,
        messages: [ { role: "system", content: `You are analyzing Chapter ${chunk.number}: ${chunk.title}.` }, { role: "user", content: `CHAPTER CONTENT:\n---\n${chunk.content.substring(0, 15000)}\n---\nINSTRUCTIONS:\n${perChapterPrompt}` } ],
        temperature: 0.3, response_format: { type: "json_object" },
      });
    });
    const results = await Promise.all(analysisPromises);
    return results.map((res, index) => ({ chapter: chunks[index].number, title: chunks[index].title, analysis: JSON.parse(res.choices[0].message.content) }));
  }
  
  // STEP 4 & 5: Sintesis, Pemetaan Konsep & Identifikasi Kelemahan
  async synthesizeAndStrategize(chapterAnalyses) {
      const prompt = `You will perform two tasks based on the provided thesis chapter analyses.
      ANALYSES: --- ${JSON.stringify(chapterAnalyses, null, 2)} ---
      TASK 1: SYNTHESIS & CONCEPT MAPPING: Build concept graph (nodes and edges), identify cross-chapter themes, and note any contradictions.
      TASK 2: STRATEGIC WEAKNESS IDENTIFICATION: Act as a critical thesis examiner. Identify methodological gaps, weak evidence, and alternative perspectives not considered. For each, note its location, severity, and a suggested question angle.
      Return a single valid JSON object with two top-level keys: "conceptGraph" and "strategicWeaknesses".`;
      const data = await this.callGroq({ model: this.POWERFUL_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.4, response_format: { type: "json_object" } });
      if (data.error) throw new Error("Gagal melakukan sintesis dan strategi.");
      return JSON.parse(data.choices[0].message.content);
  }

  // STEP 6: Pembangunan indeks hibrida (pemrosesan lokal)
  buildHybridIndex(chapterAnalyses) {
      const index = { keywordSearch: new Map() };
      chapterAnalyses.forEach(item => {
          if (!item.analysis) return;
          // PASTIKAN 'concepts' SELALU SEBUAH ARRAY
          const concepts = item.analysis.key_concepts;
          
          // PERBAIKAN: Hanya jalankan forEach jika 'concepts' adalah sebuah array.
          if (Array.isArray(concepts)) {
              concepts.forEach(concept => {
                  const term = (typeof concept === 'string' ? concept : concept.term)?.toLowerCase();
                  if (term) index.keywordSearch.set(term, item.chapter);
              });
          }
      });
      return index;
  }
  
  // --- Alur Sesi Utama ---
  async startSession(e) {
    e.preventDefault();
    if (!this.state.sessionContext) { alert("Silakan unggah file materi terlebih dahulu!"); return; }
    this.state.sessionActive = true;
    this.dom.materialSection.classList.add("hidden");
    this.dom.loadingSpinner.classList.remove("hidden");
    
    try {
      this.renderMessage("ai", "Memulai analisis... [Langkah 1/5]");
      this.state.structureMap = await this.quickStructureScan(this.state.sessionContext.substring(0, 5000));
      
      this.renderMessage("ai", `Struktur ditemukan (${this.state.structureMap.chapters.length} bab). Memotong teks... [Langkah 2/5]`);
      this.state.textChunks = this.smartChunking(this.state.sessionContext, this.state.structureMap);
      
      this.renderMessage("ai", `Menganalisis ${this.state.textChunks.length} bab secara paralel... [Langkah 3/5]`);
      this.state.chapterAnalyses = await this.parallelDeepDive(this.state.textChunks);

      this.renderMessage("ai", "Analisis bab selesai. Mensintesis konsep & strategi... [Langkah 4/5]");
      const combinedAnalysis = await this.synthesizeAndStrategize(this.state.chapterAnalyses);
      this.state.conceptGraph = combinedAnalysis.conceptGraph;
      this.state.strategicWeaknesses = combinedAnalysis.strategicWeaknesses;

      this.renderMessage("ai", "Membangun indeks pencarian... [Langkah 5/5]");
      this.state.hybridIndex = this.buildHybridIndex(this.state.chapterAnalyses);
      
      this.dom.loadingSpinner.classList.add("hidden");
      this.dom.chatSection.classList.remove("hidden");
      this.setInputDisabled(false);
      this.renderMessage("ai", "Analisis selesai. Sistem siap. Saya akan memulai dengan pertanyaan pertama.");

      // Meminta pertanyaan pertama dari AI
      const firstQuestionPrompt = `You are a Thesis Examiner. Your personality is '${this.state.agentMode}'. Based on the analysis, ask the very first question to the student.
      ANALYSIS: ${JSON.stringify(this.state.strategicWeaknesses || this.state.conceptGraph, null, 2)}
      Return a single valid JSON object: {"feedback": "", "next_question": "...", "score": 0}`;
      const aiResult = await this.callGroq({model: this.POWERFUL_MODEL, messages: [{role: "user", content: firstQuestionPrompt}], response_format: { type: "json_object" } });
      const firstQuestion = JSON.parse(aiResult.choices[0].message.content);

      if (firstQuestion.next_question) {
          this.renderMessage("ai", firstQuestion.next_question);
          this.state.chatHistory.push({ role: 'assistant', content: JSON.stringify(firstQuestion) });
          this.state.questionsAsked++;
      }

    } catch (error) {
        console.error("Setup Phase Failed:", error);
        this.renderMessage("ai", `Maaf, terjadi kesalahan selama fase analisis: ${error.message}. Silakan mulai ulang.`);
        this.dom.loadingSpinner.classList.add("hidden");
        this.dom.materialSection.classList.remove("hidden");
    }
  }

  // =============================================================
  // QUERY PHASE: Diorkestrasi oleh sendMessage()
  // =============================================================
  
  // STEP 7: Pengambilan konten cerdas
  async retrieveContent(query) {
      const cacheKey = query.toLowerCase();
      if (this.state.queryCache.has(cacheKey)) {
          console.log(`QUERY: Cache Hit on "${query}"`);
          return this.state.queryCache.get(cacheKey);
      }

      // Path A: Direct Index Hit (Pencarian Kata Kunci Sederhana)
      const queryWords = query.toLowerCase().split(/\s+/);
      for (const word of queryWords) {
          if (this.state.hybridIndex.keywordSearch.has(word)) {
              const chapterNum = this.state.hybridIndex.keywordSearch.get(word);
              const analysis = this.state.chapterAnalyses.find(c => c.chapter === chapterNum);
              console.log(`QUERY: Index Hit on "${word}"`);
              const result = { source: `ch${chapterNum}`, content: analysis, type: "Index Hit" };
              this.state.queryCache.set(cacheKey, result);
              return result;
          }
      }
      
      // Path B: AI Semantic Fallback
      console.log("QUERY: Index Miss. Triggering AI Semantic Fallback.");
      const prompt = `Given this thesis structure and a user query, which chapters are most relevant? Return a JSON object like {"relevant_chapters": [2, 4]}.`;
      const data = await this.callGroq({
          model: this.FAST_MODEL,
          messages: [ { role: "system", content: "You are a semantic router." }, { role: "user", content: `STRUCTURE: ${JSON.stringify(this.state.structureMap)}\n\nQUERY: "${query}"` } ],
          temperature: 0.2, response_format: { type: "json_object" },
      });

      // PERBAIKAN: Tambahkan penanganan error yang tangguh untuk mencegah crash.
      if (data.error) {
          console.error("AI Semantic Fallback failed:", data.error.message);
          // Kembalikan hasil kosong agar aplikasi tidak mogok.
          return { source: 'error', content: [], type: "AI Fallback Failed" };
      }

      try {
          // Akses respons dengan aman untuk menghindari error jika struktur tidak terduga.
          const content = data.choices?.[0]?.message?.content;
          if (!content) {
              throw new Error("Respons AI tidak memiliki konten.");
          }
          const parsedContent = JSON.parse(content);
          const relevantChapters = parsedContent.relevant_chapters || []; // Default ke array kosong

          const analyses = this.state.chapterAnalyses.filter(c => relevantChapters.includes(c.chapter));
          const result = { source: `ch${relevantChapters.join(',')}`, content: analyses, type: "AI Fallback" };
          this.state.queryCache.set(cacheKey, result);
          return result;
      } catch (e) {
          console.error("Gagal mem-parsing respons AI Semantic Fallback:", e);
          return { source: 'error', content: [], type: "AI Fallback Parse Error" };
      }
  }
  
  // Mengirim pesan dan mengelola alur percakapan
  async sendMessage() {
    if (!this.state.sessionActive || this.dom.sendBtn.disabled) return;
    const answer = this.dom.answerInput.value.trim();
    if (!answer) return;

    this.renderMessage("user", answer);
    this.state.chatHistory.push({ role: "user", content: answer });
    this.dom.answerInput.value = "";
    this.setInputDisabled(true);
    this.showTypingIndicator(true);

    if (this.state.questionsAsked >= this.state.maxQuestions) {
      this.renderMessage("ai", "Sesi ujian selesai. Terima kasih atas partisipasi Anda!");
      this.showTypingIndicator(false);
      this.setInputDisabled(false);
      this.state.sessionActive = false;
      return;
    }

    // Mengambil konteks yang relevan berdasarkan jawaban pengguna
    const context = await this.retrieveContent(answer);
    
    // Membangun prompt untuk Agen Penguji
    const examinerPrompt = `You are a Thesis Examiner with a '${this.state.agentMode}' personality. A user has provided an answer. I have retrieved relevant context from their thesis to help you evaluate it.
    RICH CONTEXT: --- ${JSON.stringify(context, null, 2)} ---
    CHAT HISTORY: --- ${JSON.stringify(this.state.chatHistory.slice(-4))} ---
    Based on ALL the information above, evaluate the user's last answer and formulate your next question.
    Return a single valid JSON object: {"feedback": "...", "next_question": "...", "score": 0-100}`;

    const aiResult = await this.callGroq({ model: this.POWERFUL_MODEL, messages: [{ role: "user", content: examinerPrompt }], response_format: { type: "json_object" }});
    const response = JSON.parse(aiResult.choices[0].message.content);

    // Merender respons
    if (this.state.agentMode !== "exam" && response.feedback) {
      this.renderMessage("ai", `*Feedback: ${response.feedback}*`);
    }
    if (response.next_question) {
      this.renderMessage("ai", response.next_question);
      this.state.chatHistory.push({ role: 'assistant', content: JSON.stringify(response) });
      this.state.questionsAsked++;
    }

    this.showTypingIndicator(false);
    this.setInputDisabled(false);
    this.dom.answerInput.focus();
  }

  restartSession() {
    Object.assign(this.state, {
      sessionContext: "", chatHistory: [], sessionActive: false, questionsAsked: 0, file: null,
      structureMap: null, textChunks: [], chapterAnalyses: null, conceptGraph: null,
      strategicWeaknesses: null, hybridIndex: {}, queryCache: new Map()
    });
    this.dom.chatBox.innerHTML = "";
    this.dom.chatBox.appendChild(this.dom.typingIndicator);
    this.dom.materialSection.classList.remove("hidden");
    this.dom.chatSection.classList.add("hidden");
    this.dom.loadingSpinner.classList.add("hidden");
    this.setInputDisabled(false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ThesisExaminerApp();
});


