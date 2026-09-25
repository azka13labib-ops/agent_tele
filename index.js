require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sessionManager = require('./session_manager');
const SYSTEM_PROMPT = require('./system_prompt');
const { dlToolDefinitions, handleDlTool } = require('./tools_dl');
const knowledgeManager = require('./knowledge_manager');
const { executeTool: executeLocalTool } = require('./tools_executor');
const settingsManager = require('./settings_manager');

const REMOTE_WORKER_URL = process.env.REMOTE_WORKER_URL; // Jika diisi, bot me-relay eksekusi tools ke worker di laptop
const WORKER_SECRET = process.env.WORKER_SECRET || 'hermes-tailscale-secret';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const AI_API_KEY = process.env.NINEROUTER_API_KEY || process.env.ROUTER9_API_KEY || process.env.AI_API_KEY || process.env.TOKENHARBOR_API_KEY || process.env.OPEN_ROUTER_API_KEY;
const AI_BASE_URL = process.env.AI_BASE_URL || "https://tokenharbor.ai/v1";
const AI_MODEL = process.env.AI_MODEL || "deepseek-v4-flash:free";

if (!TELEGRAM_TOKEN) {
  console.error("❌ TELEGRAM_TOKEN tidak ditemukan di file .env!");
  process.exit(1);
}

if (!AI_API_KEY) {
  console.error("❌ API Key (NINEROUTER_API_KEY / AI_API_KEY / TOKENHARBOR_API_KEY) tidak ditemukan di file .env!");
  process.exit(1);
}

