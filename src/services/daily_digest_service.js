const path = require('path');
const fs = require('fs');
const { OWNER_IDS, AI_MODEL } = require('../config/env');
const { safeSendMessage } = require('../core/bot');
const { openai } = require('../core/ai');
const { NOTES_DIR, INDEX_FILE, ensureDirectories } = require('../config/paths');
const settingsManager = require('./settings_manager');

let isSendingDigest = false;
let digestSchedulerInterval = null;

async function fetchTopFullstackRepos(count = 10) {
  const queries = [
    'topic:ai+topic:developer-tools+stars:>1000',
    'topic:llm+topic:agent+stars:>500',
    'topic:generative-ai+stars:>1000',
    'topic:ai-agent+stars:>500',
    'topic:machine-learning+topic:developer-tools+stars:>1000',
    'topic:rag+topic:llm+stars:>500',
    'topic:ai+topic:framework+stars:>1500'
  ];

  const pickedQuery = queries[Math.floor(Math.random() * queries.length)];
  const sort = Math.random() > 0.5 ? 'stars' : 'updated';
  const url = `https://api.github.com/search/repositories?q=${pickedQuery}&sort=${sort}&order=desc&per_page=15`;

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Hermes-Agent-DailyDigest/2.0',
        'Accept': 'application/vnd.github.v3+json'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!resp.ok) return getDefaultAIRepos().slice(0, count);

    const data = await resp.json();
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      return getDefaultAIRepos().slice(0, count);
    }

    const repos = data.items.slice(0, count).map(r => ({
      name: r.full_name,
      url: r.html_url,
      stars: r.stargazers_count,
      language: r.language || 'Multi',
      description: r.description ? r.description.replace(/[\r\n]+/g, ' ').trim() : 'Tools AI dan machine learning open source untuk developer'
    }));

    return repos.length >= 5 ? repos : getDefaultAIRepos().slice(0, count);
  } catch (err) {
    console.warn("Error fetching GitHub AI repos:", err.message);
    return getDefaultAIRepos().slice(0, count);
  }
}

function getDefaultAIRepos() {
  return [
    { name: "langchain-ai/langchainjs", url: "https://github.com/langchain-ai/langchainjs", stars: 14000, language: "TypeScript", description: "Framework orkestrasi aplikasi LLM, chains, dan agen AI cerdas berbasis JavaScript dan TypeScript" },
    { name: "ollama/ollama", url: "https://github.com/ollama/ollama", stars: 98000, language: "Go", description: "Platform paling populer dan efisien untuk menjalankan model AI besar seperti Llama 3, DeepSeek, dan Mistral secara lokal" },
    { name: "vllm-project/vllm", url: "https://github.com/vllm-project/vllm", stars: 32000, language: "Python", description: "Engine inferensi dan serving LLM performa tinggi dengan throughput ultra-cepat memanfaatkan teknik PagedAttention" },
    { name: "browser-use/browser-use", url: "https://github.com/browser-use/browser-use", stars: 22000, language: "Python", description: "AI agent otonom yang mampu mengendalikan browser web untuk scraping otomatis, pengisian form, dan navigasi data" },
    { name: "modelcontextprotocol/servers", url: "https://github.com/modelcontextprotocol/servers", stars: 12000, language: "TypeScript", description: "Koleksi implementasi standar Model Context Protocol (MCP) untuk menghubungkan AI dengan tool eksternal dan database" },
    { name: "continuedev/continue", url: "https://github.com/continuedev/continue", stars: 21000, language: "TypeScript", description: "Asisten coding AI open-source terkemuka yang terintegrasi langsung di editor VS Code dan JetBrains" },
    { name: "run-llama/LlamaIndexTS", url: "https://github.com/run-llama/LlamaIndexTS", stars: 6000, language: "TypeScript", description: "Framework orkestrasi data, indexing dokumen, dan Retrieval-Augmented Generation (RAG) untuk ekosistem TypeScript" },
    { name: "OpenBB-finance/OpenBBTerminal", url: "https://github.com/OpenBB-finance/OpenBBTerminal", stars: 38000, language: "Python", description: "Platform analitik finansial dan riset pasar komprehensif bertenaga AI agent open-source" },
    { name: "comfyanonymous/ComfyUI", url: "https://github.com/comfyanonymous/ComfyUI", stars: 55000, language: "Python", description: "Antarmuka grafis modular berbasis node tercanggih untuk mendesain alur kerja Stable Diffusion dan Generative AI" },
    { name: "karpathy/nanoGPT", url: "https://github.com/karpathy/nanoGPT", stars: 36000, language: "Python", description: "Repositori paling sederhana dan tercepat untuk melatih dan memahami arsitektur Transformer GPT dari nol" }
  ];
}

