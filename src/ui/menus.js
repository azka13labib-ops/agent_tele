const { bot, safeSendMessage } = require('../core/bot');
const settingsManager = require('../services/settings_manager');
const sessionManager = require('../services/session_manager');

async function renderSettingsPanel(chatId, messageId = null) {
  const autoAccept = settingsManager.isAutoAccept();
  const verbose = settingsManager.isVerboseMode();
  const workspace = settingsManager.getWorkspaceDir();

  const autoBadge = autoAccept ? "🟢 *AKTIF (Eksekusi Instan)*" : "🔴 *NONAKTIF (Perlu Konfirmasi)*";
  const autoDesc = autoAccept
    ? "_Perintah terminal & pembuatan file dieksekusi langsung tanpa jeda._"
    : "_Setiap perintah terminal & perubahan file menanyakan izin terlebih dahulu._";

  const verboseBadge = verbose ? "📢 *VERBOSE (Transparan)*" : "🔕 *SILENT / STEALTH (Senyap)*";
  const verboseDesc = verbose
    ? "_Bot mengirim pesan progres setiap langkah tool (baca web, cek file, dll)._"
    : "_Bot hanya menampilkan indikator mengetik dan langsung mengirim jawaban akhir._";

  const autoLearn = settingsManager.isAutoLearn();
  const autoLearnBadge = autoLearn ? "🟢 *AKTIF (1 Jam Sekali)*" : "🔴 *NONAKTIF*";
  const autoLearnDesc = autoLearn
    ? "_Hermes mempelajari repo open source & dev tools baru tiap 1 jam dan melapor ke chat._"
    : "_Pembelajaran otomatis terjadwal sedang dimatikan._";

  const dailyDigest = settingsManager.isDailyDigest();
  const dailyBadge = dailyDigest ? "🟢 *AKTIF (1x Sehari)*" : "🔴 *NONAKTIF*";
  const dailyDesc = dailyDigest
    ? "_Bot mengirim 10 open-source repositori pilihan & 5 berita teknologi terkini setiap 24 jam._"
    : "_Briefing harian 10 repo & 5 berita sedang dinonaktifkan._";

  const text =
    `⚙️ *PENGATURAN BOT HERMES*\n\n` +
    `⚡ *1. Mode Auto-Accept:*\n` +
    `• Status: ${autoBadge}\n` +
    `• Info: ${autoDesc}\n\n` +
    `📢 *2. Notifikasi Progres (Verbose Mode):*\n` +
    `• Status: ${verboseBadge}\n` +
    `• Info: ${verboseDesc}\n\n` +
    `📁 *3. Default Workspace Folder:*\n` +
    `• Direktori: \`${workspace}\`\n` +
    `• Info: _Basis folder kerja untuk terminal PowerShell, pencarian, dan pembuatan file._\n\n` +
    `🧠 *4. Autonomous Hourly Learning:*\n` +
    `• Status: ${autoLearnBadge}\n` +
    `• Topik: _Trending Open Source & Developer Tools_\n` +
    `• Info: ${autoLearnDesc}\n\n` +
    `🌅 *5. Daily Fullstack Digest (10 Repo & 5 Berita):*\n` +
    `• Status: ${dailyBadge}\n` +
    `• Info: ${dailyDesc}\n\n` +
    `_Klik tombol di bawah untuk mengubah setelan secara instan:_`;

  const autoBtnText = autoAccept ? "⚡ Auto-Accept: Matikan" : "⚡ Auto-Accept: Aktifkan";
  const verboseBtnText = verbose ? "🔕 Ubah ke Mode Silent (Senyap)" : "📢 Ubah ke Mode Verbose (Detail)";
  const autoLearnBtnText = autoLearn ? "🧠 Auto-Learn: Matikan" : "🧠 Auto-Learn: Aktifkan (Tiap 1 Jam)";
  const dailyBtnText = dailyDigest ? "🌅 Daily Digest: Matikan" : "🌅 Daily Digest: Aktifkan (1x Sehari)";

  const keyboard = {
    inline_keyboard: [
      [{ text: autoBtnText, callback_data: "toggle_setting_auto_accept" }],
      [{ text: verboseBtnText, callback_data: "toggle_setting_verbose" }],
      [{ text: autoLearnBtnText, callback_data: "toggle_setting_auto_learn" }],
      [{ text: dailyBtnText, callback_data: "toggle_setting_daily_digest" }],
      [{ text: "📁 Ganti Workspace Folder", callback_data: "menu_workspace" }],
      [{ text: "🔄 Refresh Pengaturan", callback_data: "refresh_settings" }]
    ]
  };

  if (messageId) {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      return;
    } catch {}
  }

  await safeSendMessage(chatId, text, { reply_markup: keyboard });
}

async function renderWorkspaceMenu(chatId, messageId = null) {
  const current = settingsManager.getWorkspaceDir();
  const text =
    `📁 *PILIH WORKSPACE DIRECTORY*\n\n` +
    `Folder kerja saat ini:\n\`${current}\`\n\n` +
    `Pilih folder cepat di bawah, atau ketik perintah:\n\`/workspace <path>\`\n_Contoh:_\n\`/workspace c:\\ngodink\\tele-hermes-bot\`\n\`/workspace C:\\Users\\azka\\dl-workspace\``;

  const keyboard = {
    inline_keyboard: [
      [{ text: current.toLowerCase() === 'c:\\ngodink' ? "✅ c:\\ngodink" : "📁 c:\\ngodink", callback_data: "set_ws_ngodink" }],
      [{ text: current.toLowerCase().includes('tele-hermes-bot') ? "✅ tele-hermes-bot" : "📁 tele-hermes-bot", callback_data: "set_ws_hermes" }],
      [{ text: current.toLowerCase().includes('dl-workspace') ? "✅ dl-workspace" : "📁 dl-workspace", callback_data: "set_ws_dl" }],
      [{ text: "🔙 Kembali ke Pengaturan", callback_data: "refresh_settings" }]
    ]
  };

  if (messageId) {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      return;
    } catch {}
  }

  await safeSendMessage(chatId, text, { reply_markup: keyboard });
}

async function renderSessionsList(chatId) {
  const sessions = sessionManager.listSessions(chatId);
  let text = `🗂️ *Daftar Sesi Obrolan Kamu:*\n\n`;

  const keyboardButtons = [];

  sessions.forEach((s, idx) => {
    const badge = s.isActive ? "🟢 *[Aktif]*" : "⚪";
    const dateStr = new Date(s.updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    text += `${idx + 1}. ${badge} *${s.title}*\n   💬 ${s.messageCount} pesan | 🕒 ${dateStr}\n\n`;

    if (!s.isActive) {
      keyboardButtons.push([{ text: `🔄 Beralih ke: ${s.title}`, callback_data: `switch_sess_${s.id}` }]);
    }
  });

  const actionRow = [
    { text: "➕ Sesi Baru", callback_data: "new_sess" },
    { text: "🗑️ Hapus Sesi", callback_data: "manage_delete_sess" }
  ];
  keyboardButtons.push(actionRow);

  await safeSendMessage(chatId, text, {
    reply_markup: { inline_keyboard: keyboardButtons }
  });
}

module.exports = {
  renderSettingsPanel,
  renderWorkspaceMenu,
  renderSessionsList
};

