const { OWNER_IDS } = require('../config/env');
const { safeSendMessage } = require('../core/bot');
const settingsManager = require('./settings_manager');

let isSendingDigest = false;
let digestSchedulerInterval = null;

async function fetchTopFullstackRepos(count = 10) {
  const queries = [
    'topic:developer-tools+stars:>1500',
    'topic:fullstack+stars:>500',
    'topic:nextjs+stars:>1000',
    'topic:typescript+topic:devtools+stars:>1000',
    'topic:web+topic:framework+stars:>2000'
  ];

  const pickedQuery = queries[Math.floor(Math.random() * queries.length)];
  const url = `https://api.github.com/search/repositories?q=${pickedQuery}&sort=updated&order=desc&per_page=15`;

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Hermes-Agent-DailyDigest/2.0',
        'Accept': 'application/vnd.github.v3+json'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!resp.ok) return getDefaultFullstackRepos().slice(0, count);

    const data = await resp.json();
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      return getDefaultFullstackRepos().slice(0, count);
    }

    const repos = data.items.slice(0, count).map(r => ({
      name: r.full_name,
      url: r.html_url,
      stars: r.stargazers_count,
      language: r.language || 'Multi',
      description: r.description ? r.description.replace(/[\r\n]+/g, ' ').trim() : 'Tools produktivitas dan arsitektur fullstack'
    }));

    return repos.length >= 5 ? repos : getDefaultFullstackRepos().slice(0, count);
  } catch (err) {
    console.warn("Error fetching GitHub repos:", err.message);
    return getDefaultFullstackRepos().slice(0, count);
  }
}

function getDefaultFullstackRepos() {
  return [
    { name: "shadcn-ui/ui", url: "https://github.com/shadcn-ui/ui", stars: 75000, language: "TypeScript", description: "Komponen UI modern, fleksibel, dan copy-paste untuk Next.js/React" },
    { name: "astral-sh/uv", url: "https://github.com/astral-sh/uv", stars: 39000, language: "Rust", description: "Package manager & resolver Python ultra-cepat untuk backend/AI services" },
    { name: "fastapi/fastapi", url: "https://github.com/fastapi/fastapi", stars: 78000, language: "Python", description: "Framework API backend modern, cepat, dengan auto-generated docs" },
    { name: "trpc/trpc", url: "https://github.com/trpc/trpc", stars: 35000, language: "TypeScript", description: "End-to-end typesafe APIs untuk stack React, Next.js, dan Node" },
    { name: "prisma/prisma", url: "https://github.com/prisma/prisma", stars: 40000, language: "TypeScript", description: "Next-generation ORM untuk Node.js dan TypeScript" },
    { name: "supabase/supabase", url: "https://github.com/supabase/supabase", stars: 73000, language: "TypeScript", description: "Backend open-source alternatif Firebase berbasis PostgreSQL" },
    { name: "payloadcms/payload", url: "https://github.com/payloadcms/payload", stars: 30000, language: "TypeScript", description: "Headless CMS & App Framework berbasis Next.js dan TypeScript" },
    { name: "tailwindlabs/tailwindcss", url: "https://github.com/tailwindlabs/tailwindcss", stars: 82000, language: "CSS", description: "Utility-first CSS framework untuk desain antarmuka cepat" },
    { name: "TanStack/query", url: "https://github.com/TanStack/query", stars: 43000, language: "TypeScript", description: "Powerful asynchronous state management untuk React, Vue, Svelte" },
    { name: "honojs/hono", url: "https://github.com/honojs/hono", stars: 22000, language: "TypeScript", description: "Ultrafast web framework untuk Cloudflare Workers, Node, Deno, Bun" }
  ];
}

async function fetchTopTechNews(count = 5) {
  try {
    const resp = await fetch('https://dev.to/api/articles?tag=webdev&top=1&per_page=7', {
      headers: { 'User-Agent': 'Hermes-Agent-DailyDigest/2.0' },
      signal: AbortSignal.timeout(12000)
    });

    if (!resp.ok) return getDefaultTechNews().slice(0, count);

    const articles = await resp.json();
    if (!Array.isArray(articles) || articles.length === 0) {
      return getDefaultTechNews().slice(0, count);
    }

    const news = articles.slice(0, count).map(a => ({
      title: a.title,
      url: a.url,
      description: a.description || a.title,
      author: a.user?.name || "Dev Community"
    }));

    return news;
  } catch (err) {
    console.warn("Error fetching tech news:", err.message);
    return getDefaultTechNews().slice(0, count);
  }
}