// Konfigurasi Whitelist / Access Control (ID Telegram Pemilik)
const OWNER_IDS = (process.env.OWNER_ID || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

function isAuthorized(senderId) {
  if (OWNER_IDS.length === 0) return true; // Jika tidak diatur, default izinkan (atau bisa dikunci)
  return OWNER_IDS.includes(String(senderId));
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Tangani error polling Telegram (koneksi terputus sesaat/ECONNRESET)
bot.on('polling_error', (error) => {
  if (error.code === 'EFATAL' || error.message?.includes('ECONNRESET') || error.message?.includes('ETIMEDOUT')) {
    // Abaikan logging berlebihan untuk network disconnect sesaat
    return;
  }
  console.warn(`[Telegram Polling Notice]: ${error.code || error.message}`);
});

const openai = new OpenAI({
  baseURL: AI_BASE_URL,
  apiKey: AI_API_KEY,
});

// Penyimpanan aksi yang menunggu konfirmasi (Human-in-the-loop)
const pendingActions = {};

// ─────────────────────────────────────────────
// Definisi Tools untuk OpenAI Function Calling
// ─────────────────────────────────────────────
const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "lihat_folder",
      description: "Melihat daftar file dan subfolder di suatu direktori lokal",
      parameters: {
        type: "object",
        properties: {
          pathFolder: {
            type: "string",
            description: "Path folder yang ingin dicek. Contoh: './', './src', 'C:/Users'"
          }
        },
        required: ["pathFolder"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "baca_file",
      description: "Membaca isi teks dari sebuah file lokal dengan baris terformat",
      parameters: {
        type: "object",
        properties: {
          namaFile: {
            type: "string",
            description: "Path file yang ingin dibaca. Contoh: './index.js', 'package.json'"
          },
          startLine: {
            type: "number",
            description: "Nomor baris awal untuk mulai membaca (opsional, default: 1)"
          },
          maxLines: {
            type: "number",
            description: "Jumlah baris maksimal yang dibaca (opsional, default: 150)"
          }
        },
        required: ["namaFile"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "tulis_file",
      description: "Membuat file baru atau menimpa isi file yang sudah ada. Butuh konfirmasi user!",
      parameters: {
        type: "object",
        properties: {
          namaFile: {
            type: "string",
            description: "Path file yang akan dibuat atau diubah"
          },
          konten: {
            type: "string",
            description: "Konten teks lengkap yang akan ditulis ke file"
          },
          penjelasan: {
            type: "string",
            description: "Penjelasan singkat tujuan penulisan atau perubahan file ini"
          }
        },
        required: ["namaFile", "konten"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "jalankan_cmd",
      description: "Menjalankan perintah PowerShell di komputer Windows. Butuh konfirmasi user sebelum dieksekusi!",
      parameters: {
        type: "object",
        properties: {
          perintah: {
            type: "string",
            description: "Perintah PowerShell yang akan dieksekusi di Windows"
          },
          penjelasan: {
            type: "string",
            description: "Penjelasan singkat alasan dan tujuan perintah ini dijalankan"
          }
        },
        required: ["perintah", "penjelasan"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cari_file",
      description: "Mencari file atau folder berdasarkan nama/kata kunci secara rekursif",
      parameters: {
        type: "object",
        properties: {
          kataKunci: {
            type: "string",
            description: "Nama file atau pola kata kunci yang dicari"
          },
          rootFolder: {
            type: "string",
            description: "Folder awal pencarian (opsional, default: './')"
          }
        },
        required: ["kataKunci"],
        additionalProperties: false
      }
    }
  }
];

const allTools = [...toolDefinitions, ...dlToolDefinitions, ...knowledgeManager.knowledgeToolDefinitions];

// ─────────────────────────────────────────────
// Implementasi Eksekusi Tools (Lokal / Remote via Worker)
// ─────────────────────────────────────────────
async function executeTool(name, args) {
  // Jika bot berjalan di Server dan dihubungkan ke Worker Laptop via Tailscale
  if (REMOTE_WORKER_URL) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 65000); // 65 detik timeout

      const resp = await fetch(`${REMOTE_WORKER_URL}/api/execute-tool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WORKER_SECRET}`
        },
        body: JSON.stringify({ name, args }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        return `❌ Gagal eksekusi di laptop: ${errJson.error || resp.statusText}`;
      }

      const data = await resp.json();
      return data.result;
    } catch (err) {
      if (err.name === 'AbortError') {
        return `⏱️ Timeout: Eksekusi tool "${name}" di laptop melebihi batas waktu 65 detik.`;
      }
      return `⚠️ Laptop Utama Offline / Tidak Terjangkau:\nTidak dapat terhubung ke worker di ${REMOTE_WORKER_URL} (${err.message}). Pastikan laptop utama hidup, terkoneksi Tailscale, dan "node laptop_worker.js" sedang aktif!`;
    }
  }

  // Jika bot berjalan langsung di lingkungan server (Linux tanpa REMOTE_WORKER_URL)
  if (!REMOTE_WORKER_URL && process.platform === 'linux') {
    if (name === 'cek_gpu') {
      try {
        execSync('nvidia-smi --version', { stdio: 'pipe' });
      } catch {
        return `⚠️ *GPU NVIDIA tidak ditemukan di Server Linux!*\n\nBot saat ini berjalan di server cloud tanpa konfigurasi \`REMOTE_WORKER_URL\`.\n\n💡 *Solusi agar bisa membaca GPU RTX 4060 di laptopmu:*\n1. Tambahkan baris ini di file \`.env\` server:\n   \`REMOTE_WORKER_URL=http://<IP_TAILSCALE_LAPTOP>:20130\`\n2. Pastikan di laptop utama \`node laptop_worker.js\` sedang aktif dan terhubung Tailscale.`;
      }
    }
  }

  // Jika bot berjalan langsung di laptop lokal
  return executeLocalTool(name, args);
}

// ─────────────────────────────────────────────
// Helper Pengiriman Pesan Telegram yang Aman
// ─────────────────────────────────────────────
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
    const chunk = text.slice(i, i + MAX_CHUNK);
    try {
      await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown', ...options });
    } catch {
      await bot.sendMessage(chatId, chunk, { ...options, parse_mode: undefined });
    }
  }
}

// ─────────────────────────────────────────────
// Pruning Memory Obrolan
// ─────────────────────────────────────────────
function pruneMessages(messages) {
  if (!messages || messages.length <= 25) return messages;

  const systemMessage = messages[0];
  const recent = messages.slice(-20);

  while (recent.length > 0 && recent[0].role === 'tool') {
    recent.shift();
  }

  return [systemMessage, ...recent];
}

// ─────────────────────────────────────────────
// Tampilkan Permintaan Konfirmasi (Inline Keyboard)
// ─────────────────────────────────────────────
async function sendConfirmationMessage(chatId, actionId, functionName, functionArgs) {
  let detail = '';

  if (functionName === 'jalankan_cmd') {
    detail = `🖥️ *Perintah PowerShell:*\n\`\`\`powershell\n${functionArgs.perintah}\n\`\`\`\n📌 *Tujuan:* ${functionArgs.penjelasan || 'Tidak ada penjelasan'}`;
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
    `Agent ingin melakukan aksi sistem berpotensi sensitif:\n\n${detail}\n\n` +
    `_Apakah lo mengizinkan aksi ini dieksekusi di komputermu?_`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '✅ Izinkan & Jalankan', callback_data: `approve_${actionId}` },
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
    await bot.sendMessage(chatId, messageText.replace(/[*_`]/g, ''), {
      reply_markup: replyMarkup
    });
  }
}

// ─────────────────────────────────────────────
// Agent ReAct Loop (Multi-Step Engine)
// ─────────────────────────────────────────────
async function runAgentLoop(chatId) {
  let step = 0;
  const MAX_STEPS = 6;

  while (step < MAX_STEPS) {
    step++;

    try {
      await bot.sendChatAction(chatId, 'typing');
    } catch {}

    const session = sessionManager.getActiveSession(chatId);
    let messages = session.messages;

    if (!messages || messages.length === 0) return;

    // Guard: Token Harbor / DeepSeek mewajibkan pesan terakhir bertipe 'user' atau 'tool'
    // Jika pesan terakhir sudah 'assistant', respon sudah selesai, jangan panggil completions lagi!
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      return;
    }

    // Pastikan System Prompt selalu terinjeksi konteks pengetahuan permanen Hermes
    const knowledgeContext = knowledgeManager.getKnowledgeContext();
    if (messages.length > 0 && messages[0].role === 'system') {
      messages[0].content = SYSTEM_PROMPT + (knowledgeContext ? `\n\n${knowledgeContext}` : '');
    }

    let completion;
    try {
      const model = process.env.AI_MODEL || AI_MODEL;
      completion = await openai.chat.completions.create({
        model: model,
        messages: messages,
        tools: allTools,
        parallel_tool_calls: false,
        temperature: 0.2,
        max_tokens: 1500
      });
    } catch (err) {
      console.error("OpenAI Error:", err);
      await safeSendMessage(chatId, `❌ Terjadi error saat menghubungi AI: ${err.message}`);
      return;
    }

    const responseMsg = completion.choices[0]?.message;
    if (!responseMsg) {
      await safeSendMessage(chatId, "❌ AI tidak memberikan respon.");
      return;
    }

    messages.push(responseMsg);
    sessionManager.saveSessionMessages(chatId, session.id, messages);

    // Cek apakah AI memanggil tool
    if (responseMsg.tool_calls && responseMsg.tool_calls.length > 0) {
      const toolCall = responseMsg.tool_calls[0];
      const functionName = toolCall.function.name;
      let functionArgs = {};
      try {
        functionArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        functionArgs = {};
      }

      const isSensitive = ['jalankan_cmd', 'tulis_file'].includes(functionName);

      if (isSensitive) {
        if (settingsManager.isAutoAccept()) {
          const actionLabel = functionName === 'jalankan_cmd'
            ? `⚡ *[Auto-Accept]* Menjalankan PowerShell:\n\`${functionArgs.perintah}\``
            : `✍️ *[Auto-Accept]* Menulis file:\n\`${functionArgs.namaFile}\``;

          await safeSendMessage(chatId, actionLabel);
          const result = await executeTool(functionName, functionArgs);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: String(result)
          });

          sessionManager.saveSessionMessages(chatId, session.id, messages);
        } else {
          const actionId = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          pendingActions[chatId] = {
            actionId,
            toolCallId: toolCall.id,
            functionName,
            functionArgs,
            sessionId: session.id
          };

          await sendConfirmationMessage(chatId, actionId, functionName, functionArgs);
          return; // Jeda loop sampai user konfirmasi
        }
      } else {
        const statusLabel =
          functionName === 'pelajari_repo' ? `📥 Mengklon & mempelajari repo \`${functionArgs.repoUrl}\`...` :
          functionName === 'pelajari_url' ? `🌐 Membaca & merangkum dokumen \`${functionArgs.url}\`...` :
          functionName === 'cari_pengetahuan' ? `🧠 Mencari catatan tentang \`${functionArgs.query}\`...` :
          functionName === 'baca_file' ? `📖 Membaca \`${functionArgs.namaFile}\`...` :
          functionName === 'lihat_folder' ? `📂 Melihat isi \`${functionArgs.pathFolder || './'}\`...` :
          functionName === 'cek_gpu' ? `🖥️ Memeriksa status GPU NVIDIA...` :
          functionName === 'cek_env_dl' ? `🧪 Memeriksa environment Deep Learning...` :
          functionName === 'inspeksi_dataset' ? `📊 Menganalisis dataset \`${functionArgs.pathFolder}\`...` :
          functionName === 'monitor_training' ? `📈 Memeriksa progress training model...` :
          `🔍 Mencari \`${functionArgs.kataKunci}\`...`;

        await safeSendMessage(chatId, statusLabel);

        const result = await executeTool(functionName, functionArgs);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: String(result)
        });

        sessionManager.saveSessionMessages(chatId, session.id, messages);
      }
    } else {
      // Jawaban final assistant
      if (responseMsg.content) {
        await safeSendMessage(chatId, responseMsg.content);
      }
      const pruned = pruneMessages(messages);
      sessionManager.saveSessionMessages(chatId, session.id, pruned);
      return;
    }
  }

  await safeSendMessage(chatId, "⚠️ Agent telah mencapai batas langkah maksimum (6 langkah) untuk permintaan ini.");
}

