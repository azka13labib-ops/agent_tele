const { safeSendMessage } = require('../core/bot');
const { isAuthorized } = require('../config/env');
const sessionManager = require('../services/session_manager');
const settingsManager = require('../services/settings_manager');
const { handleCommand } = require('./command_handler');
const { pendingActions, handleUserConfirmation, runAgentLoop } = require('../core/agent');
const { transcribeVoiceMessage } = require('../services/voice_service');

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const senderId = String(msg.from ? msg.from.id : chatId);
  let text = (msg.text || '').trim();

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

  if (!text && (msg.voice || msg.audio)) {
    const fileId = msg.voice ? msg.voice.file_id : msg.audio.file_id;
    await safeSendMessage(chatId, "🎙️ *Mendengarkan Voice Note...*\n_Sedang mentranskripsikan audio dengan Whisper AI..._");
    const transResult = await transcribeVoiceMessage(fileId);
    if (!transResult.success) {
      return safeSendMessage(
        chatId,
        `⚠️ *Gagal Memproses Pesan Suara:*\n${transResult.error}\n\n_Silakan ketik instruksi Anda secara tertulis._`
      );
    }
    text = transResult.text;
    await safeSendMessage(chatId, `🗣️ *Transkrip Suara:*\n_"${text}"_\n\n⚡ *Memproses instruksi ke Agent...*`);
  }

  if (!text) return;

  const isCommandHandled = await handleCommand(chatId, text);
  if (isCommandHandled) return;

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

  const activeSession = sessionManager.getActiveSession(chatId);

  sessionManager.autoSetTitleIfDefault(chatId, activeSession.id, text);

  activeSession.messages.push({ role: "user", content: text });
  sessionManager.saveSessionMessages(chatId, activeSession.id, activeSession.messages);

  await runAgentLoop(chatId);
}

module.exports = {
  handleMessage
};

