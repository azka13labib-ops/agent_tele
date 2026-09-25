const { bot, safeSendMessage } = require('./bot');
const { openai } = require('./ai');
const { AI_MODEL } = require('../config/env');
const SYSTEM_PROMPT = require('../config/system_prompt');
const sessionManager = require('../services/session_manager');
const settingsManager = require('../services/settings_manager');
const knowledgeManager = require('../services/knowledge_manager');
const { allTools } = require('../tools/definitions');
const { executeTool } = require('../tools/dispatcher');
const { sendConfirmationMessage } = require('../ui/confirmation');

// Penyimpanan aksi yang menunggu konfirmasi (Human-in-the-loop)
const pendingActions = {};

/**
 * Pruning Memory Obrolan agar tidak membengkak melebihi context window
 */
function pruneMessages(messages) {
  if (!messages || messages.length <= 25) return messages;

  const systemMessage = messages[0];
  const recent = messages.slice(-20);

  // Jangan biarkan pesan 'tool' berada paling depan tanpa pasangannya
  while (recent.length > 0 && recent[0].role === 'tool') {
    recent.shift();
  }

  return [systemMessage, ...recent];
}

/**
 * Sanitasi Struktur Pesan agar 100% Valid bagi OpenAI & Anthropic API
 * Mencegah error "400 The last message must have role=user" atau tool_calls yang tidak berpasangan
 */
function sanitizeMessagesForAPI(rawMessages) {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) return [];

  const sanitized = [];
  const systemMsg = rawMessages[0];
  if (systemMsg && systemMsg.role === 'system') {
    sanitized.push({ role: 'system', content: String(systemMsg.content || '') });
  }

  const startIdx = (systemMsg && systemMsg.role === 'system') ? 1 : 0;
  for (let i = startIdx; i < rawMessages.length; i++) {
    const msg = rawMessages[i];
    if (!msg || !msg.role) continue;

    if (msg.role === 'user') {
      sanitized.push({
        role: 'user',
        content: String(msg.content || '')
      });
    } else if (msg.role === 'assistant') {
      if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        sanitized.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.tool_calls
        });
      } else if (msg.content && String(msg.content).trim()) {
        sanitized.push({
          role: 'assistant',
          content: String(msg.content)
        });
      }
    } else if (msg.role === 'tool') {
      if (msg.tool_call_id) {
        sanitized.push({
          role: 'tool',
          tool_call_id: msg.tool_call_id,
          content: String(msg.content || '')
        });
      }
    }
  }

  // Validasi agar setiap tool_call di assistant message memiliki pasangan pesan 'tool'
  const finalMessages = [];
  for (let i = 0; i < sanitized.length; i++) {
    const msg = sanitized[i];
    finalMessages.push(msg);

    if (msg.role === 'assistant' && msg.tool_calls) {
      const toolCallIds = new Set(msg.tool_calls.map(tc => tc.id));
      let j = i + 1;
      const foundToolIds = new Set();
      while (j < sanitized.length && sanitized[j].role === 'tool') {
        foundToolIds.add(sanitized[j].tool_call_id);
        j++;
      }
      for (const tcId of toolCallIds) {
        if (!foundToolIds.has(tcId)) {
          finalMessages.push({
            role: 'tool',
            tool_call_id: tcId,
            content: 'Aksi selesai atau dibatalkan.'
          });
        }
      }
    }
  }

  // Guard: Jika pesan terakhir adalah assistant tanpa tool (misal sisa respons), hapus agar tidak memicu 400
  while (finalMessages.length > 1 && finalMessages[finalMessages.length - 1].role === 'assistant') {
    finalMessages.pop();
  }

  return finalMessages;
}

/**
 * Deteksi Perintah Read-Only / Safe Pengecekan Sistem
 * Tidak perlu memicu konfirmasi Telegram karena tidak merusak sistem
 */
function isSafeCommand(command) {
  if (!command) return true;
  const cmd = command.toLowerCase().trim();
  const safePrefixes = [
    'get-process', 'ps', 'get-content', 'cat', 'type',
    'get-childitem', 'dir', 'ls', 'test-path',
    'python --version', 'node --version', 'uv --version', 'uv python',
    'git status', 'git log', 'git diff', 'nvidia-smi', 'hostname', 'whoami',
    'echo', 'write-output'
  ];
  return safePrefixes.some(p => cmd.startsWith(p));
}

