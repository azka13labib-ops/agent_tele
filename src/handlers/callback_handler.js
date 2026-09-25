const { bot, safeSendMessage } = require('../core/bot');
const { isAuthorized } = require('../config/env');
const settingsManager = require('../services/settings_manager');
const sessionManager = require('../services/session_manager');
const { pendingActions, handleUserConfirmation } = require('../core/agent');
const { renderSettingsPanel } = require('../ui/menus');

async function handleCallbackQuery(query) {
  const senderId = String(query.from ? query.from.id : query.message?.chat?.id);
  const chatId = query.message.chat.id;
  const data = query.data;

  // ── Keamanan Whitelist / Access Control ───────
  if (!isAuthorized(senderId)) {
    console.warn(`[Security Alert] Callback ditolak dari Telegram ID: ${senderId} (@${query.from?.username || 'unknown'})`);
    try {
      await bot.answerCallbackQuery(query.id, {
        text: "⛔ Akses ditolak: Anda tidak memiliki izin untuk mengontrol bot ini!",
        show_alert: true
      });
    } catch {}
    return;
  }

  try {
    await bot.answerCallbackQuery(query.id);
  } catch {}

  // 1. Konfirmasi Aksi Sensitif
  const pending = pendingActions[chatId];
  if (pending && (data === `approve_${pending.actionId}` || data === `approve_all_${pending.actionId}` || data === `reject_${pending.actionId}`)) {
    delete pendingActions[chatId]; // Langsung hapus agar tidak dieksekusi ganda jika diklik cepat
    try {
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: chatId,
        message_id: query.message.message_id
      });
      const statusText = data.startsWith('approve_all')
        ? "⚡ DISETUJUI & AUTO-ACCEPT DIAKTIFKAN"
        : data.startsWith('approve')
        ? "✅ DISETUJUI"
        : "❌ DITOLAK";
      await bot.editMessageText(query.message.text + `\n\n*(Status: ${statusText})*`, {
        chat_id: chatId,
        message_id: query.message.message_id
      });
    } catch {}

    if (data.startsWith('approve_all')) {
      settingsManager.setAutoAccept(true);
      await safeSendMessage(chatId, "⚡ *Auto-Accept Berhasil Diaktifkan!* Mulai sekarang perintah & penulisan file akan berjalan instan tanpa jeda konfirmasi manual.");
      await handleUserConfirmation(chatId, true, pending);
    } else if (data.startsWith('approve')) {
      await handleUserConfirmation(chatId, true, pending);
    } else {
      await handleUserConfirmation(chatId, false, pending);
    }
    return;
  }

  // 2. Switch Sesi
  if (data.startsWith('switch_sess_')) {
    const targetSessionId = data.replace('switch_sess_', '');
    const switched = sessionManager.switchSession(chatId, targetSessionId);
    if (switched) {
      try {
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
          chat_id: chatId,
          message_id: query.message.message_id
        });
      } catch {}
      await safeSendMessage(chatId, `🔄 *Berhasil beralih ke sesi:* "${switched.title}"!\nMemory percakapan sekarang menggunakan sesi ini.`);
    }
    return;
  }

  // 3. Buat Sesi Baru
  if (data === 'new_sess') {
    const newSession = sessionManager.createSession(chatId);
    try {
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: chatId,
        message_id: query.message.message_id
      });
    } catch {}
    await safeSendMessage(chatId, `✨ *Sesi baru dibuat:* "${newSession.title}"!\nKonteks sekarang bersih dan terpisah.`);
    return;
  }

  // 4. Buka Menu Hapus Sesi
  if (data === 'manage_delete_sess') {
    const sessions = sessionManager.listSessions(chatId);
    if (sessions.length <= 1) {
      return safeSendMessage(chatId, "⚠️ Kamu hanya memiliki 1 sesi. Tidak bisa menghapus sesi satu-satunya.");
    }
    const delButtons = sessions.map(s => ([
      { text: `🗑️ Hapus: ${s.title}${s.isActive ? ' (Aktif)' : ''}`, callback_data: `del_sess_${s.id}` }
    ]));
    return safeSendMessage(chatId, "Pilih sesi yang ingin kamu hapus:", {
      reply_markup: { inline_keyboard: delButtons }
    });
  }

  // 5. Eksekusi Hapus Sesi
  if (data.startsWith('del_sess_')) {
    const targetId = data.replace('del_sess_', '');
    const result = sessionManager.deleteSession(chatId, targetId);
    if (result) {
      try {
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
          chat_id: chatId,
          message_id: query.message.message_id
        });
      } catch {}
      await safeSendMessage(chatId, `🗑️ *Sesi "${result.deletedTitle}" telah dihapus!*\nSesi aktif sekarang: *"${result.newActive.title}"*.`);
    }
    return;
  }

  // 6. Toggle Auto-Accept Setting
  if (data === 'toggle_setting_auto_accept') {
    const newStatus = settingsManager.toggleAutoAccept();
    try {
      await bot.answerCallbackQuery(query.id, {
        text: newStatus ? "⚡ Auto-Accept diaktifkan!" : "🛡️ Auto-Accept dimatikan (perlu izin)",
        show_alert: false
      });
    } catch {}
    return renderSettingsPanel(chatId, query.message.message_id);
  }

  // 7. Refresh Settings Panel
  if (data === 'refresh_settings') {
    try {
      await bot.answerCallbackQuery(query.id, { text: "🔄 Pengaturan diperbarui" });
    } catch {}
    return renderSettingsPanel(chatId, query.message.message_id);
  }
}

module.exports = {
  handleCallbackQuery
};
