const fs = require('fs');
const { WATCHLIST_FILE, ensureDirectories } = require('../config/paths');
const { OWNER_IDS } = require('../config/env');
const { safeSendMessage } = require('../core/bot');
const settingsManager = require('./settings_manager');
const knowledgeManager = require('./knowledge_manager');

let isLearning = false;
let schedulerIntervalId = null;

function loadWatchlist() {
  ensureDirectories();
  if (fs.existsSync(WATCHLIST_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

function saveWatchlist(items) {
  ensureDirectories();
  try {
    fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving watchlist:', err.message);
  }
}

function addToWatchlist(url, topic = "") {
  const cleanUrl = url.trim();
  const items = loadWatchlist();
  const existing = items.find(i => i.url.toLowerCase() === cleanUrl.toLowerCase());
  if (existing) {
    existing.status = 'pending';
    if (topic) existing.topic = topic;
    saveWatchlist(items);
    return { added: false, item: existing };
  }

  const newItem = {
    url: cleanUrl,
    topic: topic.trim() || "Trending Open Source & Developer Tools",
    status: "pending",
    addedAt: Date.now()
  };

  items.unshift(newItem);
  saveWatchlist(items);
  return { added: true, item: newItem };
}

function formatWatchlist() {
  const items = loadWatchlist();
  if (items.length === 0) {
    return "📋 *Antrean Watchlist Kosong!*\n\nTambah link dengan: `/watchlist add <link github>`";
  }

  let text = `📋 *Daftar Prioritas Belajar Hermes (${items.length} item):*\n\n`;
  items.forEach((it, idx) => {
    const badge = it.status === 'completed' ? '✅ Selesai' : '⏳ Menunggu';
    text += `${idx + 1}. [${badge}] *${it.url}*\n   Topik: _${it.topic || 'General'}\_\n\n`;
  });

  return text;
}

async function fetchTrendingRepos() {
  const queries = [
    'topic:developer-tools+stars:>2000&sort=updated&order=desc',
    'topic:cli+stars:>3000&sort=stars&order=desc',
    'topic:devtools+stars:>2000&sort=updated&order=desc'
  ];

  const pickedQuery = queries[Math.floor(Math.random() * queries.length)];
  const url = `https://api.github.com/search/repositories?q=${pickedQuery}&per_page=15`;

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Hermes-Agent-AutoLearner/2.0',
        'Accept': 'application/vnd.github.v3+json'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!resp.ok) return [];

    const data = await resp.json();
    if (!data.items || !Array.isArray(data.items)) return [];

    return data.items.map(repo => ({
      url: repo.html_url,
      title: repo.full_name,
      topic: repo.description || "Developer Tool & System Architecture"
    }));
  } catch (err) {
    console.warn("Trending fetch notice:", err.message);
    return [];
  }
}

async function selectNextTarget() {
  const watchlist = loadWatchlist();
  const pending = watchlist.find(item => item.status === 'pending');
  if (pending) {
    return { ...pending, fromWatchlist: true };
  }

  const trendingList = await fetchTrendingRepos();
  if (trendingList.length > 0) {
    const knowledgeIndex = knowledgeManager.loadIndex ? knowledgeManager.loadIndex() : [];
    const learnedSources = new Set(knowledgeIndex.map(k => (k.source || '').toLowerCase()));
    const learnedTitles = new Set(knowledgeIndex.map(k => (k.title || '').toLowerCase()));

    for (const repo of trendingList) {
      const urlLower = repo.url.toLowerCase();
      const titleLower = repo.title.toLowerCase();
      if (!learnedSources.has(urlLower) && !learnedTitles.has(titleLower)) {
        return {
          url: repo.url,
          topic: repo.topic,
          fromWatchlist: false
        };
      }
    }
  }

  const fallbackRepos = [
    { url: "https://github.com/astral-sh/uv", topic: "Python package & project manager written in Rust" },
    { url: "https://github.com/ggerganov/llama.cpp", topic: "LLM inference in C/C++" },
    { url: "https://github.com/vllm-project/vllm", topic: "High-throughput and memory-efficient LLM serving" },
    { url: "https://github.com/fastapi/fastapi", topic: "FastAPI framework, high performance, easy to learn" },
    { url: "https://github.com/shadcn-ui/ui", topic: "Beautifully designed components that you can copy and paste" }
  ];

  return { ...fallbackRepos[Math.floor(Math.random() * fallbackRepos.length)], fromWatchlist: false };
}

async function executeAutoLearnSession(targetChatId = null) {
  if (isLearning) {
    console.log("[AutoLearn] Sesi belajar sedang berlangsung, melewati panggilan...");
    return { success: false, reason: "in_progress" };
  }

  isLearning = true;
  console.log("[AutoLearn] Memulai sesi pembelajaran otomatis...");

  try {
    const target = await selectNextTarget();
    if (!target || !target.url) {
      isLearning = false;
      return { success: false, reason: "no_target" };
    }

    console.log(`[AutoLearn] Mempelajari target: ${target.url} (${target.topic})...`);

    const isGithub = target.url.includes('github.com') && !target.url.includes('/raw/') && !target.url.includes('gist.');
    let result;

    if (isGithub) {
      result = await knowledgeManager.studyGithubRepo(target.url, target.topic);
    } else {
      result = await knowledgeManager.studyUrl(target.url, target.topic);
    }

    if (result && result.success) {
      settingsManager.setLastAutoLearnAt(Date.now());

      if (target.fromWatchlist) {
        const items = loadWatchlist();
        const found = items.find(i => i.url.toLowerCase() === target.url.toLowerCase());
        if (found) {
          found.status = 'completed';
          found.completedAt = Date.now();
          saveWatchlist(items);
        }
      }

      const entry = result.entry;
      const recipientChatId = targetChatId || (OWNER_IDS.length > 0 ? OWNER_IDS[0] : null);

      if (recipientChatId) {
        const points = entry.keyTakeaways && entry.keyTakeaways.length > 0
          ? entry.keyTakeaways.slice(0, 4).map(p => `• ${p}`).join('\n')
          : "• Analisis arsitektur berhasil disimpan ke memori.";

        const message =
          `🧠 *HERMES HOURLY LEARNING REPORT*\n\n` +
          `Hermes baru saja selesai mempelajari materi open source baru secara otomatis:\n\n` +
          `📌 *Materi:* *${entry.title}*\n` +
          `🏷️ *Kategori:* ${entry.type} [${entry.tags.join(', ')}]\n` +
          `🌐 *Sumber:* ${entry.source}\n\n` +
          `💡 *Poin-Poin Kunci:*\n${points}\n\n` +
          `📝 *Ringkasan Arsitektur:*\n${entry.summary}\n\n` +
          `📂 *Catatan Lengkap:* \`${entry.noteFile}\`\n\n` +
          `🧠 _Materi ini sudah permanen tersimpan di otak Hermes dan siap digunakan. Ketik \`/brain\` untuk melihat seluruh koleksi pengetahuan!_`;

        await safeSendMessage(recipientChatId, message);
      }

      console.log(`[AutoLearn] Sukses mempelajari "${entry.title}"!`);
      isLearning = false;
      return { success: true, entry: result.entry };
    } else {
      console.warn("[AutoLearn] Gagal mempelajari target:", result?.error);
      isLearning = false;
      return { success: false, error: result?.error };
    }
  } catch (err) {
    console.error("[AutoLearn Error]:", err.message);
    isLearning = false;
    return { success: false, error: err.message };
  }
}

function startAutoLearnScheduler() {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
  }

  schedulerIntervalId = setInterval(async () => {
    if (!settingsManager.isAutoLearn()) {
      return;
    }

    const intervalMs = settingsManager.getAutoLearnIntervalHours() * 3600 * 1000;
    const lastAt = settingsManager.getLastAutoLearnAt();
    const now = Date.now();

    if (now - lastAt >= intervalMs) {
      console.log(`[AutoLearn Scheduler] Interval 1 jam tercapai (selisih: ${Math.round((now - lastAt) / 60000)} menit). Menjalankan sesi belajar...`);
      await executeAutoLearnSession();
    }
  }, 60 * 1000);

  console.log(`[AutoLearn Scheduler] Aktif! Interval pengecekan: 60 detik (Interval belajar: ${settingsManager.getAutoLearnIntervalHours()} jam).`);
}

function getAutoLearnStatus() {
  const isEnabled = settingsManager.isAutoLearn();
  const intervalHours = settingsManager.getAutoLearnIntervalHours();
  const lastAt = settingsManager.getLastAutoLearnAt();
  const now = Date.now();

  const nextDueMs = lastAt ? Math.max(0, (lastAt + intervalHours * 3600 * 1000) - now) : 0;
  const nextDueMinutes = Math.round(nextDueMs / 60000);

  return {
    enabled: isEnabled,
    intervalHours,
    lastLearnedAt: lastAt,
    nextDueMinutes,
    isCurrentlyLearning: isLearning
  };
}

module.exports = {
  loadWatchlist,
  saveWatchlist,
  addToWatchlist,
  formatWatchlist,
  selectNextTarget,
  executeAutoLearnSession,
  startAutoLearnScheduler,
  getAutoLearnStatus
};
