const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '../../');

const SESSIONS_DIR = path.join(ROOT_DIR, 'sessions');
const KNOWLEDGE_DIR = path.join(ROOT_DIR, 'knowledge');
const NOTES_DIR = path.join(KNOWLEDGE_DIR, 'notes');
const REPOS_DIR = path.join(KNOWLEDGE_DIR, 'repos');
const INDEX_FILE = path.join(KNOWLEDGE_DIR, 'index.json');
const WATCHLIST_FILE = path.join(KNOWLEDGE_DIR, 'watchlist.json');
const SETTINGS_FILE = path.join(SESSIONS_DIR, 'settings.json');

function ensureDirectories() {
  [SESSIONS_DIR, KNOWLEDGE_DIR, NOTES_DIR, REPOS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  if (!fs.existsSync(INDEX_FILE)) {
    fs.writeFileSync(INDEX_FILE, JSON.stringify([], null, 2), 'utf-8');
  }

  if (!fs.existsSync(WATCHLIST_FILE)) {
    const defaultWatchlist = [
      { url: "https://github.com/astral-sh/uv", topic: "Python package & project manager", status: "pending" },
      { url: "https://github.com/ggerganov/llama.cpp", topic: "LLM inference in C/C++", status: "pending" },
      { url: "https://github.com/vllm-project/vllm", topic: "High-throughput LLM serving engine", status: "pending" },
      { url: "https://github.com/fastapi/fastapi", topic: "High performance modern web framework", status: "pending" },
      { url: "https://github.com/shadcn-ui/ui", topic: "Accessible UI component architecture", status: "pending" }
    ];
    fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(defaultWatchlist, null, 2), 'utf-8');
  }
}

module.exports = {
  ROOT_DIR,
  SESSIONS_DIR,
  KNOWLEDGE_DIR,
  NOTES_DIR,
  REPOS_DIR,
  INDEX_FILE,
  WATCHLIST_FILE,
  SETTINGS_FILE,
  ensureDirectories
};