async function fetchTopTechNews(count = 5) {
  const tags = ['ai', 'machinelearning', 'llm'];
  const pickedTag = tags[Math.floor(Math.random() * tags.length)];

  try {
    const resp = await fetch(`https://dev.to/api/articles?tag=${pickedTag}&top=1&per_page=7`, {
      headers: { 'User-Agent': 'Hermes-Agent-DailyDigest/2.0' },
      signal: AbortSignal.timeout(12000)
    });

    if (!resp.ok) return getDefaultAINews().slice(0, count);

    const articles = await resp.json();
    if (!Array.isArray(articles) || articles.length === 0) {
      return getDefaultAINews().slice(0, count);
    }

    const news = articles.slice(0, count).map(a => ({
      title: a.title,
      url: a.url,
      description: a.description || a.title,
      author: a.user?.name || "Dev Community"
    }));

    return news;
  } catch (err) {
    console.warn("Error fetching AI tech news:", err.message);
    return getDefaultAINews().slice(0, count);
  }
}

function getDefaultAINews() {
  return [
    { title: "DeepSeek-V3 and R1 Architecture Breakthroughs in Open Source AI", url: "https://dev.to", description: "Inovasi arsitektur Mixture of Experts (MoE) dan Multi-head Latent Attention (MLA) yang menyaingi model komersial tertutup dengan efisiensi komputasi ekstrem.", author: "AI Research Group" },
    { title: "The Rise of Autonomous AI Coding Agents in Fullstack Development", url: "https://dev.to", description: "Membahas bagaimana coding agent modern berevolusi dari sekadar autocompletion menjadi agen otonom yang mampu menjalankan terminal, testing, dan deployment.", author: "Tech Insights" },
    { title: "Model Context Protocol (MCP): The New Standard for AI Tooling", url: "https://dev.to", description: "Standarisasi protokol terbuka yang memungkinkan model LLM berinteraksi secara aman dengan database, API lokal, dan environment developer.", author: "Open Source AI" },
    { title: "Local LLM Inference Optimization on Consumer GPUs", url: "https://dev.to", description: "Perkembangan kuantisasi 4-bit, FlashAttention, dan teknik offloading memori yang memungkinkan model besar berjalan mulus di GPU laptop dan desktop.", author: "ML Engineering" },
    { title: "OpenAI Function Calling and Structured JSON Outputs Best Practices", url: "https://dev.to", description: "Panduan arsitektur modern dalam memastikan response AI 100% konsisten dengan skema JSON untuk integrasi API backend yang andal.", author: "Fullstack AI Dev" }
  ];
}

async function translateAndEnrichDigest(repos, news) {
  try {
    const reposPayload = repos.map((r, i) => ({
      id: i,
      name: r.name,
      desc: r.description || ''
    }));
    const newsPayload = news.map((n, i) => ({
      id: i,
      title: n.title,
      desc: n.description || ''
    }));

    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Kamu adalah software engineer reviewer and AI technical translator profesional. Tugasmu adalah menerjemahkan dan menjelaskan fungsi masing-masing repositori AI open source serta intisari berita AI ke dalam Bahasa Indonesia yang alami, padat, jelas (1-2 kalimat), dan sangat berbobot untuk kebutuhan fullstack developer. Dilarang menggunakan bahasa Inggris pada nilai "fungsi" dan "intisari" (istilah teknis umum seperti AI, LLM, API, framework, database tetap boleh). Balas HANYA dengan format JSON murni tanpa markdown fence.'
        },
        {
          role: 'user',
          content: `Terjemahkan dan jelaskan ke Bahasa Indonesia:\nFormat JSON wajib: {"repos":[{"id":0,"fungsi":"..."}],"news":[{"id":0,"intisari":"..."}]}\n\nData:\n${JSON.stringify({ repos: reposPayload, news: newsPayload })}`
        }
      ],
      temperature: 0.2
    });

    const raw = response.choices[0]?.message?.content || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.repos)) {
        parsed.repos.forEach(item => {
          if (repos[item.id] && item.fungsi && typeof item.fungsi === 'string' && item.fungsi.trim().length > 0) {
            repos[item.id].description = item.fungsi.replace(/[\r\n]+/g, ' ').trim();
          }
        });
      }
      if (Array.isArray(parsed.news)) {
        parsed.news.forEach(item => {
          if (news[item.id] && item.intisari && typeof item.intisari === 'string' && item.intisari.trim().length > 0) {
            news[item.id].description = item.intisari.replace(/[\r\n]+/g, ' ').trim();
          }
        });
      }
    }
  } catch (err) {
    console.warn("[DailyDigest] AI translation warning:", err.message);
  }
}

