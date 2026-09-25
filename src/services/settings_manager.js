const fs = require('fs');
const { SESSIONS_DIR, SETTINGS_FILE, ensureDirectories } = require('../config/paths');

function loadSettings() {
  ensureDirectories();
  const defaultSettings = {
    autoAccept: process.env.AUTO_ACCEPT === 'false' ? false : true,
    verbose: true,
    workspaceDir: process.env.DEFAULT_WORKSPACE || 'c:\\ngodink',
    autoLearn: true,
    autoLearnIntervalHours: 1,
    lastAutoLearnAt: 0
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

function saveSettings(settings) {
  try {
    ensureDirectories();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving settings:', err.message);
  }
}

function isAutoAccept() {
  return loadSettings().autoAccept === true;
}

function setAutoAccept(enabled) {
  const current = loadSettings();
  current.autoAccept = Boolean(enabled);
  saveSettings(current);
  return current.autoAccept;
}

function toggleAutoAccept() {
  const current = loadSettings();
  current.autoAccept = !current.autoAccept;
  saveSettings(current);
  return current.autoAccept;
}

function isVerboseMode() {
  const settings = loadSettings();
  return settings.verbose !== false;
}

function setVerboseMode(enabled) {
  const current = loadSettings();
  current.verbose = Boolean(enabled);
  saveSettings(current);
  return current.verbose;
}

function toggleVerboseMode() {
  const current = loadSettings();
  current.verbose = current.verbose === false ? true : false;
  saveSettings(current);
  return current.verbose;
}

function getWorkspaceDir() {
  const settings = loadSettings();
  return settings.workspaceDir || 'c:\\ngodink';
}

function setWorkspaceDir(dir) {
  const current = loadSettings();
  current.workspaceDir = dir.trim();
  saveSettings(current);
  return current.workspaceDir;
}

function isAutoLearn() {
  const settings = loadSettings();
  return settings.autoLearn !== false;
}

function setAutoLearn(enabled) {
  const current = loadSettings();
  current.autoLearn = Boolean(enabled);
  saveSettings(current);
  return current.autoLearn;
}

function toggleAutoLearn() {
  const current = loadSettings();
  current.autoLearn = current.autoLearn === false ? true : false;
  saveSettings(current);
  return current.autoLearn;
}

function getAutoLearnIntervalHours() {
  const settings = loadSettings();
  return Number(settings.autoLearnIntervalHours) || 1;
}

function setAutoLearnIntervalHours(hours) {
  const current = loadSettings();
  current.autoLearnIntervalHours = Math.max(1, Number(hours) || 1);
  saveSettings(current);
  return current.autoLearnIntervalHours;
}

function getLastAutoLearnAt() {
  const settings = loadSettings();
  return Number(settings.lastAutoLearnAt) || 0;
}

function setLastAutoLearnAt(timestamp) {
  const current = loadSettings();
  current.lastAutoLearnAt = timestamp;
  saveSettings(current);
  return current.lastAutoLearnAt;
}

function isDailyDigest() {
  const settings = loadSettings();
  return settings.dailyDigest !== false;
}

function setDailyDigest(enabled) {
  const current = loadSettings();
  current.dailyDigest = Boolean(enabled);
  saveSettings(current);
  return current.dailyDigest;
}

function toggleDailyDigest() {
  const current = loadSettings();
  current.dailyDigest = current.dailyDigest === false ? true : false;
  saveSettings(current);
  return current.dailyDigest;
}

function getLastDailyDigestAt() {
  const settings = loadSettings();
  return Number(settings.lastDailyDigestAt) || 0;
}

function setLastDailyDigestAt(timestamp) {
  const current = loadSettings();
  current.lastDailyDigestAt = timestamp;
  saveSettings(current);
  return current.lastDailyDigestAt;
}

module.exports = {
  loadSettings,
  saveSettings,
  isAutoAccept,
  setAutoAccept,
  toggleAutoAccept,
  isVerboseMode,
  setVerboseMode,
  toggleVerboseMode,
  getWorkspaceDir,
  setWorkspaceDir,
  isAutoLearn,
  setAutoLearn,
  toggleAutoLearn,
  getAutoLearnIntervalHours,
  setAutoLearnIntervalHours,
  getLastAutoLearnAt,
  setLastAutoLearnAt,
  isDailyDigest,
  setDailyDigest,
  toggleDailyDigest,
  getLastDailyDigestAt,
  setLastDailyDigestAt
};

