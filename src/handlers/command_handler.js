const { safeSendMessage } = require('../core/bot');
const { REMOTE_WORKER_URL } = require('../config/env');
const sessionManager = require('../services/session_manager');
const settingsManager = require('../services/settings_manager');
const knowledgeManager = require('../services/knowledge_manager');
const { executeTool } = require('../tools/dispatcher');
const { renderSettingsPanel, renderSessionsList } = require('../ui/menus');
const { pendingActions } = require('../core/agent');

/**
 * Cek apakah pesan merupakan perintah (command) dan proses jika ya
 * Mengembalikan true jika pesan ditangani sebagai command, false jika obrolan biasa
 */
async function handleCommand(chatId, text) {
  // ── /start: Bantuan Awal ──────────────────────
  if (text.startsWith('/start')) {
    const active = sessionManager.getActiveSession(chatId);
    await safeSendMessage(
      chatId,
      `👋 *Halo! Gw Hermes, AI Developer Agent & Copilot komputermu.*\n\n` +
      `📌 *Sesi Aktif Saat Ini:* "${active.title}"\n\n` +
      `⚡ *Fitur & Perintah Cepat:*\n` +
      `• \`/learn <url>\` : Pelajari repo GitHub, paper ArXiv, Hugging Face, atau link web/artikel apa saja!\n` +
      `• \`/brain\` : Lihat semua materi & skill yang sudah dipelajari permanen\n` +
      `• \`/gpu\` : Cek VRAM, suhu & status GPU NVIDIA RTX 4060 real-time\n` +
      `• \`/env\` : Cek versi Python, PyTorch, CUDA, & uv\n` +
      `• \`/laptop\` : Cek status koneksi laptop utama & worker Tailscale\n` +
      `• \`/sessions\` : Lihat & ganti sesi obrolan yang tersimpan\n` +
      `• \`/new [nama]\` : Buat sesi baru (contoh: \`/new Training Model\`)\n` +
      `• \`/session\` : Info detail sesi yang sedang aktif\n` +
      `• \`/settings\` : Pengaturan bot (Toggle Auto-Accept tanpa konfirmasi manual)\n` +
      `• \`/autoaccept [on/off]\` : Shortcut cepat aktifkan/matikan eksekusi instan\n` +
      `• \`/reset\` : Bersihkan memory sesi saat ini\n\n` +
      `🧠 *Self-Learning & Continuous Intelligence:*\n` +
      `Cukup ketik: _"Hermes tolong pelajarin link https://..."_ atau gunakan \`/learn <link>\`. Hermes bisa mempelajari repo GitHub, paper arXiv, model HuggingFace, dokumentasi teknis, atau artikel tutorial, lalu mengingat intisarinya selamanya!\n\n` +
      `_Tanyakan atau perintahkan apa saja untuk mulai bekerja!_`
    );
    return true;
  }

  // ── /learn: Pelajari Repo GitHub, URL Web, Paper ArXiv, HF, dll. ──
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

  // ── /brain atau /knowledge: Cek Isi Memori ────
  if (text.startsWith('/knowledge') || text === '/brain') {
    const list = knowledgeManager.listKnowledge();
    await safeSendMessage(chatId, list);
    return true;
  }

  // ── /gpu: Cek Status GPU NVIDIA Instan ────────
  if (text === '/gpu') {
    const res = await executeTool('cek_gpu', {});
    await safeSendMessage(chatId, res);
    return true;
  }

  // ── /env: Cek Environment AI & PyTorch ───────
  if (text === '/env') {
    const res = await executeTool('cek_env_dl', {});
    await safeSendMessage(chatId, res);
    return true;
  }

  // ── /laptop atau /status: Cek Status Koneksi Laptop & Worker ──
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

  // ── /sessions: Daftar & Switch Sesi ───────────
  if (text.startsWith('/sessions') || text === '/list') {
    await renderSessionsList(chatId);
    return true;
  }

  // ── /new: Buat Sesi Baru ──────────────────────
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

  // ── /session: Info Sesi Aktif ─────────────────
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

  // ── /rename: Ubah Judul Sesi ──────────────────
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

  // ── /reset: Bersihkan Sesi Aktif ──────────────
  if (text.startsWith('/reset')) {
    const active = sessionManager.resetActiveSession(chatId);
    delete pendingActions[chatId];
    await safeSendMessage(chatId, `🧹 *Memory sesi "${active.title}" telah direset!* Siap mulai topik baru.`);
    return true;
  }

  // ── /settings atau /setting: Panel Pengaturan Bot ──
  if (text === '/settings' || text === '/setting') {
    await renderSettingsPanel(chatId);
    return true;
  }

  // ── /autoaccept & Variasi Teks Pengaturan Auto-Accept ──
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

  return false;
}

module.exports = {
  handleCommand
};
