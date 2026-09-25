const fs = require('fs');
const path = require('path');
const { openai } = require('../core/ai');
const { AI_MODEL } = require('../config/env');
const settingsManager = require('./settings_manager');

async function reviewCodeSnippet(code, contextName = "Cuplikan Kode") {
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return { success: false, error: "Kode kosong atau tidak valid untuk direview." };
  }

  const prompt = `
Kamu adalah Principal Staff Software Engineer & Chief Security Auditor kelas dunia.
Tugasmu adalah mereview kode berikut secara mendalam, kritis, namun solutif dan aplikatif untuk developer.

Subjek: ${contextName}

KODE YANG DIREVIEW:
\`\`\`
${code.substring(0, 15000)}
\`\`\`

Format Jawaban yang Wajib Kamu Ikuti (Gunakan Markdown Telegram):

🔍 *HASIL CODE REVIEW & SECURITY AUDIT — ${contextName}*

🛡️ *1. Keamanan & Celah Potensial:*
(Analisis sanitasi input, potensi injection, kebocoran token/secret, dan celah otentikasi/otorisasi)

🐛 *2. Kualitas Kode & Potensi Bug:*
(Analisis error handling, unhandled promises, null/undefined safety, dan edge cases)

⚡ *3. Performa & Arsitektur:*
(Analisis efisiensi algoritma/query, Clean Architecture, SOLID principles, dan modularitas)

💡 *4. Rekomendasi Refactoring & Kode Terbaik:*
\`\`\`
(Berikan versi kode yang telah diperbaiki dan lebih bersih)
\`\`\`

🎯 *Kesimpulan:*
(1-2 kalimat ringkasan skor dan prioritas perbaikan utama)
`;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Kamu adalah Principal Software Engineer & Security Auditor profesional. Berikan review kode berbahasa Indonesia yang lugas, teknis, to-the-point, dan berbobot tinggi.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    });

    const result = response.choices[0]?.message?.content || "Gagal menghasilkan review.";
    return { success: true, reviewText: result };
  } catch (err) {
    return { success: false, error: `Gagal memproses review: ${err.message}` };
  }
}

async function reviewWorkspaceFile(relativeOrFullPath) {
  const workspace = settingsManager.getWorkspaceDir();
  let targetPath = path.isAbsolute(relativeOrFullPath)
    ? relativeOrFullPath
    : path.join(workspace, relativeOrFullPath);

  if (!fs.existsSync(targetPath)) {
    const altPath = path.join(process.cwd(), relativeOrFullPath);
    if (fs.existsSync(altPath)) {
      targetPath = altPath;
    } else {
      return { success: false, error: `File tidak ditemukan pada path:\n\`${targetPath}\`` };
    }
  }

  try {
    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
      return { success: false, error: `Path tersebut adalah direktori, bukan file:\n\`${targetPath}\`` };
    }

    const content = fs.readFileSync(targetPath, 'utf-8');
    const fileName = path.basename(targetPath);
    return await reviewCodeSnippet(content, `File: ${fileName}`);
  } catch (err) {
    return { success: false, error: `Gagal membaca file: ${err.message}` };
  }
}

function findRecentCodeFiles(dir, maxFiles = 5) {
  const results = [];
  const ignored = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'vendor', 'coverage', '.cache', 'sessions', 'knowledge']);

  function scan(currentDir, depth = 0) {
    if (depth > 4) return;
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        scan(fullPath, depth + 1);
      } else if (entry.isFile() && /\.(js|ts|jsx|tsx|py|go|rs|cpp|c|java|php|sql)$/i.test(entry.name)) {
        try {
          const stat = fs.statSync(fullPath);
          results.push({
            path: fullPath,
            name: entry.name,
            mtime: stat.mtimeMs,
            size: stat.size
          });
        } catch {}
      }
    }
  }

  scan(dir);
  results.sort((a, b) => b.mtime - a.mtime);
  return results.slice(0, maxFiles);
}

async function reviewRecentWorkspaceCode() {
  const workspace = settingsManager.getWorkspaceDir();
  const recentFiles = findRecentCodeFiles(workspace, 5);

  if (recentFiles.length === 0) {
    return {
      success: false,
      error: `Tidak ditemukan file kode (JS, TS, Python, dll) di workspace:\n\`${workspace}\``
    };
  }

  const latestFile = recentFiles[0];
  const fileReview = await reviewWorkspaceFile(latestFile.path);

  if (!fileReview.success) return fileReview;

  const fileListText = recentFiles.map((f, i) => `• \`${path.relative(workspace, f.path).replace(/\\/g, '/')}\``).join('\n');
  const combinedText =
    `📁 *File Kode Terakhir di Workspace:*\n${fileListText}\n\n` +
    `_Sedang mereview file paling baru diubah:_\n\`${latestFile.name}\`\n\n---\n\n` +
    fileReview.reviewText;

  return { success: true, reviewText: combinedText, reviewedFile: latestFile.path };
}

module.exports = {
  reviewCodeSnippet,
  reviewWorkspaceFile,
  reviewRecentWorkspaceCode
};
