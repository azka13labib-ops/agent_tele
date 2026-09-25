const { bot } = require('../core/bot');
const { AI_BASE_URL, AI_API_KEY } = require('../config/env');

async function transcribeVoiceMessage(fileId) {
  if (!fileId) {
    return { success: false, error: "ID file audio tidak ditemukan." };
  }

  try {
    const fileLink = await bot.getFileLink(fileId);
    const audioResp = await fetch(fileLink, { signal: AbortSignal.timeout(20000) });

    if (!audioResp.ok) {
      return { success: false, error: "Gagal mengunduh file audio dari Telegram." };
    }

    const audioBuffer = await audioResp.arrayBuffer();
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'voice_message.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'id');

    const transcriptionUrl = `${AI_BASE_URL}/audio/transcriptions`;
    const whisperResp = await fetch(transcriptionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_API_KEY}`
      },
      body: formData,
      signal: AbortSignal.timeout(30000)
    });

    if (!whisperResp.ok) {
      const errText = await whisperResp.text();
      return { success: false, error: `Layanan transkripsi suara mengembalikan status ${whisperResp.status}: ${errText.slice(0, 150)}` };
    }

    const data = await whisperResp.json();
    const transcribedText = (data.text || '').trim();

    if (!transcribedText) {
      return { success: false, error: "Audio berhasil diproses tetapi tidak terdeteksi suara atau percakapan yang jelas." };
    }

    return { success: true, text: transcribedText };
  } catch (err) {
    return { success: false, error: `Kesalahan pemrosesan audio: ${err.message}` };
  }
}

module.exports = {
  transcribeVoiceMessage
};