function getDefaultTechNews() {
  return [
    { title: "Next.js 15 Release: Turbopack, React 19 Support, and Async Request APIs", url: "https://nextjs.org/blog", description: "Fitur baru pada Next.js 15 mempercepat build time hingga 70% dan menyederhanakan caching.", author: "Next.js Team" },
    { title: "The State of AI Agents in Modern Software Engineering", url: "https://dev.to", description: "Bagaimana autonomous agentic coding merevolusi testing, refactoring, dan automation pipeline.", author: "Tech Insights" },
    { title: "PostgreSQL 17 Released: Significant Performance Improvements and JSON Enhancements", url: "https://postgresql.org", description: "Upgrade performa memori query, logical replication failover, dan JSON_TABLE standard SQL.", author: "PostgreSQL Global" },
    { title: "TypeScript 5.6: Disallowed Nullish Checks and Region-Style Diagnostic Reporting", url: "https://devblogs.microsoft.com/typescript", description: "Pemeriksaan tipe data semakin ketat untuk mencegah bug tersembunyi pada logika conditional.", author: "Microsoft TS" },
    { title: "Tailwind CSS v4.0 Alpha: Built from Scratch for Speed with CSS-First Configuration", url: "https://tailwindcss.com/blog", description: "Engine baru berbasis Oxide tanpa config JavaScript, rendering build instan.", author: "Tailwind Labs" }
  ];
}

async function sendDailyDigest(forcedChatId = null) {
  if (isSendingDigest) {
    console.log("[DailyDigest] Sedang mengirim digest, melewati...");
    return { success: false, reason: "in_progress" };
  }

  isSendingDigest = true;
  console.log("[DailyDigest] Mengumpulkan 10 repositori fullstack & 5 berita teknologi...");

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

    const dateStr = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let reposText =
      `🌅 *HERMES DAILY BRIEFING — FULLSTACK DEVELOPER DIGEST*\n` +
      `📅 *${dateStr}*\n\n` +
      `🚀 *TOP 10 OPEN SOURCE REPOSITORIES PILIHAN UNTUK FULLSTACK:*\n` +
      `_Koleksi tools, library, dan arsitektur pilihan untuk meningkatkan produktivitas harianmu:_\n\n`;

    repos.forEach((r, idx) => {
      const starsFormatted = r.stars >= 1000 ? `${(r.stars / 1000).toFixed(1)}k` : r.stars;
      reposText += `${idx + 1}. 📦 *[${r.name}](${r.url})* (⭐ ${starsFormatted} | \`${r.language}\`)\n`;
      reposText += `   💡 *Fungsi:* ${r.description}\n\n`;
    });

    let newsText =
      `📰 *5 BERITA & TREND TEKNOLOGI TERBARU:*\n` +
      `_Update terkini seputar ekosistem web, AI developer, dan software engineering:_\n\n`;

    news.forEach((n, idx) => {
      newsText += `${idx + 1}. ⚡ *[${n.title}](${n.url})*\n`;
      newsText += `   📝 *Intisari:* ${n.description}\n`;
      if (n.author) newsText += `   👤 _Sumber: ${n.author}_\n\n`;
    });

    newsText +=
      `🧠 *Langkah Selanjutnya:*\n` +
      `Ingin Hermes mempelajari lebih dalam salah satu repo di atas?\n` +
      `• Ketik: \`/learn <url-repo>\`\n` +
      `• Atau masukkan ke antrean: \`/watchlist add <url-repo>\``;

    await safeSendMessage(targetChatId, reposText);
    await safeSendMessage(targetChatId, newsText);

    settingsManager.setLastDailyDigestAt(Date.now());
    isSendingDigest = false;
    console.log("[DailyDigest] Berhasil dikirim ke Telegram!");
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
  sendDailyDigest,
  startDailyDigestScheduler
};
