const { bot, safeSendMessage } = require('../core/bot');
const settingsManager = require('../services/settings_manager');
const sessionManager = require('../services/session_manager');

/**
 * Helper Tampilkan Menu Pengaturan (UI)
 */
async function renderSettingsPanel(chatId, messageId = null) {
  const autoAccept = settingsManager.isAutoAccept();
  const statusBadge = autoAccept ? "🟢 *AKTIF (Auto-Accept ON)*" : "🔴 *NONAKTIF (Human-in-the-Loop)*";
  const desc = autoAccept
    ? "_Semua perintah terminal (PowerShell) & penulisan berkas akan otomatis dieksekusi tanpa jeda konfirmasi manual._"
    : "_Setiap perintah terminal & penulisan berkas akan menanyakan persetujuan (Izinkan/Tolak) sebelum dieksekusi._";

  const text =
    `⚙️ *PENGATURAN BOT HERMES*\n\n` +
    `⚡ *Mode Auto-Accept (Eksekusi Otomatis):*\n` +
    `• Status: ${statusBadge}\n` +
    `• Penjelasan: ${desc}\n\n` +
    `_Gunakan tombol di bawah untuk beralih mode secara instan._`;

  const buttonText = autoAccept ? "🔴 Matikan Auto-Accept (Perlu Izin)" : "🟢 Aktifkan Auto-Accept (Eksekusi Instan)";
  const keyboard = {
    inline_keyboard: [
      [{ text: buttonText, callback_data: "toggle_setting_auto_accept" }],
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
    } catch {
      // Abaikan jika pesan sama atau gagal diedit
    }
  }

  await safeSendMessage(chatId, text, { reply_markup: keyboard });
}

/**
 * Helper Tampilkan Daftar Sesi (UI)
 */
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
  renderSessionsList
};
