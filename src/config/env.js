require('dotenv').config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const AI_API_KEY =
  process.env.NINEROUTER_API_KEY ||
  process.env.ROUTER9_API_KEY ||
  process.env.AI_API_KEY ||
  process.env.TOKENHARBOR_API_KEY ||
  process.env.OPEN_ROUTER_API_KEY;

const AI_BASE_URL = process.env.AI_BASE_URL || 'https://tokenharbor.ai/v1';
const AI_MODEL = process.env.AI_MODEL || 'deepseek-v4-flash:free';

const REMOTE_WORKER_URL = process.env.REMOTE_WORKER_URL;
const WORKER_SECRET = process.env.WORKER_SECRET || 'hermes-tailscale-secret';

const OWNER_IDS = (process.env.OWNER_ID || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

function isAuthorized(senderId) {
  if (OWNER_IDS.length === 0) return true;
  return OWNER_IDS.includes(String(senderId));
}

function validateEnv() {
  if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_TOKEN tidak ditemukan di file .env!');
    process.exit(1);
  }

  if (!AI_API_KEY) {
    console.error('❌ API Key (NINEROUTER_API_KEY / AI_API_KEY / TOKENHARBOR_API_KEY) tidak ditemukan di file .env!');
    process.exit(1);
  }
}

module.exports = {
  TELEGRAM_TOKEN,
  AI_API_KEY,
  AI_BASE_URL,
  AI_MODEL,
  REMOTE_WORKER_URL,
  WORKER_SECRET,
  OWNER_IDS,
  isAuthorized,
  validateEnv
};

