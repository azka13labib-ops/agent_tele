const { bot } = require('../core/bot');

/**
 * Tampilkan Permintaan Konfirmasi (Inline Keyboard)
 */
async function sendConfirmationMessage(chatId, actionId, functionName, functionArgs) {
  let detail = '';

  if (functionName === 'jalankan_cmd') {
    const cmdPreview = (functionArgs.perintah || '').length > 600
      ? (functionArgs.perintah || '').substring(0, 600) + '\n... (perintah dipotong)'
      : (functionArgs.perintah || '');
    detail = `🖥️ *Perintah PowerShell:*\n\`\`\`powershell\n${cmdPreview}\n\`\`\`\n📌 *Tujuan:* ${functionArgs.penjelasan || 'Tidak ada penjelasan'}`;
  } else if (functionName === 'tulis_file') {
    const preview = (functionArgs.konten || '').length > 400
      ? (functionArgs.konten || '').substring(0, 400) + '\n... (konten dipotong)'
      : functionArgs.konten;
    detail = `📝 *Tulis File:* \`${functionArgs.namaFile}\`\n\`\`\`\n${preview}\n\`\`\`\n📌 *Tujuan:* ${functionArgs.penjelasan || 'Tidak ada penjelasan'}`;
  } else {
    detail = `🔧 *Aksi:* \`${functionName}\`\n\`\`\`json\n${JSON.stringify(functionArgs, null, 2)}\n\`\`\``;
  }

  const messageText =
    `⚠️ *KONFIRMASI DIPERLUKAN*\n\n` +
    `Agent ingin melakukan aksi sistem sensitif:\n\n${detail}\n\n` +
    `_Pilih opsi eksekusi di bawah, atau aktifkan Auto-Accept agar selanjutnya tidak perlu konfirmasi manual:_`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '✅ Izinkan Sekali', callback_data: `approve_${actionId}` },
        { text: '⚡ Izinkan & Auto-Accept ON', callback_data: `approve_all_${actionId}` }
      ],
      [
        { text: '❌ Tolak / Batalkan', callback_data: `reject_${actionId}` }
      ]
    ]
  };

  try {
    await bot.sendMessage(chatId, messageText, {
      parse_mode: 'Markdown',
      reply_markup: replyMarkup
    });
  } catch {
    try {
      await bot.sendMessage(chatId, messageText.replace(/[*_`]/g, ''), {
        reply_markup: replyMarkup
      });
    } catch {
      await bot.sendMessage(
        chatId,
        `⚠️ Konfirmasi aksi [${functionName}]: ketik "ya" untuk jalan sekali, "auto" untuk aktifkan auto-accept, atau "batal" untuk membatalkan.`
      );
    }
  }
}

module.exports = {
  sendConfirmationMessage
};
