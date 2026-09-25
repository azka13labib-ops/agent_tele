const { validateEnv, AI_BASE_URL, AI_MODEL, REMOTE_WORKER_URL, OWNER_IDS } = require('./src/config/env');
const { bot } = require('./src/core/bot');
const { handleMessage } = require('./src/handlers/message_handler');
const { handleCallbackQuery } = require('./src/handlers/callback_handler');
const settingsManager = require('./src/services/settings_manager');

// 1. Validasi variabel environment sebelum bot mulai
validateEnv();

// 2. Daftarkan router event Telegram
bot.on('message', handleMessage);
bot.on('callback_query', handleCallbackQuery);

// 3. Banner status bot
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