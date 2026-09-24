const fs = require('fs');
const path = require('path');

const SETTINGS_DIR = path.resolve(__dirname, 'sessions');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');

function ensureDir() {
  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  }
}

/**
 * Muat konfigurasi pengaturan global bot
 */
function loadSettings() {
  ensureDir();
  const defaultSettings = {
    autoAccept: process.env.AUTO_ACCEPT === 'true' // Default: false (butuh konfirmasi)
  };

  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      return { ...defaultSettings, ...data };
    } catch {
      return defaultSettings;
    }
  }

  saveSettings(defaultSettings);
  return defaultSettings;
}

/**
 * Simpan konfigurasi ke disk
 */
function saveSettings(settings) {
  try {
    ensureDir();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error("Error saving settings:", err.message);
  }
}

/**
 * Cek apakah auto-accept aktif
 */
function isAutoAccept() {
  return loadSettings().autoAccept === true;
}

/**
 * Ubah status auto-accept (true / false)
 */
function setAutoAccept(enabled) {
  const current = loadSettings();
  current.autoAccept = Boolean(enabled);
  saveSettings(current);
  return current.autoAccept;
}

/**
 * Toggle status auto-accept (on -> off / off -> on)
 */
function toggleAutoAccept() {
  const current = loadSettings();
  current.autoAccept = !current.autoAccept;
  saveSettings(current);
  return current.autoAccept;
}

module.exports = {
  loadSettings,
  saveSettings,
  isAutoAccept,
  setAutoAccept,
  toggleAutoAccept
};