/**
 * Agent ReAct Loop (Multi-Step Engine)
 */
async function runAgentLoop(chatId) {
  let step = 0;
  const MAX_STEPS = 8;

  while (step < MAX_STEPS) {
    step++;

    try {
      await bot.sendChatAction(chatId, 'typing');
    } catch {}

    const session = sessionManager.getActiveSession(chatId);
    let messages = session.messages;

    if (!messages || messages.length === 0) return;

    // Pastikan System Prompt selalu terinjeksi konteks pengetahuan permanen Hermes
    const knowledgeContext = knowledgeManager.getKnowledgeContext();
    if (messages.length > 0 && messages[0].role === 'system') {
      messages[0].content = SYSTEM_PROMPT + (knowledgeContext ? `\n\n${knowledgeContext}` : '');
    }

    // Sanitasi pesan sebelum dikirim ke API
    const apiMessages = sanitizeMessagesForAPI(messages);
    if (!apiMessages || apiMessages.length === 0) return;

    let completion;
    try {
      const model = process.env.AI_MODEL || AI_MODEL;
      completion = await openai.chat.completions.create({
        model: model,
        messages: apiMessages,
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
      let pauseForConfirmation = false;

      for (const toolCall of responseMsg.tool_calls) {
        const functionName = toolCall.function.name;
        let functionArgs = {};
        try {
          functionArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          functionArgs = {};
        }

        const isSafe = functionName === 'jalankan_cmd' && isSafeCommand(functionArgs.perintah);
        const isSensitive = ['jalankan_cmd', 'tulis_file'].includes(functionName) && !isSafe;

        if (isSensitive && !settingsManager.isAutoAccept()) {
          const actionId = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          pendingActions[chatId] = {
            actionId,
            toolCallId: toolCall.id,
            functionName,
            functionArgs,
            sessionId: session.id
          };

          await sendConfirmationMessage(chatId, actionId, functionName, functionArgs);
          pauseForConfirmation = true;
          break; // Jeda loop sampai user konfirmasi aksi ini
        }

        if (isSensitive) {
          const actionLabel = functionName === 'jalankan_cmd'
            ? `⚡ *[Auto-Accept]* Menjalankan PowerShell:\n\`${functionArgs.perintah}\``
            : `✍️ *[Auto-Accept]* Menulis file:\n\`${functionArgs.namaFile}\``;

          await safeSendMessage(chatId, actionLabel);
        } else {
          const statusLabel =
            functionName === 'baca_web' ? `🌐 Membaca web \`${functionArgs.url}\`...` :
            functionName === 'pelajari_repo' ? `📥 Mengklon & mempelajari repo \`${functionArgs.repoUrl}\`...` :
            functionName === 'pelajari_url' ? `🌐 Membaca & merangkum dokumen \`${functionArgs.url}\`...` :
            functionName === 'cari_pengetahuan' ? `🧠 Mencari catatan tentang \`${functionArgs.query}\`...` :
            functionName === 'baca_file' ? `📖 Membaca \`${functionArgs.namaFile}\`...` :
            functionName === 'lihat_folder' ? `📂 Melihat isi \`${functionArgs.pathFolder || './'}\`...` :
            functionName === 'cek_gpu' ? `🖥️ Memeriksa status GPU NVIDIA...` :
            functionName === 'cek_env_dl' ? `🧪 Memeriksa environment Deep Learning...` :
            functionName === 'inspeksi_dataset' ? `📊 Menganalisis dataset \`${functionArgs.pathFolder}\`...` :
            functionName === 'monitor_training' ? `📈 Memeriksa progress training model...` :
            functionName === 'atur_auto_accept' ? `⚙️ Mengatur Auto-Accept ke: *${functionArgs.aktif ? 'AKTIF' : 'NONAKTIF'}*...` :
            `🔍 Mencari \`${functionArgs.kataKunci}\`...`;

          await safeSendMessage(chatId, statusLabel);
        }

        const result = await executeTool(functionName, functionArgs);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: String(result)
        });

        sessionManager.saveSessionMessages(chatId, session.id, messages);
      }

      if (pauseForConfirmation) {
        return; // Jeda sampai user konfirmasi
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

/**
 * Handler Konfirmasi User (Setuju / Tolak)
 */
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

module.exports = {
  pendingActions,
  pruneMessages,
  runAgentLoop,
  handleUserConfirmation
};
