// A modern, encapsulated class to manage the entire application
class AIExaminerApp {
  // The constructor initializes the application's state and finds all necessary HTML elements
  constructor() {
    this.MODEL = "llama-3.3-70b-versatile"; // Latest powerful model

    // 1. Centralized state management (apiKey is no longer needed here)
    this.state = {
      sessionContext: "",
      chatHistory: [],
      sessionActive: false,
      difficulty: "adaptive",
      currentLevel: "medium",
      agentMode: "friendly",
      questionsAsked: 0,
      maxQuestions: 10,
      file: null,
    };

    // 2. Centralized DOM references (apiKeyInput removed)
    this.dom = {
      dropzone: document.getElementById("dropzone"),
      fileInput: document.getElementById("fileInput"),
      filePreview: document.getElementById("file-preview"),
      fileName: document.getElementById("file-name"),
      fileSize: document.getElementById("file-size"),
      removeFileBtn: document.getElementById("remove-file-btn"),
      difficultySelect: document.getElementById("difficultySelect"),
      agentModeSelect: document.getElementById("agentModeSelect"),
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

  // Binds all event listeners
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
    this.dom.answerInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  // --- UI Update Methods ---
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
    messageEl.innerHTML = `
      <div class="${layoutClasses}">
        ${isAI ? avatar : ""}
        <div class="p-3 ${bubbleClasses}">${content.replace(/\n/g, "<br>")}</div>
        ${!isAI ? avatar : ""}
      </div>`;
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

  // --- File Handling ---
  handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add("border-teal-400", "bg-teal-50"); }
  handleDragLeave(e) { e.preventDefault(); e.currentTarget.classList.remove("border-teal-400", "bg-teal-50"); }
  handleFileDrop(e) {
    e.preventDefault();
    this.handleDragLeave({ preventDefault: () => {}, currentTarget: this.dom.dropzone });
    if (e.dataTransfer.files.length) this.handleFile(e.dataTransfer.files[0]);
  }
  handleFileSelect(e) { if (e.target.files.length) this.handleFile(e.target.files[0]); }
  async handleFile(file) {
    this.state.file = file;
    this.dom.fileName.textContent = file.name;
    this.dom.fileSize.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
    this.dom.filePreview.classList.remove("hidden");
    this.dom.dropzone.classList.add("hidden");
    this.dom.startBtn.disabled = false;
    try {
      this.state.sessionContext = await this.readFileContent(file);
    } catch (err) {
      this.renderMessage("ai", `❌ Error reading file: ${err.message}`);
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
  }
  readFileContent(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onerror = () => reject(new DOMException("Problem parsing input file."));
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
            const result = await mammoth.extractRawText({ arrayBuffer: buffer });
            resolve(result.value);
          } else reject(new Error("Unsupported file format. Please use .txt, .pdf, or .docx."));
        } catch (error) { reject(error); }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // --- Core API and Session Logic ---
  buildSystemPrompt() {
    const { difficulty, agentMode, currentLevel } = this.state;
    const difficultyMap = { easy: "Ask simple questions: basic definitions and facts.", medium: "Ask intermediate questions: brief analysis, connections between concepts.", hard: "Ask difficult questions: in-depth analysis, concept application, critical evaluation." };
    const agentModeMap = { strict: "You are a strict teacher. Ask tough questions, provide harsh critique, no small talk.", friendly: "You are a friendly tutor. Ask questions with a positive tone, always be encouraging.", exam: "You are an exam simulator. Ask questions one by one WITHOUT feedback. Keep score for a final summary." };
    return `You are AI Examiner. Your task is to test a user's understanding of the provided material.
    === STRICT RULES ===
    1. DO NOT answer your own questions.
    2. Always ask only ONE question at a time.
    3. Your entire output MUST be a valid JSON object without any markdown formatting: {"feedback": "...", "next_question": "...", "score": 0-100}
    4. Feedback should be max 2 sentences. If in 'exam' mode, feedback MUST be an empty string ("").
    5. 'score' is your assessment of the user's last answer (0-100). For the first question, the score must be 0.
    === DIFFICULTY ===
    ${difficulty === 'adaptive' ? difficultyMap[currentLevel] : difficultyMap[difficulty]}
    === MODE ===
    ${agentModeMap[agentMode]}`;
  }

  // ✅ *** THIS IS THE KEY CHANGE *** ✅
  // This method now calls YOUR secure proxy, not Groq directly.
  async callGroq(payload) {
    try {
      const response = await fetch("/api/groq-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json();
        return { error: { message: errorData.error?.message || `HTTP Error: ${response.status}` } };
      }
      return await response.json();
    } catch (err) {
      return { error: { message: `Network Error: ${err.message}` } };
    }
  }

  async getAIResponse(messages) {
    const payload = {
        model: this.MODEL,
        messages,
        temperature: 0.6,
        response_format: { type: "json_object" },
    };
    const data = await this.callGroq(payload);
    if (data.error) {
      return { feedback: "", next_question: `⚠️ Error: ${data.error.message}`, score: 0 };
    }
    const rawContent = data.choices?.[0]?.message?.content || "{}";
    try {
      const parsed = JSON.parse(rawContent);
      if (!parsed.next_question) throw new Error("Missing 'next_question' in AI response.");
      return parsed;
    } catch (e) {
      console.warn("Non-JSON response from AI, using fallback:", rawContent);
      return { feedback: "", next_question: rawContent, score: 50 };
    }
  }

  adaptDifficulty(score) {
    if (this.state.difficulty !== "adaptive") return;
    if (score > 80 && this.state.currentLevel === "easy") this.state.currentLevel = "medium";
    else if (score > 80 && this.state.currentLevel === "medium") this.state.currentLevel = "hard";
    else if (score < 40 && this.state.currentLevel === "hard") this.state.currentLevel = "medium";
    else if (score < 40 && this.state.currentLevel === "medium") this.state.currentLevel = "easy";
  }

  // --- Main Event Handlers ---
  async startSession(e) {
    e.preventDefault();
    if (!this.state.sessionContext) {
      alert("Please upload a material file first!");
      return;
    }
    this.state.sessionActive = true;
    this.state.difficulty = this.dom.difficultySelect.value;
    this.state.agentMode = this.dom.agentModeSelect.value;
    this.state.currentLevel = this.state.difficulty === "adaptive" ? "medium" : this.state.difficulty;
    this.dom.materialSection.classList.add("hidden");
    this.dom.loadingSpinner.classList.remove("hidden");

    const messages = [{ role: "system", content: this.buildSystemPrompt() }, { role: "user", content: `Material:\n---\n${this.state.sessionContext}\n---\n\nPlease ask me the first question.` }];
    const aiResult = await this.getAIResponse(messages);

    this.dom.loadingSpinner.classList.add("hidden");
    this.dom.chatSection.classList.remove("hidden");
    this.setInputDisabled(false);
    this.dom.answerInput.focus();

    if (aiResult.next_question) {
      this.renderMessage("ai", aiResult.next_question);
      this.state.chatHistory.push({ role: "assistant", content: JSON.stringify(aiResult) });
      this.state.questionsAsked++;
    } else {
      this.renderMessage("ai", "I'm sorry, I couldn't generate a question. Please try again.");
    }
  }

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
      const summary = `🎉 Session complete! You answered ${this.state.questionsAsked} out of ${this.state.maxQuestions} questions. Click Restart to try again.`;
      this.renderMessage("ai", summary);
      this.showTypingIndicator(false);
      this.state.sessionActive = false;
      return;
    }