// ─────────────────────────────────────────────
// Handler Konfirmasi User (Setuju / Tolak)
// ─────────────────────────────────────────────
async function handleUserConfirmation(chatId, isApproved, passedPending = null) {
  const pending = passedPending || pendingActions[chatId];
  if (!pending) return;

  delete pendingActions[chatId];
  const session = sessionManager.getActiveSession(chatId);
  const messages = session.messages;

  // Cek apakah aksi toolCallId ini sudah pernah dicatat di session messages
  const alreadyHandled = messages.some(m => m.role === 'tool' && m.tool_call_id === pending.toolCallId);
  if (alreadyHandled) {
    return;
  }

  if (isApproved) {
    await safeSendMessage(chatId, `▶️ *Mengeksekusi:* \`${pending.functionName}\`...`);
    const result = await executeTool(pending.functionName, pending.functionArgs);

    messages.push({
      role: "tool",
      tool_call_id: pending.toolCallId,
      content: String(result)
    });

    sessionManager.saveSessionMessages(chatId, session.id, messages);
    await runAgentLoop(chatId);
  } else {
    await safeSendMessage(chatId, `❌ Aksi \`${pending.functionName}\` dibatalkan sesuai permintaanmu.`);

    messages.push({
      role: "tool",
      tool_call_id: pending.toolCallId,
      content: "Aksi dibatalkan oleh user (user menolak konfirmasi eksekusi ini)."
    });

    sessionManager.saveSessionMessages(chatId, session.id, messages);
    await runAgentLoop(chatId);
  }
}

