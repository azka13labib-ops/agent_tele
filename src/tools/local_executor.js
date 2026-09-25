const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { handleDlTool } = require('./dl_tools');
const knowledgeManager = require('../services/knowledge_manager');

/**
 * Eksekusi tools lokal di komputer / laptop Windows
 */
async function executeLocalTool(name, args) {
  try {
    const dlResult = handleDlTool(name, args);
    if (dlResult !== null) return dlResult;

    if (name === "pelajari_repo") {
      const res = await knowledgeManager.studyGithubRepo(args.repoUrl, args.focusTopic);
      if (res.success) {
        return `✅ Berhasil mempelajari repositori "${res.entry.title}"!\nRingkasan: ${res.entry.summary}\nPoin Kunci:\n- ${res.entry.keyTakeaways.join('\n- ')}\nCatatan lengkap tersimpan di: ${res.entry.noteFile}\nPengetahuan ini sekarang sudah tersimpan permanen di memori Hermes dan siap digunakan.`;
      } else {
        return `❌ Gagal mempelajari repositori: ${res.error}`;
      }
    }

    if (name === "pelajari_url") {
      const res = await knowledgeManager.studyUrl(args.url, args.focusTopic);
      if (res.success) {
        let out = `✅ Berhasil mempelajari URL "${res.entry.title}" (${res.entry.type})!\nRingkasan: ${res.entry.summary}\n`;
        if (res.entry.keyTakeaways && res.entry.keyTakeaways.length) {
          out += `Poin Kunci:\n- ${res.entry.keyTakeaways.join('\n- ')}\n`;
        }
        out += `Catatan lengkap tersimpan di: ${res.entry.noteFile}\nPengetahuan ini sekarang sudah aktif permanen di otak Hermes.`;
        return out;
      } else {
        return `❌ Gagal mempelajari URL: ${res.error}`;
      }
    }

    if (name === "cari_pengetahuan") {
      return knowledgeManager.searchKnowledge(args.query);
    }

    if (name === "lihat_folder") {
      const folderPath = path.resolve(args.pathFolder || "./");
      if (!fs.existsSync(folderPath)) {
        return `Error: Folder "${args.pathFolder}" tidak ditemukan.`;
      }
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      if (entries.length === 0) return `Folder "${args.pathFolder}" kosong.`;

      const list = entries.map(e => {
        if (e.isDirectory()) return `📁 [DIR]  ${e.name}`;
        try {
          const stats = fs.statSync(path.join(folderPath, e.name));
          const sizeKb = (stats.size / 1024).toFixed(1);
          return `📄 [FILE] ${e.name} (${sizeKb} KB)`;
        } catch {
          return `📄 [FILE] ${e.name}`;
        }
      }).join('\n');

      return `Isi folder "${args.pathFolder}":\n${list}`;
    }

    if (name === "baca_file") {
      const filePath = path.resolve(args.namaFile);
      const baseName = path.basename(filePath).toLowerCase();
      if (baseName === '.env' || baseName.startsWith('.env.')) {
        return `Error Keamanan: Akses ke file konfigurasi rahasia "${args.namaFile}" diblokir demi keamanan!`;
      }
      if (!fs.existsSync(filePath)) {
        return `Error: File "${args.namaFile}" tidak ditemukan.`;
      }
      const raw = fs.readFileSync(filePath, 'utf-8');
      const lines = raw.split(/\r?\n/);
      const start = Math.max(0, (args.startLine || 1) - 1);
      const max = args.maxLines || 150;
      const end = Math.min(lines.length, start + max);

      const sliced = lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n');
      let header = `File: ${args.namaFile} (Baris ${start + 1} - ${end} dari total ${lines.length} baris)\n`;
      if (end < lines.length) {
        header += `[Catatan: Masih ada baris berikutnya. Gunakan startLine=${end + 1} untuk melanjutkan]\n`;
      }
      return header + sliced;
    }

    if (name === "tulis_file") {
      const filePath = path.resolve(args.namaFile);
      const baseName = path.basename(filePath).toLowerCase();
      if (baseName === '.env' || baseName.startsWith('.env.')) {
        return `Error Keamanan: Mengubah file konfigurasi rahasia "${args.namaFile}" diblokir demi keamanan!`;
      }
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const isExist = fs.existsSync(filePath);
      fs.writeFileSync(filePath, args.konten, 'utf-8');
      return `Sukses: File "${args.namaFile}" berhasil ${isExist ? 'diperbarui' : 'dibuat'}. Total: ${args.konten.length} karakter.`;
    }

    if (name === "jalankan_cmd") {
      const stdout = execSync(args.perintah, {
        shell: 'powershell.exe',
        encoding: 'utf-8',
        timeout: 45000,
        maxBuffer: 1024 * 1024 * 4
      });
      return stdout.trim() || "Perintah berhasil dijalankan (tidak ada output teks).";
    }

    if (name === "cari_file") {
      const keyword = (args.kataKunci || '').toLowerCase();
      const root = path.resolve(args.rootFolder || './');
      const found = [];

      function searchRec(dir) {
        if (found.length >= 30) return;
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          if (['node_modules', '.git', '.snapshots', 'sessions'].includes(item.name)) continue;
          const full = path.join(dir, item.name);
          const rel = path.relative(root, full);
          if (item.name.toLowerCase().includes(keyword)) {
            found.push(item.isDirectory() ? `📁 ${rel}/` : `📄 ${rel}`);
          }
          if (item.isDirectory() && found.length < 30) {
            try { searchRec(full); } catch {}
          }
        }
      }

      searchRec(root);
      if (found.length === 0) return `Tidak ditemukan file atau folder yang mengandung "${args.kataKunci}".`;
      return `Hasil pencarian untuk "${args.kataKunci}" (${found.length} ditemukan):\n` + found.join('\n');
    }

    if (name === "baca_web") {
      try {
        const response = await fetch(args.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          signal: AbortSignal.timeout(20000)
        });

        if (!response.ok) {
          return `Error mengambil URL: HTTP ${response.status} ${response.statusText}`;
        }

        const html = await response.text();

        // Bersihkan HTML tag dan script/style
        let cleaned = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
          .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
          .replace(/<!--[\s\S]*?-->/g, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&quot;/gi, '"')
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/\s+/g, ' ')
          .trim();

        if (args.fokus) {
          const lowerFocus = args.fokus.toLowerCase();
          const words = cleaned.split(' ');
          const matchingSnippets = [];
          for (let i = 0; i < words.length; i++) {
            if (words[i].toLowerCase().includes(lowerFocus)) {
              const start = Math.max(0, i - 25);
              const end = Math.min(words.length, i + 35);
              matchingSnippets.push(words.slice(start, end).join(' '));
              i += 30; // loncat agar tidak duplicate
              if (matchingSnippets.length >= 5) break;
            }
          }
          if (matchingSnippets.length > 0) {
            return `Hasil baca web "${args.url}" dengan fokus "${args.fokus}":\n\n` +
              matchingSnippets.map((s, idx) => `[Konteks ${idx + 1}]: ...${s}...`).join('\n\n');
          }
        }

        const maxChars = 4500;
        if (cleaned.length > maxChars) {
          cleaned = cleaned.substring(0, maxChars) + "\n\n...[Konten dipotong. Gunakan parameter 'fokus' untuk mencari bagian spesifik]";
        }

        return `Hasil ekstraksi dari "${args.url}":\n\n${cleaned || '(Halaman tidak memiliki teks yang terbaca)'}`;
      } catch (err) {
        return `Gagal membaca URL "${args.url}": ${err.message}`;
      }
    }

    return `Fungsi "${name}" tidak dikenali.`;
  } catch (err) {
    let out = `Error eksekusi "${name}": ${err.message}`;
    if (err.stdout) out += `\nSTDOUT:\n${err.stdout}`;
    if (err.stderr) out += `\nSTDERR:\n${err.stderr}`;
    return out;
  }
}

module.exports = {
  executeLocalTool,
  executeTool: executeLocalTool // Alias for backwards compatibility
};
