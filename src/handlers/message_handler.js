const { safeSendMessage } = require('../core/bot');
const { isAuthorized } = require('../config/env');
const sessionManager = require('../services/session_manager');
const settingsManager = require('../services/settings_manager');
const { handleCommand } = require('./command_handler');
const { pendingActions, handleUserConfirmation, runAgentLoop } = require('../core/agent');

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const senderId = String(msg.from ? msg.from.id : chatId);
  const text = (msg.text || '').trim();

  if (!text) return;

  // ── Keamanan Whitelist / Access Control ───────
  if (!isAuthorized(senderId)) {
    console.warn(`[Security Alert] Akses ditolak dari Telegram ID: ${senderId} (@${msg.from?.username || 'unknown'}) | Pesan: "${text}"`);
    return safeSendMessage(
      chatId,
      `⛔ *AKSES DITOLAK (ACCESS RESTRICTED)*\n\n` +
      `Maaf, bot Hermes ini adalah asisten pribadi *privat* yang terhubung langsung ke komputer dan proyek lokal pemilik.\n\n` +
      `Telegram ID Anda: \`${senderId}\` *(Tidak terdaftar dalam Whitelist)*.\n\n` +
      `_Akses ditutup demi keamanan sistem._`
    );
  }

  // ── Tangani Perintah & Shortcut Cepat ────────
  const isCommandHandled = await handleCommand(chatId, text);
  if (isCommandHandled) return;

  // ── Konfirmasi Pending Action via Teks ────────
  if (pendingActions[chatId]) {
    const pending = pendingActions[chatId];
    const jawaban = text.toLowerCase().trim();
    const autoPatterns = ['auto', 'auto accept', 'auto-accept', 'selalu', 'always', 'gas terus', 'auto on'];
    const yesPatterns = ['ya', 'yes', 'ok', 'oke', 'lanjut', 'gas', 'izinkan', 'y', 'boleh'];
    const noPatterns = ['tidak', 'batal', 'cancel', 'no', 'jangan', 'gak', 'nggak', 'n', 'tolak', 'skip', 'abaikan'];

    if (autoPatterns.includes(jawaban)) {
      delete pendingActions[chatId];
      settingsManager.setAutoAccept(true);
      await safeSendMessage(chatId, "⚡ *Auto-Accept Diaktifkan!* Aksi dijalankan dan ke depannya semua aksi akan dieksekusi otomatis.");
      await handleUserConfirmation(chatId, true, pending);
      return;
    } else if (yesPatterns.includes(jawaban)) {
      delete pendingActions[chatId];
      await handleUserConfirmation(chatId, true, pending);
      return;
    } else if (noPatterns.includes(jawaban)) {
      delete pendingActions[chatId];
      await handleUserConfirmation(chatId, false, pending);
      return;
    } else {
      const keyboard = {
        inline_keyboard: [
          [
            { text: "✅ Izinkan Aksi Ini", callback_data: `approve_${pending.actionId}` },
            { text: "⚡ Izinkan & Auto-Accept ON", callback_data: `approve_all_${pending.actionId}` }
          ],
          [
            { text: "❌ Batalkan & Lanjut Chat Baru", callback_data: `reject_${pending.actionId}` }
          ]
        ]
      };
      await safeSendMessage(
        chatId,
        `⏸️ *Masih ada aksi tertunda yang butuh konfirmasi:*\n` +
        `• Aksi: \`${pending.functionName}\`\n\n` +
        `_Silakan pilih tombol di bawah, atau ketik *"ya"* / *"auto"* / *"batal"*:_`,
        { reply_markup: keyboard }
      );
      return;
    }
  }

  // ── Obrolan Normal ───────────────────────────
  const activeSession = sessionManager.getActiveSession(chatId);

  // Jika nama sesi masih generic, beri nama otomatis berdasarkan pesan pertama
  sessionManager.autoSetTitleIfDefault(chatId, activeSession.id, text);

  activeSession.messages.push({ role: "user", content: text });
  sessionManager.saveSessionMessages(chatId, activeSession.id, activeSession.messages);

  // Jalankan ReAct Agent Loop
  await runAgentLoop(chatId);
}

module.exports = {
  handleMessage
};
