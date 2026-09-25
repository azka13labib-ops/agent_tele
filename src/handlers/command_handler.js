const { safeSendMessage } = require('../core/bot');
const { REMOTE_WORKER_URL } = require('../config/env');
const sessionManager = require('../services/session_manager');
const settingsManager = require('../services/settings_manager');
const knowledgeManager = require('../services/knowledge_manager');
const { executeTool } = require('../tools/dispatcher');
const { renderSettingsPanel, renderSessionsList } = require('../ui/menus');
const { pendingActions } = require('../core/agent');
const autoLearnService = require('../services/auto_learn_service');
const dailyDigestService = require('../services/daily_digest_service');
const codeReviewerService = require('../services/code_reviewer_service');
const quizService = require('../services/quiz_service');
const doctorService = require('../services/doctor_service');

async function handleCommand(chatId, text) {

  if (text.startsWith('/start')) {
    const active = sessionManager.getActiveSession(chatId);
    await safeSendMessage(
      chatId,
      `👋 *Halo! Gw Hermes, AI Developer Agent & Copilot komputermu.*\n\n` +
      `📌 *Sesi Aktif Saat Ini:* "${active.title}"\n\n` +
      `⚡ *Fitur & Perintah Cepat:*\n` +
      `• \`/learn <url>\` : Pelajari repo GitHub, paper ArXiv, Hugging Face, atau link web/artikel apa saja!\n` +
      `• \`/digest\` : Dapatkan 10 AI repo open source & 5 berita AI hari ini (otomatis dipelajari Hermes)\n` +
      `• \`/review [file/code]\` : Senior Code Review & Security Audit mendalam untuk kode Anda\n` +
      `• \`/doctor <error log>\` : Diagnosis akar masalah bug & rekomendasi perbaikan kode instan\n` +
      `• \`/quiz [topik]\` : Latihan studi kasus arsitektur & system design interaktif\n` +
      `• 🎙️ *Voice Note:* Kirim pesan suara kapan saja untuk dieksekusi via Whisper AI\n` +
      `• \`/daily [on/off/now]\` : Pengaturan briefing harian AI (10 AI repo & 5 berita)\n` +
      `• \`/brain\` : Lihat semua materi & skill yang sudah dipelajari permanen\n` +
      `• \`/gpu\` : Cek VRAM, suhu & status GPU NVIDIA RTX 4060 real-time\n` +
      `• \`/env\` : Cek versi Python, PyTorch, CUDA, & uv\n` +
      `• \`/laptop\` : Cek status koneksi laptop utama & worker Tailscale\n` +
      `• \`/sessions\` : Lihat & ganti sesi obrolan yang tersimpan\n` +
      `• \`/new [nama]\` : Buat sesi baru (contoh: \`/new Training Model\`)\n` +
      `• \`/session\` : Info detail sesi yang sedang aktif\n` +
      `• \`/settings\` : Pengaturan bot (Auto-Accept, Verbose, & Workspace)\n` +
      `• \`/workspace [path]\` : Cek atau ganti direktori kerja aktif\n` +
      `• \`/autolearn [on/off/now]\` : Pengaturan belajar mandiri tiap 1 jam\n` +
      `• \`/watchlist [add/list]\` : Kelola daftar prioritas belajar Hermes\n` +
      `• \`/autoaccept [on/off]\` : Shortcut aktifkan/matikan eksekusi instan\n` +
      `• \`/verbose [on/off]\` : Atur pesan progres (transparan / senyap)\n` +
      `• \`/reset\` : Bersihkan memory sesi saat ini\n\n` +
      `🧠 *Self-Learning & Continuous Intelligence:*\n` +
      `Cukup ketik: _"Hermes tolong pelajarin link https://..."_ atau gunakan \`/learn <link>\`. Hermes bisa mempelajari repo GitHub, paper arXiv, model HuggingFace, dokumentasi teknis, atau artikel tutorial, lalu mengingat intisarinya selamanya!\n\n` +
      `_Tanyakan atau perintahkan apa saja untuk mulai bekerja!_`
    );
    return true;
  }

  if (text.startsWith('/learn')) {
    const targetUrl = text.replace(/^\/learn/, '').trim();
    if (!targetUrl) {
      await safeSendMessage(
        chatId,
        `📚 *Perintah /learn (Autonomous Continuous Learning)*\n\n` +
        `Ketik: \`/learn <link apa saja>\`\n\n` +
        `💡 *Bisa mempelajari berbagai jenis sumber:*\n` +
        `• 🐙 *GitHub Repo:* \`/learn https://github.com/karpathy/nanoGPT\`\n` +
        `• 📄 *Paper Ilmiah ArXiv:* \`/learn https://arxiv.org/abs/1706.03762\`\n` +
        `• 🤗 *Hugging Face:* \`/learn https://huggingface.co/meta-llama/Llama-3-8B\`\n` +
        `• 🌐 *Dokumentasi Web:* \`/learn https://pytorch.org/docs/stable/torch.html\`\n` +
        `• ✍️ *Artikel / Blog:* \`/learn https://medium.com/... atau dev.to/...\`\n` +
        `• 💻 *Raw Code / Gist:* \`/learn https://raw.githubusercontent.com/.../train.py\`\n\n` +
        `Hermes akan mengunduh, menganalisis materi teknisnya, merangkum teknik kuncinya, dan mengingatnya selamanya di seluruh sesi obrolan!`
      );
      return true;
    }

    if (targetUrl.includes('github.com') && !targetUrl.includes('/raw/') && !targetUrl.includes('gist.github.com')) {
      await safeSendMessage(chatId, `🐙 *Mulai mempelajari repositori GitHub:* \`${targetUrl}\`...\n_Sedang mengklon dan menganalisis arsitektur berkas kode..._`);
      const res = await knowledgeManager.studyGithubRepo(targetUrl);
      if (res.success) {
        await safeSendMessage(
          chatId,
          `✅ *BERHASIL MEMPELAJARI REPO!*\n\n` +
          `📌 *Nama:* ${res.entry.title}\n` +
          `🏷️ *Tags:* ${res.entry.tags.join(', ')}\n\n` +
          `📝 *Ringkasan Arsitektur:*\n${res.entry.summary}\n\n` +
          `💡 *Poin Kunci:*\n• ${res.entry.keyTakeaways.join('\n• ')}\n\n` +
          `📂 *Catatan Lengkap:* \`${res.entry.noteFile}\`\n\n` +
          `🧠 _Pengetahuan ini sudah tersimpan permanen di memori Hermes dan siap digunakan di seluruh sesi obrolan!_`
        );
      } else {
        await safeSendMessage(chatId, `❌ *Gagal mempelajari repo:*\n${res.error}`);
      }
      return true;
    } else {
      const typeLabel =
        targetUrl.includes('arxiv.org') ? '📄 Paper Ilmiah ArXiv' :
        targetUrl.includes('huggingface.co') ? '🤗 Model / Dataset Hugging Face' :
        targetUrl.includes('raw.') || targetUrl.includes('gist.') ? '💻 File Kode / Script' :
        '🌐 Dokumen Web / Artikel';

      await safeSendMessage(chatId, `⏳ *Mulai mempelajari ${typeLabel}:* \`${targetUrl}\`...\n_Sedang mengekstrak dan menganalisis materi teknis..._`);
      const res = await knowledgeManager.studyUrl(targetUrl);
      if (res.success) {
        let textResult =
          `✅ *BERHASIL MEMPELAJARI MATERI!*\n\n` +
          `📌 *Judul:* ${res.entry.title}\n` +
          `🏷️ *Tipe:* ${res.entry.type} [${res.entry.tags.join(', ')}]\n` +
          `🌐 *Sumber:* ${res.entry.source}\n\n` +
          `📝 *Ringkasan:*\n${res.entry.summary}\n\n`;

        if (res.entry.keyTakeaways && res.entry.keyTakeaways.length > 0) {
          textResult += `💡 *Poin Kunci:*\n• ${res.entry.keyTakeaways.join('\n• ')}\n\n`;
        }

        textResult +=
          `📂 *Catatan Lengkap:* \`${res.entry.noteFile}\`\n\n` +
          `🧠 _Pengetahuan ini sudah tersimpan permanen di memori Hermes dan siap digunakan di seluruh sesi obrolan!_`;

        await safeSendMessage(chatId, textResult);
      } else {
        await safeSendMessage(chatId, `❌ *Gagal mempelajari URL:*\n${res.error}`);
      }
      return true;
    }
  }

  if (text.startsWith('/knowledge') || text === '/brain') {
    const list = knowledgeManager.listKnowledge();
    await safeSendMessage(chatId, list);
    return true;
  }

  if (text === '/gpu') {
    const res = await executeTool('cek_gpu', {});
    await safeSendMessage(chatId, res);
    return true;
  }

  if (text === '/env') {
    const res = await executeTool('cek_env_dl', {});
    await safeSendMessage(chatId, res);
    return true;
  }

  if (text === '/laptop' || text === '/status') {
    const isRemote = Boolean(REMOTE_WORKER_URL);
    if (!isRemote) {
      const gpuInfo = await executeTool('cek_gpu', {});
      await safeSendMessage(
        chatId,
        `💻 *Mode Hermes:* Berjalan Langsung di Laptop Lokal\n` +
        `📡 *Koneksi:* Langsung (Localhost)\n\n` +
        `${gpuInfo}`
      );
      return true;
    }

    try {
      const startT = Date.now();
      const resp = await fetch(`${REMOTE_WORKER_URL}/health`, { signal: AbortSignal.timeout(4000) });
      const latency = Date.now() - startT;
      if (resp.ok) {
        const data = await resp.json();
        await safeSendMessage(
          chatId,
          `🟢 *Laptop Utama Terhubung via Tailscale!*\n\n` +
          `• *Host Laptop:* \`${data.hostname}\` (${data.platform})\n` +
          `• *Worker URL:* \`${REMOTE_WORKER_URL}\`\n` +
          `• *Latency:* ${latency} ms\n` +
          `• *Status:* Online & Siap Eksekusi GPU / Kode / File\n\n` +
          `_Hermes di server dapat menjalankan perintah terminal, script PyTorch, dan GPU RTX 4060 di laptopmu._`
        );
      }
    } catch (err) {
      await safeSendMessage(
        chatId,
        `🔴 *Laptop Utama Tidak Terjangkau (Offline / Sleep)*\n\n` +
        `• *Target Worker:* \`${REMOTE_WORKER_URL}\`\n` +
        `• *Error:* ${err.message}\n\n` +
        `_Bot tetap aktif di server untuk obrolan teks, namun perintah yang membutuhkan GPU atau akses file di laptop sedang tidak dapat dijalankan._`
      );
    }
    return true;
  }

  if (text.startsWith('/sessions') || text === '/list') {
    await renderSessionsList(chatId);
    return true;
  }

  if (text.startsWith('/new')) {
    const customTitle = text.replace(/^\/new/, '').trim();
    const newSession = sessionManager.createSession(chatId, customTitle);
    delete pendingActions[chatId];
    await safeSendMessage(
      chatId,
      `✨ *Sesi Baru Dibuat & Aktif!*\n` +
      `📌 Judul: *${newSession.title}*\n` +
      `Memory percakapan sekarang bersih dan terpisah dari sesi sebelumnya.`
    );
    return true;
  }

  if (text === '/session') {
    const active = sessionManager.getActiveSession(chatId);
    const userMsgCount = active.messages.filter(m => m.role === 'user').length;
    const dateStr = new Date(active.updatedAt).toLocaleString('id-ID');
    await safeSendMessage(
      chatId,
      `📌 *Info Sesi Aktif:*\n` +
      `• *Judul:* ${active.title}\n` +
      `• *ID Sesi:* \`${active.id}\`\n` +
      `• *Jumlah Pesan:* ${userMsgCount}\n` +
      `• *Terakhir Diperbarui:* ${dateStr}\n\n` +
      `_Gunakan \`/sessions\` untuk beralih sesi atau \`/rename\` untuk mengubah judul._`
    );
    return true;
  }

  if (text.startsWith('/rename')) {
    const newTitle = text.replace(/^\/rename/, '').trim();
    if (!newTitle) {
      await safeSendMessage(chatId, "⚠️ Masukkan nama baru! Contoh: `/rename Debug API Auth`");
      return true;
    }
    const active = sessionManager.getActiveSession(chatId);
    sessionManager.renameSession(chatId, active.id, newTitle);
    await safeSendMessage(chatId, `✏️ *Nama sesi berhasil diubah:* "${newTitle}"`);
    return true;
  }

  if (text.startsWith('/reset')) {
    const active = sessionManager.resetActiveSession(chatId);
    delete pendingActions[chatId];
    await safeSendMessage(chatId, `🧹 *Memory sesi "${active.title}" telah direset!* Siap mulai topik baru.`);
    return true;
  }

  if (text === '/settings' || text === '/setting') {
    await renderSettingsPanel(chatId);
    return true;
  }

  const lowerText = text.toLowerCase().trim();
  if (
    lowerText.startsWith('/autoaccept') ||
    lowerText.startsWith('autoaccept') ||
    lowerText.startsWith('auto accept') ||
    lowerText.startsWith('auto-accept') ||
    lowerText === 'aktifkan auto accept' ||
    lowerText === 'nyalakan auto accept' ||
    lowerText === 'matikan auto accept' ||
    lowerText === 'turn on auto accept' ||
    lowerText === 'turn off auto accept'
  ) {
    let newStatus;
    if (
      lowerText.includes('on') || lowerText.includes('aktif') || lowerText.includes('true') ||
      lowerText.includes('enable') || lowerText.includes('1') || lowerText.startsWith('aktifkan') ||
      lowerText.startsWith('nyalakan') || lowerText.includes('turn on')
    ) {
      newStatus = settingsManager.setAutoAccept(true);
    } else if (
      lowerText.includes('off') || lowerText.includes('mati') || lowerText.includes('false') ||
      lowerText.includes('disable') || lowerText.includes('0') || lowerText.startsWith('matikan') ||
      lowerText.includes('turn off')
    ) {
      newStatus = settingsManager.setAutoAccept(false);
    } else {
      newStatus = settingsManager.toggleAutoAccept();
    }

    const statusText = newStatus ? "🟢 *AKTIF (Eksekusi Instan Tanpa Konfirmasi)*" : "🔴 *NONAKTIF (Meminta Konfirmasi Manual)*";
    await safeSendMessage(
      chatId,
      `⚙️ *Pengaturan Auto-Accept Berhasil Diubah!*\n\n` +
      `• Status: ${statusText}\n\n` +
      `_Gunakan \`/settings\` untuk membuka menu pengaturan interaktif._`
    );
    return true;
  }

  if (
    lowerText.startsWith('/verbose') ||
    lowerText.startsWith('/silent') ||
    lowerText.startsWith('/stealth') ||
    lowerText.startsWith('verbose') ||
    lowerText === 'mode silent' ||
    lowerText === 'mode verbose' ||
    lowerText === 'aktifkan silent' ||
    lowerText === 'matikan verbose'
  ) {
    let newStatus;
    if (
      lowerText.startsWith('/silent') || lowerText.startsWith('/stealth') ||
      lowerText.includes('silent') || lowerText.includes('off') ||
      lowerText.includes('mati') || lowerText.includes('senyap') || lowerText.includes('false')
    ) {
      newStatus = settingsManager.setVerboseMode(false);
    } else if (
      lowerText.includes('on') || lowerText.includes('aktif') ||
      lowerText.includes('transparan') || lowerText.includes('true') || lowerText.includes('detail')
    ) {
      newStatus = settingsManager.setVerboseMode(true);
    } else {
      newStatus = settingsManager.toggleVerboseMode();
    }

    const statusText = newStatus
      ? "📢 *Mode Verbose AKTIF!*\n_Bot akan mengirim pesan status perantara setiap kali menjalankan tool (transparan)._"
      : "🔕 *Mode Silent / Stealth AKTIF!*\n_Bot akan menjalankan tool secara senyap dan langsung mengirimkan jawaban akhir._";

    await safeSendMessage(
      chatId,
      `⚙️ *Notifikasi Progres Berhasil Diubah!*\n\n` +
      `• Status: ${statusText}\n\n` +
      `_Gunakan \`/settings\` untuk membuka menu pengaturan interaktif._`
    );
    return true;
  }

  if (lowerText.startsWith('/workspace') || lowerText.startsWith('/ws')) {
    const rawArg = text.replace(/^\/(workspace|ws)/i, '').trim();
    if (!rawArg) {
      const current = settingsManager.getWorkspaceDir();
      await safeSendMessage(
        chatId,
        `📁 *Workspace Hermes Saat Ini:*\n\n` +
        `• Direktori: \`${current}\`\n\n` +
        `_Untuk mengganti direktori kerja, ketik:_\n\`/workspace <path>\`\n_Contoh:_\n\`/workspace c:\\ngodink\\tele-hermes-bot\`\n\`/workspace C:\\Users\\azka\\dl-workspace\`\n\n` +
        `_Atau gunakan menu tombol di \`/settings\`._`
      );
      return true;
    }

    const updated = settingsManager.setWorkspaceDir(rawArg);
    await safeSendMessage(
      chatId,
      `📁 *Direktori Workspace Berhasil Diubah!*\n\n` +
      `• Folder Aktif: \`${updated}\`\n\n` +
      `_Semua perintah PowerShell, pencarian berkas, dan operasi file sekarang menggunakan direktori ini sebagai basis._`
    );
    return true;
  }

  if (lowerText.startsWith('/autolearn')) {
    const arg = text.replace(/^\/autolearn/i, '').trim().toLowerCase();
    if (arg === 'on' || arg === 'aktif' || arg === 'start') {
      settingsManager.setAutoLearn(true);
      await safeSendMessage(
        chatId,
        `🧠 *Autonomous Hourly Learning Diaktifkan!*\n\n` +
        `• Status: 🟢 AKTIF\n` +
        `• Interval: Setiap 1 Jam\n` +
        `• Fokus: Trending Open Source & Developer Tools\n\n` +
        `_Hermes akan mencari materi/repo baru tiap 1 jam dan mengirimkan laporan ke chat ini._`
      );
      return true;
    }

    if (arg === 'off' || arg === 'mati' || arg === 'stop') {
      settingsManager.setAutoLearn(false);
      await safeSendMessage(
        chatId,
        `⏸️ *Autonomous Hourly Learning Dinonaktifkan!*\n\n` +
        `• Status: 🔴 NONAKTIF\n\n` +
        `_Ketik \`/autolearn on\` untuk mengaktifkan kembali._`
      );
      return true;
    }

    if (arg === 'now' || arg === 'sekarang' || arg === 'trigger') {
      await safeSendMessage(
        chatId,
        `⏳ *Memulai sesi belajar mandiri sekarang...*\n_Hermes sedang mencari materi/repo open source baru..._`
      );
      autoLearnService.executeAutoLearnSession(chatId).then(res => {
        if (!res.success && res.reason !== 'in_progress') {
          safeSendMessage(chatId, `⚠️ Belajar mandiri selesai tanpa materi baru: ${res.error || res.reason}`);
        }
      });
      return true;
    }

    const status = autoLearnService.getAutoLearnStatus();
    const badge = status.enabled ? "🟢 *AKTIF (Setiap 1 Jam)*" : "🔴 *NONAKTIF*";
    const lastStr = status.lastLearnedAt ? new Date(status.lastLearnedAt).toLocaleString('id-ID') : "Belum pernah";
    const nextStr = status.enabled
      ? (status.nextDueMinutes <= 0 ? "Segera berjalan..." : `Sekitar ${status.nextDueMinutes} menit lagi`)
      : "Dimatikan";

    await safeSendMessage(
      chatId,
      `🧠 *Status Pembelajaran Mandiri (Auto-Learn)*\n\n` +
      `• *Status:* ${badge}\n` +
      `• *Interval:* ${status.intervalHours} Jam Sekali\n` +
      `• *Fokus:* Trending Open Source & Developer Tools\n` +
      `• *Terakhir Belajar:* ${lastStr}\n` +
      `• *Jadwal Berikutnya:* ${nextStr}\n` +
      `• *Sedang Berjalan:* ${status.isCurrentlyLearning ? "Ya ⏳" : "Tidak"}\n\n` +
      `⚡ *Perintah Kontrol:*\n` +
      `• \`/autolearn on\` : Aktifkan belajar tiap 1 jam\n` +
      `• \`/autolearn off\` : Matikan belajar otomatis\n` +
      `• \`/autolearn now\` : Paksa belajar 1 materi sekarang juga\n` +
      `• \`/watchlist\` : Cek & kelola antrean materi prioritas`
    );
    return true;
  }

  if (lowerText.startsWith('/watchlist')) {
    const subCmd = text.replace(/^\/watchlist/i, '').trim();
    if (subCmd.toLowerCase().startsWith('add ')) {
      const raw = subCmd.substring(4).trim();
      const parts = raw.split(/\s+/);
      const targetUrl = parts[0];
      const topic = parts.slice(1).join(' ');

      if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
        await safeSendMessage(chatId, "⚠️ Masukkan URL valid! Contoh: `/watchlist add https://github.com/astral-sh/uv Python Tooling`");
        return true;
      }

      const res = autoLearnService.addToWatchlist(targetUrl, topic);
      await safeSendMessage(
        chatId,
        `✅ *Link Berhasil Dimasukkan ke Watchlist!*\n\n` +
        `• URL: \`${targetUrl}\`\n` +
        `• Topik: _${topic || 'General'}_\n\n` +
        `_Link ini akan dipelajari Hermes pada jadwal sesi belajar berikutnya._`
      );
      return true;
    }

    if (subCmd.toLowerCase() === 'clear') {
      autoLearnService.saveWatchlist([]);
      await safeSendMessage(chatId, "🧹 *Watchlist berhasil dikosongkan!*");
      return true;
    }

    const listText = autoLearnService.formatWatchlist();
    await safeSendMessage(chatId, listText);
    return true;
  }

  const isDigestTrigger =
    lowerText.startsWith('/digest') ||
    lowerText.startsWith('/diggest') ||
    lowerText.startsWith('/daily') ||
    lowerText.startsWith('/dailydigest') ||
    lowerText === 'digest' ||
    lowerText === 'diggest' ||
    lowerText.includes('mana berita') ||
    lowerText.includes('mana repo') ||
    lowerText.includes('maksud saya digest') ||
    lowerText.includes('maksud says diggest') ||
    lowerText.includes('kirim digest') ||
    lowerText.includes('minta digest') ||
    lowerText.includes('berita dan repo');

  if (isDigestTrigger) {
    const subCmd = text.replace(/^\/(digest|diggest|daily|dailydigest)/i, '').trim().toLowerCase();
    if (subCmd === 'on' || subCmd === 'aktif') {
      settingsManager.setDailyDigest(true);
      await safeSendMessage(
        chatId,
        `🤖 *Daily AI Intelligence Digest Diaktifkan!*\n\n` +
        `• Status: 🟢 AKTIF\n` +
        `• Jadwal: Setiap 24 jam sekali\n` +
        `• Konten: 10 AI repo open-source terbaik + 5 berita AI terkini\n` +
        `• Pembelajaran: Otomatis disimpan ke memori permanen (` + '`/brain`' + `)\n\n` +
        `_Ketik \`/digest now\` untuk mendapatkan briefing sekarang juga._`
      );
      return true;
    }

    if (subCmd === 'off' || subCmd === 'matikan') {
      settingsManager.setDailyDigest(false);
      await safeSendMessage(
        chatId,
        `⏸️ *Daily AI Digest Dinonaktifkan!*\n\n` +
        `• Status: 🔴 NONAKTIF\n\n` +
        `_Ketik \`/daily on\` untuk mengaktifkan kembali._`
      );
      return true;
    }

    await safeSendMessage(
      chatId,
      `⏳ *Menyiapkan Daily AI Digest hari ini...*\n_Hermes sedang mengkurasi 10 open-source AI repositories & 5 berita AI terkini, menerjemahkan fungsi ke Bahasa Indonesia, dan menyimpannya ke memori (/brain)..._`
    );
    dailyDigestService.sendDailyDigest(chatId).then(res => {
      if (!res.success && res.reason !== 'in_progress') {
        safeSendMessage(chatId, `⚠️ Gagal mengirim digest: ${res.error || res.reason}`);
      }
    });
    return true;

    const isDaily = settingsManager.isDailyDigest();
    const lastAt = settingsManager.getLastDailyDigestAt();
    const lastStr = lastAt ? new Date(lastAt).toLocaleString('id-ID') : "Belum pernah";

    await safeSendMessage(
      chatId,
      `🤖 *Pengaturan Daily AI Intelligence Digest*\n\n` +
      `• *Status:* ${isDaily ? '🟢 AKTIF (1x Sehari)' : '🔴 NONAKTIF'}\n` +
      `• *Terakhir Terkirim:* ${lastStr}\n` +
      `• *Isi:* 10 Repository AI Open Source + 5 Berita AI Terkini\n` +
      `• *Auto-Learn:* Otomatis dipelajari dan diindeks ke memori permanen\n\n` +
      `⚡ *Perintah Kontrol:*\n` +
      `• \`/digest now\` : Kirim briefing & pelajari sekarang juga\n` +
      `• \`/daily on\` : Aktifkan pengiriman otomatis tiap 24 jam\n` +
      `• \`/daily off\` : Matikan pengiriman harian`
    );
    return true;
  }

  if (lowerText.startsWith('/review')) {
    const arg = text.replace(/^\/review/i, '').trim();
    if (!arg) {
      await safeSendMessage(chatId, "🔍 *Memulai Code Review file terbaru di workspace...*\n_Hermes sedang mengaudit keamanan, potensi bug, performa, dan arsitektur kode..._");
      const res = await codeReviewerService.reviewRecentWorkspaceCode();
      if (res.success) {
        await safeSendMessage(chatId, res.reviewText);
      } else {
        await safeSendMessage(chatId, `⚠️ ${res.error}\n\n_Tips: Gunakan \`/review <nama_file>\` atau \`/review <paste kode>\`_`);
      }
      return true;
    }

    if (arg.includes('\n') || arg.includes('{') || arg.includes('function') || arg.includes('const ') || arg.includes('def ')) {
      await safeSendMessage(chatId, "🔍 *Menganalisis cuplikan kode...*\n_Sedang mengaudit keamanan, potensi bug, dan arsitektur..._");
      const res = await codeReviewerService.reviewCodeSnippet(arg);
      if (res.success) {
        await safeSendMessage(chatId, res.reviewText);
      } else {
        await safeSendMessage(chatId, `⚠️ ${res.error}`);
      }
      return true;
    }

    await safeSendMessage(chatId, `🔍 *Menganalisis file:* \`${arg}\`...\n_Sedang mengaudit keamanan, potensi bug, dan arsitektur..._`);
    const res = await codeReviewerService.reviewWorkspaceFile(arg);
    if (res.success) {
      await safeSendMessage(chatId, res.reviewText);
    } else {
      await safeSendMessage(chatId, `⚠️ ${res.error}`);
    }
    return true;
  }

  if (lowerText.startsWith('/quiz')) {
    const topic = text.replace(/^\/quiz/i, '').trim();
    await safeSendMessage(chatId, "🎯 *Menyiapkan soal studi kasus arsitektur & system design...*\n_Mengambil materi terkini dari memori pengetahuan Hermes..._");
    const res = await quizService.generateQuizQuestion(chatId, topic);
    if (res.success) {
      const q = res.quiz;
      let qText = `🎯 *ARSITEKTUR & SYSTEM DESIGN QUIZ*\n\n📌 *Topik:* ${q.topic}\n\n${q.question}\n\n`;
      const letterMap = ['A', 'B', 'C', 'D'];
      q.options.forEach((opt, idx) => {
        qText += `*${letterMap[idx]}.* ${opt}\n\n`;
      });
      const keyboard = {
        inline_keyboard: [
          [
            { text: "A", callback_data: "quiz_ans_0" },
            { text: "B", callback_data: "quiz_ans_1" },
            { text: "C", callback_data: "quiz_ans_2" },
            { text: "D", callback_data: "quiz_ans_3" }
          ]
        ]
      };
      await safeSendMessage(chatId, qText, { reply_markup: keyboard });
    } else {
      await safeSendMessage(chatId, `⚠️ ${res.error}`);
    }
    return true;
  }

  if (lowerText.startsWith('/doctor')) {
    const errorLog = text.replace(/^\/doctor/i, '').trim();
    if (!errorLog) {
      await safeSendMessage(
        chatId,
        `🩺 *Hermes Emergency Bug Doctor & Fixer*\n\n` +
        `Gunakan fitur ini untuk mendiagnosis crash log atau stack trace error secara instan:\n\n` +
        `• *Format:* \`/doctor <paste error log atau stack trace>\`\n` +
        `• *Contoh:*\n` +
        `  \`/doctor TypeError: Cannot read properties of undefined (reading 'map') at app.js:42:10\`\n\n` +
        `Hermes akan otomatis mendiagnosis akar masalah, membaca file sumber di workspace, dan memberikan rekomendasi kode perbaikan konkret.`
      );
      return true;
    }

    await safeSendMessage(chatId, "🩺 *Memeriksa error log & stack trace...*\n_Hermes sedang melacak file sumber dan mendiagnosis akar masalah..._");
    const res = await doctorService.diagnoseError(errorLog);
    if (res.success) {
      await safeSendMessage(chatId, res.diagnosisText);
    } else {
      await safeSendMessage(chatId, `⚠️ ${res.error}`);
    }
    return true;
  }

  return false;
}

module.exports = {
  handleCommand
};

