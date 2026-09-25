const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_TOKEN } = require('../config/env');

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Tangani error polling Telegram (koneksi terputus sesaat/ECONNRESET)
bot.on('polling_error', (error) => {
  if (error.code === 'EFATAL' || error.message?.includes('ECONNRESET') || error.message?.includes('ETIMEDOUT')) {
    return;
  }
  console.warn(`[Telegram Polling Notice]: ${error.code || ''} ${error.message || ''}`);
});

/**
 * Helper Pengiriman Pesan Telegram yang Aman
 * Otomatis memecah pesan melebihi batas 3800 karakter dan fallback jika Markdown gagal diparse
 */
async function safeSendMessage(chatId, text, options = {}) {
  if (!text) return;
  const MAX_CHUNK = 3800;

  if (text.length <= MAX_CHUNK) {
    try {
      return await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...options });
    } catch {
      return await bot.sendMessage(chatId, text, { ...options, parse_mode: undefined });
    }
  }

  for (let i = 0; i < text.length; i += MAX_CHUNK) {
    const chunk = text.substring(i, i + MAX_CHUNK);
    try {
      await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown', ...options });
    } catch {
      await bot.sendMessage(chatId, chunk, { ...options, parse_mode: undefined });
    }
  }
}

module.exports = {
  bot,
  safeSendMessage
};
