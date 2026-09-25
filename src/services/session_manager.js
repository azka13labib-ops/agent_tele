const fs = require('fs');
const path = require('path');
const SYSTEM_PROMPT = require('../config/system_prompt');
const knowledgeManager = require('./knowledge_manager');
const settingsManager = require('./settings_manager');
const { SESSIONS_DIR, ensureDirectories } = require('../config/paths');

function getFullSystemPrompt() {
  const knowledgeContext = knowledgeManager.getKnowledgeContext();
  const workspace = settingsManager.getWorkspaceDir();
  const wsContext = `\n\n[Active Workspace Directory: ${workspace}]`;
  if (knowledgeContext && knowledgeContext.trim()) {
    return `${SYSTEM_PROMPT}${wsContext}\n\n${knowledgeContext.trim()}`;
  }
  return `${SYSTEM_PROMPT}${wsContext}`;
}

function ensureDir() {
  ensureDirectories();
}

function getMetaPath(chatId) {
  ensureDir();
  return path.join(SESSIONS_DIR, `user_${chatId}_meta.json`);
}

function getSessionFilePath(chatId, sessionId) {
  ensureDir();
  return path.join(SESSIONS_DIR, `chat_${chatId}_${sessionId}.json`);
}

function loadUserMeta(chatId) {
  const metaPath = getMetaPath(chatId);
  if (fs.existsSync(metaPath)) {
    try {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    } catch {

    }
  }

  const initialSessionId = `sess_${Date.now()}`;
  const defaultMeta = {
    activeSessionId: initialSessionId,
    sessions: [
      {
        id: initialSessionId,
        title: "Session Utama",
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ]
  };

  saveUserMeta(chatId, defaultMeta);
  return defaultMeta;
}

function saveUserMeta(chatId, meta) {
  try {
    ensureDir();
    fs.writeFileSync(getMetaPath(chatId), JSON.stringify(meta, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error saving user meta (${chatId}):`, err.message);
  }
}

function getSessionMessages(chatId, sessionId) {
  const filePath = getSessionFilePath(chatId, sessionId);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(data) && data.length > 0) {

        if (data[0] && data[0].role === 'system') {
          data[0].content = getFullSystemPrompt();
        } else {
          data.unshift({ role: 'system', content: getFullSystemPrompt() });
        }
        return data;
      }
    } catch (err) {
      console.error(`Error reading session file (${sessionId}):`, err.message);
    }
  }

  const initialMessages = [{ role: "system", content: getFullSystemPrompt() }];
  saveSessionMessages(chatId, sessionId, initialMessages);
  return initialMessages;
}

function saveSessionMessages(chatId, sessionId, messages) {
  try {
    ensureDir();
    const filePath = getSessionFilePath(chatId, sessionId);
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), 'utf-8');

    const meta = loadUserMeta(chatId);
    const sess = meta.sessions.find(s => s.id === sessionId);
    if (sess) {
      sess.updatedAt = Date.now();
      saveUserMeta(chatId, meta);
    }
  } catch (err) {
    console.error(`Error saving session messages (${sessionId}):`, err.message);
  }
}

function getActiveSession(chatId) {
  const meta = loadUserMeta(chatId);
  let activeId = meta.activeSessionId;

  let sess = meta.sessions.find(s => s.id === activeId);
  if (!sess) {
    if (meta.sessions.length > 0) {
      sess = meta.sessions[0];
      activeId = sess.id;
      meta.activeSessionId = activeId;
      saveUserMeta(chatId, meta);
    } else {
      return createSession(chatId, "Session Utama");
    }
  }

  const messages = getSessionMessages(chatId, activeId);
  return {
    id: sess.id,
    title: sess.title,
    createdAt: sess.createdAt,
    updatedAt: sess.updatedAt,
    messages
  };
}

function createSession(chatId, title = "") {
  const meta = loadUserMeta(chatId);
  const newId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const finalTitle = title.trim() || `Session ${meta.sessions.length + 1}`;

  const newSessionInfo = {
    id: newId,
    title: finalTitle,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  meta.sessions.push(newSessionInfo);
  meta.activeSessionId = newId;
  saveUserMeta(chatId, meta);

  const initialMessages = [{ role: "system", content: getFullSystemPrompt() }];
  saveSessionMessages(chatId, newId, initialMessages);

  return {
    id: newId,
    title: finalTitle,
    createdAt: newSessionInfo.createdAt,
    updatedAt: newSessionInfo.updatedAt,
    messages: initialMessages
  };
}

function switchSession(chatId, sessionId) {
  const meta = loadUserMeta(chatId);
  const target = meta.sessions.find(s => s.id === sessionId);
  if (!target) return null;

  meta.activeSessionId = sessionId;
  saveUserMeta(chatId, meta);

  const messages = getSessionMessages(chatId, sessionId);
  return {
    id: target.id,
    title: target.title,
    messages
  };
}

function deleteSession(chatId, sessionId) {
  const meta = loadUserMeta(chatId);
  const targetIndex = meta.sessions.findIndex(s => s.id === sessionId);
  if (targetIndex === -1) return false;

  const deletedSession = meta.sessions.splice(targetIndex, 1)[0];

  const filePath = getSessionFilePath(chatId, sessionId);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {}
  }

  if (meta.activeSessionId === sessionId) {
    if (meta.sessions.length > 0) {
      meta.activeSessionId = meta.sessions[0].id;
    } else {

      const fresh = createSession(chatId, "Session Utama");
      return { deletedTitle: deletedSession.title, newActive: fresh };
    }
  }

  saveUserMeta(chatId, meta);
  const newActive = getActiveSession(chatId);
  return { deletedTitle: deletedSession.title, newActive };
}

function renameSession(chatId, sessionId, newTitle) {
  const meta = loadUserMeta(chatId);
  const sess = meta.sessions.find(s => s.id === sessionId);
  if (!sess) return false;

  sess.title = newTitle.trim();
  sess.updatedAt = Date.now();
  saveUserMeta(chatId, meta);
  return sess;
}

function listSessions(chatId) {
  const meta = loadUserMeta(chatId);
  return meta.sessions.map(s => {
    const msgs = getSessionMessages(chatId, s.id);

    const userMsgCount = msgs.filter(m => m.role === 'user').length;
    return {
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      isActive: s.id === meta.activeSessionId,
      messageCount: userMsgCount
    };
  });
}

function resetActiveSession(chatId) {
  const active = getActiveSession(chatId);
  const freshMessages = [{ role: "system", content: getFullSystemPrompt() }];
  saveSessionMessages(chatId, active.id, freshMessages);
  return active;
}

function autoSetTitleIfDefault(chatId, sessionId, text) {
  const meta = loadUserMeta(chatId);
  const sess = meta.sessions.find(s => s.id === sessionId);
  if (!sess) return;

  if (sess.title.startsWith("Session ") || sess.title === "Session Utama") {
    const cleanText = text.replace(/[\r\n]+/g, ' ').trim();
    if (cleanText.length > 0) {
      sess.title = cleanText.length > 30 ? cleanText.substring(0, 30) + '...' : cleanText;
      saveUserMeta(chatId, meta);
    }
  }
}

module.exports = {
  getActiveSession,
  getSessionMessages,
  saveSessionMessages,
  createSession,
  switchSession,
  deleteSession,
  renameSession,
  listSessions,
  resetActiveSession,
  autoSetTitleIfDefault,
  getFullSystemPrompt
};