function autoLearnDigestItems(repos, news) {
  try {
    ensureDirectories();
    let index = [];
    if (fs.existsSync(INDEX_FILE)) {
      try {
        index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
      } catch {}
    }

    const now = Date.now();
    let addedCount = 0;

    for (const r of repos) {
      const slug = r.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const noteFileName = `repo_ai_${slug}.md`;
      const noteFilePath = path.join(NOTES_DIR, noteFileName);
      const noteContent =
        `# 🤖 Catatan AI Open Source: ${r.name}\n\n` +
        `- **URL:** ${r.url}\n` +
        `- **Bahasa:** ${r.language}\n` +
        `- **Stars:** ${r.stars}\n` +
        `- **Waktu Dipelajari:** ${new Date().toLocaleString('id-ID')}\n` +
        `- **Tags:** ai, open_source, devtools, ${r.language.toLowerCase()}\n\n` +
        `## 💡 Fungsi & Nilai Penting\n${r.description}\n\n` +
        `---\n*Dipelajari otomatis dari kurasi harian Hermes AI Agent.*`;

      fs.writeFileSync(noteFilePath, noteContent, 'utf-8');

      const entryId = `repo_ai_${slug}`;
      const existingIdx = index.findIndex(item => item.id === entryId);
      const entry = {
        id: entryId,
        type: "ai_github_repo",
        title: r.name,
        source: r.url,
        tags: ["ai", "open_source", "devtools", r.language.toLowerCase()],
        summary: r.description,
        keyTakeaways: [
          `Fungsi: ${r.description}`,
          `Bahasa: ${r.language} | Stars: ${r.stars}`
        ],
        noteFile: path.relative(path.resolve('./'), noteFilePath).replace(/\\/g, '/'),
        learnedAt: now
      };

      if (existingIdx >= 0) {
        index[existingIdx] = entry;
      } else {
        index.unshift(entry);
        addedCount++;
      }
    }

    for (let i = 0; i < news.length; i++) {
      const n = news[i];
      const slug = n.title.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 40);
      const noteFileName = `news_ai_${slug}.md`;
      const noteFilePath = path.join(NOTES_DIR, noteFileName);
      const noteContent =
        `# 📰 Berita & Trend AI Terkini: ${n.title}\n\n` +
        `- **URL:** ${n.url}\n` +
        `- **Sumber / Penulis:** ${n.author || 'Dev Community'}\n` +
        `- **Waktu Dipelajari:** ${new Date().toLocaleString('id-ID')}\n` +
        `- **Tags:** ai, news, tech_trends\n\n` +
        `## 📝 Intisari Berita\n${n.description}\n\n` +
        `---\n*Dipelajari otomatis dari kurasi berita AI harian Hermes.*`;

      fs.writeFileSync(noteFilePath, noteContent, 'utf-8');

      const entryId = `news_ai_${slug}`;
      const existingIdx = index.findIndex(item => item.id === entryId);
      const entry = {
        id: entryId,
        type: "ai_tech_news",
        title: n.title,
        source: n.url,
        tags: ["ai", "news", "trend"],
        summary: n.description,
        keyTakeaways: [
          `Intisari: ${n.description}`,
          `Sumber: ${n.author || 'Tech Community'}`
        ],
        noteFile: path.relative(path.resolve('./'), noteFilePath).replace(/\\/g, '/'),
        learnedAt: now
      };

      if (existingIdx >= 0) {
        index[existingIdx] = entry;
      } else {
        index.unshift(entry);
        addedCount++;
      }
    }

    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
    console.log(`[DailyDigest AutoLearn] Berhasil menyimpan ${addedCount} materi AI baru ke Knowledge Base.`);
  } catch (err) {
    console.error("[DailyDigest AutoLearn Error]:", err.message);
  }
}

