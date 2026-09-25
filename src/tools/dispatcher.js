const { execSync } = require('child_process');
const { REMOTE_WORKER_URL, WORKER_SECRET } = require('../config/env');
const settingsManager = require('../services/settings_manager');
const { executeLocalTool } = require('./local_executor');

async function executeTool(name, args) {
  if (name === 'atur_auto_accept') {
    const isEnable = Boolean(args.aktif);
    settingsManager.setAutoAccept(isEnable);
    return isEnable
      ? "Mode Auto-Accept BERHASIL DIAKTIFKAN. Semua perintah terminal dan pembuatan file ke depan akan dieksekusi instan tanpa meminta konfirmasi manual."
      : "Mode Auto-Accept BERHASIL DINONAKTIFKAN. Perintah berpotensi sensitif akan kembali meminta konfirmasi manual.";
  }

  if (name === 'atur_workspace') {
    const newDir = settingsManager.setWorkspaceDir(args.pathDirektori);
    return `Direktori workspace berhasil diubah menjadi: "${newDir}". Semua operasi terminal dan file berikutnya akan menggunakan direktori ini.`;
  }

  if (name === 'baca_web') {
    return executeLocalTool('baca_web', args);
  }

  const activeWorkspace = settingsManager.getWorkspaceDir();
  const dispatchedArgs = { ...args, _workspaceDir: activeWorkspace };

  if (REMOTE_WORKER_URL) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 65000);

      const resp = await fetch(`${REMOTE_WORKER_URL}/api/execute-tool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WORKER_SECRET}`
        },
        body: JSON.stringify({ name, args: dispatchedArgs }),
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

  if (!REMOTE_WORKER_URL && process.platform === 'linux') {
    if (name === 'cek_gpu') {
      try {
        execSync('nvidia-smi --version', { stdio: 'pipe' });
      } catch {
        return `⚠️ *GPU NVIDIA tidak ditemukan di Server Linux!*\n\nBot saat ini berjalan di server cloud tanpa konfigurasi \`REMOTE_WORKER_URL\`.\n\n💡 *Solusi agar bisa membaca GPU RTX 4060 di laptopmu:*\n1. Tambahkan baris ini di file \`.env\` server:\n   \`REMOTE_WORKER_URL=http://<IP_TAILSCALE_LAPTOP>:20130\`\n2. Pastikan di laptop utama \`node laptop_worker.js\` sedang aktif dan terhubung Tailscale.`;
      }
    }
  }

  return executeLocalTool(name, dispatchedArgs);
}

module.exports = {
  executeTool
};

