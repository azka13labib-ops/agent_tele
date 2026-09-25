const fs = require('fs');
const { SESSIONS_DIR, SETTINGS_FILE, ensureDirectories } = require('../config/paths');

/**
 * Muat konfigurasi pengaturan global bot
 */
function loadSettings() {
  ensureDirectories();
  const defaultSettings = {
    autoAccept: process.env.AUTO_ACCEPT === 'false' ? false : true // Default: true (eksekusi otomatis aktif)
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
    ensureDirectories();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving settings:', err.message);
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
