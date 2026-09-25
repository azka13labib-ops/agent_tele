const fs = require('fs');
const { openai } = require('../core/ai');
const { AI_MODEL } = require('../config/env');
const { INDEX_FILE } = require('../config/paths');

const activeQuizzes = {};

function getTopicsFromKnowledge() {
  try {
    if (fs.existsSync(INDEX_FILE)) {
      const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
      if (Array.isArray(index) && index.length > 0) {
        return index.slice(0, 15).map(item => ({
          title: item.title,
          summary: item.summary,
          tags: item.tags || []
        }));
      }
    }
  } catch {}
  return [];
}

async function generateQuizQuestion(chatId, customTopic = "") {
  const knowledgeItems = getTopicsFromKnowledge();
  let contextPrompt = "";

  if (knowledgeItems.length > 0 && !customTopic) {
    const picked = knowledgeItems[Math.floor(Math.random() * knowledgeItems.length)];
    contextPrompt = `Topik dari memori pengetahuan Hermes: "${picked.title}" (${(picked.tags || []).join(', ')})\nRingkasan: ${picked.summary}`;
  } else if (customTopic) {
    contextPrompt = `Topik khusus yang diminta: "${customTopic}"`;
  } else {
    const generalTopics = [
      "Database Indexing, B-Tree, dan Query Optimization di PostgreSQL",
      "Event Loop, Concurrency, dan Thread Pool pada Node.js Runtime",
      "Model Context Protocol (MCP) dan Integrasi Tool pada LLM Agents",
      "Optimistic UI, TanStack Query Caching, dan Server State Management",
      "Redis Caching Strategy: Cache Aside, Write Through, vs Write Back",
      "Distributed Systems: Idempotency Keys dan Distributed Locking",
      "LLM PagedAttention, KV Cache Optimization, dan Batch Inference",
      "REST vs gRPC vs tRPC: Kapan harus memilih pendekatan typesafe API"
    ];
    contextPrompt = `Topik arsitektur: "${generalTopics[Math.floor(Math.random() * generalTopics.length)]}"`;
  }

  const prompt = `
Kamu adalah Principal Software Architect dan Technical Interviewer kelas dunia.
Buat 1 studi kasus teknis atau soal kuis arsitektur sistem tingkat menengah ke atas (Senior/Staff Level) yang menguji pemahaman mendalam developer, bukan sekadar hafalan.

Konteks Materi:
${contextPrompt}

Format Output WAJIB HANYA berupa JSON murni dengan struktur:
{
  "topic": "Nama singkat topik",
  "question": "Deskripsi studi kasus atau pertanyaan situasi nyata (2-4 kalimat).",
  "options": [
    "Pilihan A",
    "Pilihan B",
    "Pilihan C",
    "Pilihan D"
  ],
  "correctIndex": 0,
  "explanation": "Penjelasan mendalam mengapa jawaban tersebut benar dan mengapa opsi lainnya kurang optimal dalam sistem skala produksi (2-4 kalimat)."
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Kamu adalah system design interviewer. Balas HANYA dengan JSON valid tanpa markdown code block.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4
    });

    const raw = response.choices[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "Gagal memformat kuis dari AI." };
    }

    const quizData = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(quizData.options) || quizData.options.length < 4 || typeof quizData.correctIndex !== 'number') {
      return { success: false, error: "Format opsi kuis tidak lengkap." };
    }

    const quizId = `q_${Date.now()}`;
    activeQuizzes[chatId] = {
      id: quizId,
      topic: quizData.topic,
      question: quizData.question,
      options: quizData.options,
      correctIndex: quizData.correctIndex,
      explanation: quizData.explanation,
      answered: false
    };

    return {
      success: true,
      quiz: activeQuizzes[chatId]
    };
  } catch (err) {
    return { success: false, error: `Gagal membuat soal kuis: ${err.message}` };
  }
}

function getActiveQuiz(chatId) {
  return activeQuizzes[chatId] || null;
}

function answerQuiz(chatId, answerIndex) {
  const current = activeQuizzes[chatId];
  if (!current) {
    return { success: false, error: "Tidak ada kuis yang sedang aktif. Ketik /quiz untuk memulai kuis baru!" };
  }

  const isCorrect = Number(answerIndex) === current.correctIndex;
  current.answered = true;

  const letterMap = ['A', 'B', 'C', 'D'];
  const chosenLetter = letterMap[answerIndex] || '?';
  const correctLetter = letterMap[current.correctIndex] || '?';
  const correctText = current.options[current.correctIndex] || '';

  return {
    success: true,
    isCorrect,
    chosenLetter,
    correctLetter,
    correctText,
    explanation: current.explanation,
    topic: current.topic
  };
}

module.exports = {
  generateQuizQuestion,
  getActiveQuiz,
  answerQuiz
};