async function sendDailyDigest(forcedChatId = null) {
  if (isSendingDigest) {
    console.log("[DailyDigest] Sedang mengirim digest, melewati...");
    return { success: false, reason: "in_progress" };
  }

  isSendingDigest = true;
  console.log("[DailyDigest] Mengumpulkan 10 repositori AI & 5 berita teknologi AI terbaru...");

  try {
    const targetChatId = forcedChatId || (OWNER_IDS.length > 0 ? OWNER_IDS[0] : null);
    if (!targetChatId) {
      isSendingDigest = false;
      return { success: false, reason: "no_chat_id" };
    }

    const [repos, news] = await Promise.all([
      fetchTopFullstackRepos(10),
      fetchTopTechNews(5)
    ]);

    await translateAndEnrichDigest(repos, news);

    autoLearnDigestItems(repos, news);

    const dateStr = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let reposText =
      `🤖 *HERMES DAILY BRIEFING — AI DEVELOPER DIGEST*\n` +
      `📅 *${dateStr}*\n\n` +
      `🚀 *TOP 10 OPEN SOURCE AI REPOSITORIES (TERBARU & TERBAIK):*\n` +
      `_Koleksi tool AI, agent, LLM framework, dan model open source terkini untuk dipelajari:_\n\n`;

    repos.forEach((r, idx) => {
      const starsFormatted = r.stars >= 1000 ? `${(r.stars / 1000).toFixed(1)}k` : r.stars;
      reposText += `${idx + 1}. 📦 *[${r.name}](${r.url})* (⭐ ${starsFormatted} | \`${r.language}\`)\n`;
      reposText += `   💡 *Fungsi:* ${r.description}\n\n`;
    });

    let newsText =
      `📰 *5 BERITA & TREND AI TERKINI:*\n` +
      `_Update terhangat seputar ekosistem Artificial Intelligence, LLM, dan engineering:_\n\n`;

    news.forEach((n, idx) => {
      newsText += `${idx + 1}. ⚡ *[${n.title}](${n.url})*\n`;
      newsText += `   📝 *Intisari:* ${n.description}\n`;
      if (n.author) newsText += `   👤 _Sumber: ${n.author}_\n\n`;
    });

    newsText +=
      `🧠 *STATUS PEMBELAJARAN HERMES:*\n` +
      `✅ *Semua 10 AI repo & 5 berita di atas sudah otomatis dipelajari & disimpan ke Memori Permanen Hermes (` + '`/brain`' + `)!*\n\n` +
      `💡 *Langkah Selanjutnya:*\n` +
      `Kamu bisa langsung menanyakan analisis atau kode dari materi di atas kapan saja, atau minta Hermes belajar lebih dalam:\n` +
      `• Ketik: \`/learn <url>\` untuk deep-scan arsitektur kode\n` +
      `• Ketik: \`/brain\` untuk mengecek seluruh daftar materi yang sudah tersimpan`;

    await safeSendMessage(targetChatId, reposText);
    await safeSendMessage(targetChatId, newsText);

    settingsManager.setLastDailyDigestAt(Date.now());
    isSendingDigest = false;
    console.log("[DailyDigest] Berhasil dikirim ke Telegram dan disimpan ke Memori!");
    return { success: true };
  } catch (err) {
    console.error("[DailyDigest Error]:", err.message);
    isSendingDigest = false;
    return { success: false, error: err.message };
  }
}

function startDailyDigestScheduler() {
  if (digestSchedulerInterval) {
    clearInterval(digestSchedulerInterval);
  }

  digestSchedulerInterval = setInterval(async () => {
    if (!settingsManager.isDailyDigest()) {
      return;
    }

    const lastAt = settingsManager.getLastDailyDigestAt();
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    if (now - lastAt >= ONE_DAY_MS) {
      console.log("[DailyDigest Scheduler] Interval 24 jam tercapai. Mengirimkan briefing harian...");
      await sendDailyDigest();
    }
  }, 60 * 1000);

  console.log("[DailyDigest Scheduler] Aktif! Pengecekan briefing harian berjalan.");
}

module.exports = {
  fetchTopFullstackRepos,
  fetchTopTechNews,
  translateAndEnrichDigest,
  autoLearnDigestItems,
  sendDailyDigest,
  startDailyDigestScheduler
};
