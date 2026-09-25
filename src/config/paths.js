const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '../../');

const SESSIONS_DIR = path.join(ROOT_DIR, 'sessions');
const KNOWLEDGE_DIR = path.join(ROOT_DIR, 'knowledge');
const NOTES_DIR = path.join(KNOWLEDGE_DIR, 'notes');
const REPOS_DIR = path.join(KNOWLEDGE_DIR, 'repos');
const INDEX_FILE = path.join(KNOWLEDGE_DIR, 'index.json');
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
}

module.exports = {
  ROOT_DIR,
  SESSIONS_DIR,
  KNOWLEDGE_DIR,
  NOTES_DIR,
  REPOS_DIR,
  INDEX_FILE,
  SETTINGS_FILE,
  ensureDirectories
};