// ─────────────────────────────────────────────
// Helper Tampilkan Menu Pengaturan (UI)
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Helper Tampilkan Daftar Sesi (UI)
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Event: Callback Query (Klik Tombol Inline)
// ─────────────────────────────────────────────
bot.on('callback_query', async (query) => {
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
  if (pending && (data === `approve_${pending.actionId}` || data === `reject_${pending.actionId}`)) {
    delete pendingActions[chatId]; // Langsung hapus agar tidak dieksekusi ganda jika diklik cepat
    try {
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: chatId,
        message_id: query.message.message_id
      });
      const statusText = data.startsWith('approve') ? "✅ DISETUJUI" : "❌ DITOLAK";
      await bot.editMessageText(query.message.text + `\n\n*(Status: ${statusText})*`, {
        chat_id: chatId,
        message_id: query.message.message_id
      });
    } catch {}

    if (data.startsWith('approve')) {
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
});

// ─────────────────────────────────────────────
// Event: Pesan Teks Masuk
// ─────────────────────────────────────────────
bot.on('message', async (msg) => {
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

  // ── /start: Bantuan Awal ──────────────────────
  if (text.startsWith('/start')) {
    const active = sessionManager.getActiveSession(chatId);
    return safeSendMessage(
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
  }

  // ── /learn: Pelajari Repo GitHub, URL Web, Paper ArXiv, HF, dll. ──
  if (text.startsWith('/learn')) {
    const targetUrl = text.replace(/^\/learn/, '').trim();
    if (!targetUrl) {
      return safeSendMessage(
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
    }

    if (targetUrl.includes('github.com') && !targetUrl.includes('/raw/') && !targetUrl.includes('gist.github.com')) {
      await safeSendMessage(chatId, `🐙 *Mulai mempelajari repositori GitHub:* \`${targetUrl}\`...\n_Sedang mengklon dan menganalisis arsitektur berkas kode..._`);
      const res = await knowledgeManager.studyGithubRepo(targetUrl);
      if (res.success) {
        return safeSendMessage(
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
        return safeSendMessage(chatId, `❌ *Gagal mempelajari repo:*\n${res.error}`);
      }
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

        return safeSendMessage(chatId, textResult);
      } else {
        return safeSendMessage(chatId, `❌ *Gagal mempelajari URL:*\n${res.error}`);
      }
    }
  }

  // ── /brain atau /knowledge: Cek Isi Memori ────
  if (text.startsWith('/knowledge') || text === '/brain') {
    const list = knowledgeManager.listKnowledge();
    return safeSendMessage(chatId, list);
  }

  // ── /gpu: Cek Status GPU NVIDIA Instan ────────
  if (text === '/gpu') {
    const res = await executeTool('cek_gpu', {});
    return safeSendMessage(chatId, res);
  }

  // ── /env: Cek Environment AI & PyTorch ───────
  if (text === '/env') {
    const res = await executeTool('cek_env_dl', {});
    return safeSendMessage(chatId, res);
  }

  // ── /laptop atau /status: Cek Status Koneksi Laptop & Worker ──
  if (text === '/laptop' || text === '/status') {
    const isRemote = Boolean(REMOTE_WORKER_URL);
    if (!isRemote) {
      const gpuInfo = await executeTool('cek_gpu', {});
      return safeSendMessage(
        chatId,
        `💻 *Mode Hermes:* Berjalan Langsung di Laptop Lokal\n` +
        `📡 *Koneksi:* Langsung (Localhost)\n\n` +
        `${gpuInfo}`
      );
    }

    try {
      const startT = Date.now();
      const resp = await fetch(`${REMOTE_WORKER_URL}/health`, { signal: AbortSignal.timeout(4000) });
      const latency = Date.now() - startT;
      if (resp.ok) {
        const data = await resp.json();
        return safeSendMessage(
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
      return safeSendMessage(
        chatId,
        `🔴 *Laptop Utama Tidak Terjangkau (Offline / Sleep)*\n\n` +
        `• *Target Worker:* \`${REMOTE_WORKER_URL}\`\n` +
        `• *Error:* ${err.message}\n\n` +
        `_Bot tetap aktif di server untuk obrolan teks, namun perintah yang membutuhkan GPU atau akses file di laptop sedang tidak dapat dijalankan._`
      );
    }
  }

  // ── /sessions: Daftar & Switch Sesi ───────────
  if (text.startsWith('/sessions') || text === '/list') {
    return renderSessionsList(chatId);
  }

  // ── /new: Buat Sesi Baru ──────────────────────
  if (text.startsWith('/new')) {
    const customTitle = text.replace(/^\/new/, '').trim();
    const newSession = sessionManager.createSession(chatId, customTitle);
    delete pendingActions[chatId];
    return safeSendMessage(
      chatId,
      `✨ *Sesi Baru Dibuat & Aktif!*\n` +
      `📌 Judul: *${newSession.title}*\n` +
      `Memory percakapan sekarang bersih dan terpisah dari sesi sebelumnya.`
    );
  }

  // ── /session: Info Sesi Aktif ─────────────────
  if (text === '/session') {
    const active = sessionManager.getActiveSession(chatId);
    const userMsgCount = active.messages.filter(m => m.role === 'user').length;
    const dateStr = new Date(active.updatedAt).toLocaleString('id-ID');
    return safeSendMessage(
      chatId,
      `📌 *Info Sesi Aktif:*\n` +
      `• *Judul:* ${active.title}\n` +
      `• *ID Sesi:* \`${active.id}\`\n` +
      `• *Jumlah Pesan:* ${userMsgCount}\n` +
      `• *Terakhir Diperbarui:* ${dateStr}\n\n` +
      `_Gunakan \`/sessions\` untuk beralih sesi atau \`/rename\` untuk mengubah judul._`
    );
  }

  // ── /rename: Ubah Judul Sesi ──────────────────
  if (text.startsWith('/rename')) {
    const newTitle = text.replace(/^\/rename/, '').trim();
    if (!newTitle) {
      return safeSendMessage(chatId, "⚠️ Masukkan nama baru! Contoh: `/rename Debug API Auth`");
    }
    const active = sessionManager.getActiveSession(chatId);
    sessionManager.renameSession(chatId, active.id, newTitle);
    return safeSendMessage(chatId, `✏️ *Nama sesi berhasil diubah:* "${newTitle}"`);
  }

  // ── /reset: Bersihkan Sesi Aktif ──────────────
  if (text.startsWith('/reset')) {
    const active = sessionManager.resetActiveSession(chatId);
    delete pendingActions[chatId];
    return safeSendMessage(chatId, `🧹 *Memory sesi "${active.title}" telah direset!* Siap mulai topik baru.`);
  }

  // ── /settings atau /setting: Panel Pengaturan Bot ──
  if (text === '/settings' || text === '/setting') {
    return renderSettingsPanel(chatId);
  }

  // ── /autoaccept: Shortcut toggle auto-accept ──
  if (text.startsWith('/autoaccept')) {
    const arg = text.replace(/^\/autoaccept/, '').trim().toLowerCase();
    let newStatus;
    if (arg === 'on' || arg === 'true' || arg === '1' || arg === 'aktif' || arg === 'enable') {
      newStatus = settingsManager.setAutoAccept(true);
    } else if (arg === 'off' || arg === 'false' || arg === '0' || arg === 'mati' || arg === 'disable') {
      newStatus = settingsManager.setAutoAccept(false);
    } else {
      newStatus = settingsManager.toggleAutoAccept();
    }

    const statusText = newStatus ? "🟢 *AKTIF (Eksekusi Instan Tanpa Konfirmasi)*" : "🔴 *NONAKTIF (Meminta Konfirmasi Manual)*";
    return safeSendMessage(
      chatId,
      `⚙️ *Pengaturan Auto-Accept Berhasil Diubah!*\n\n` +
      `• Status: ${statusText}\n\n` +
      `_Gunakan \`/settings\` untuk membuka menu pengaturan interaktif._`
    );
  }

  // ── Konfirmasi Pending Action via Teks ────────
  if (pendingActions[chatId]) {
    const pending = pendingActions[chatId];
    const jawaban = text.toLowerCase();
    const yesPatterns = ['ya', 'yes', 'ok', 'oke', 'lanjut', 'gas', 'izinkan', 'y', 'boleh'];
    const noPatterns = ['tidak', 'batal', 'cancel', 'no', 'jangan', 'gak', 'nggak', 'n', 'tolak'];

    if (yesPatterns.includes(jawaban)) {
      delete pendingActions[chatId];
      await handleUserConfirmation(chatId, true, pending);
      return;
    } else if (noPatterns.includes(jawaban)) {
      delete pendingActions[chatId];
      await handleUserConfirmation(chatId, false, pending);
      return;
    } else {
      await safeSendMessage(
        chatId,
        `⏸️ *Ada aksi yang butuh persetujuan lo!*\n` +
        `Silakan klik tombol *Izinkan* / *Tolak* di atas, atau ketik *"ya"* / *"tidak"*.`
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
});

console.log("==================================================");
console.log("🤖 Bot Hermes AI Agent (v3.0 - Hybrid Server/Laptop) Aktif!");
console.log(`🌐 Provider: ${AI_BASE_URL} | Model: ${AI_MODEL}`);
console.log(`📡 Mode Host: ${REMOTE_WORKER_URL ? 'SERVER (Remote Worker: ' + REMOTE_WORKER_URL + ')' : 'LOCAL (Laptop Windows)'}`);
console.log(`🔒 Access Control (Whitelist): ${OWNER_IDS.length > 0 ? 'AKTIF (Owner ID: ' + OWNER_IDS.join(', ') + ')' : '⚠️ TERBUKA (Harap isi OWNER_ID di .env)'}`);
console.log(`⚡ Mode Auto-Accept: ${settingsManager.isAutoAccept() ? '🟢 AKTIF (Eksekusi Instan)' : '🛡️ NONAKTIF (Human-in-the-Loop)'}`);
console.log("🧠 Self-Learning & Knowledge Base: Aktif (/learn, /brain)");
console.log("⚡ Hardware & DL Suite: Aktif (RTX 4060 GPU Tools)");
console.log("📂 Sistem Multi-Session: Aktif & Tersimpan di Disk");
console.log("🛡️ Mode Keamanan: Konfirmasi & Whitelist Aktif");
console.log("⚡ Shell Native: Windows PowerShell");
console.log("==================================================");