    const messages = [{ role: "system", content: this.buildSystemPrompt() }, { role: "user", content: `Material:\n---\n${this.state.sessionContext}\n---` }, ...this.state.chatHistory];
    const aiResult = await this.getAIResponse(messages);
    this.adaptDifficulty(aiResult.score);

    if (this.state.agentMode !== "exam" && aiResult.feedback) {
      this.renderMessage("ai", `*Feedback: ${aiResult.feedback}*`);
    }
    if (aiResult.next_question) {
      this.renderMessage("ai", aiResult.next_question);
      this.state.chatHistory.push({ role: "assistant", content: JSON.stringify(aiResult) });
      this.state.questionsAsked++;
    } else {
      this.renderMessage("ai", "Sorry, I encountered an issue. Please try restarting the session.");
      this.state.sessionActive = false;
    }
    this.showTypingIndicator(false);
    this.setInputDisabled(false);
    this.dom.answerInput.focus();
  }
  
  restartSession() {
    this.state = { ...this.state, sessionContext: "", chatHistory: [], sessionActive: false, difficulty: "adaptive", currentLevel: "medium", agentMode: "friendly", questionsAsked: 0, file: null };
    this.dom.chatBox.innerHTML = "";
    this.dom.chatBox.appendChild(this.dom.typingIndicator);
    this.removeFile();
    this.dom.materialSection.classList.remove("hidden");
    this.dom.chatSection.classList.add("hidden");
    this.dom.loadingSpinner.classList.add("hidden");
    this.dom.difficultySelect.value = "adaptive";
    this.dom.agentModeSelect.value = "friendly";
    this.setInputDisabled(false);
  }
}

// Create an instance of the app to run it
document.addEventListener("DOMContentLoaded", () => {
  new AIExaminerApp();
});

