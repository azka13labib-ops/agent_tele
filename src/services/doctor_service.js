const fs = require('fs');
const path = require('path');
const { openai } = require('../core/ai');
const { AI_MODEL } = require('../config/env');
const settingsManager = require('./settings_manager');

function extractFileAndLineFromStackTrace(errorText, workspaceDir) {
  const fileRegexes = [
    /(?:at\s+(?:.*?\s+)?\(?|\s+at\s+)([a-zA-Z]:\\[^:\s]+|(?:\/[^:\s]+)+):(\d+)(?::(\d+))?\)?/,
    /File\s+["']([^"']+)["'],\s+line\s+(\d+)/i,
    /([a-zA-Z0-9_\-\.\/\\]+\.(?:js|ts|jsx|tsx|py|go|rs|json)):(\d+)/i
  ];

  for (const regex of fileRegexes) {
    const match = errorText.match(regex);
    if (match) {
      const candidatePath = match[1];
      const lineNumber = parseInt(match[2], 10);

      let resolvedPath = candidatePath;
      if (!path.isAbsolute(resolvedPath)) {
        resolvedPath = path.join(workspaceDir, candidatePath);
      }

      if (fs.existsSync(resolvedPath)) {
        return { filePath: resolvedPath, lineNumber };
      }
    }
  }

  return null;
}

function getCodeContext(filePath, targetLine, radius = 8) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const start = Math.max(0, targetLine - radius - 1);
    const end = Math.min(lines.length, targetLine + radius);

    let snippet = "";
    for (let i = start; i < end; i++) {
      const num = i + 1;
      const marker = num === targetLine ? ">> " : "   ";
      snippet += `${marker}${num}: ${lines[i]}\n`;
    }
    return snippet;
  } catch {
    return null;
  }
}

async function diagnoseError(errorLogText) {
  if (!errorLogText || typeof errorLogText !== 'string' || errorLogText.trim().length === 0) {
    return {
      success: false,
      error: "Pesan error kosong. Ketik `/doctor <paste error log>` untuk mendiagnosis masalah."
    };
  }

  const workspace = settingsManager.getWorkspaceDir();
  const fileInfo = extractFileAndLineFromStackTrace(errorLogText, workspace);
  let codeContextSnippet = "";

  if (fileInfo) {
    const snippet = getCodeContext(fileInfo.filePath, fileInfo.lineNumber);
    if (snippet) {
      codeContextSnippet = `\nLOKASI SUMBER KODE (${path.basename(fileInfo.filePath)} baris ${fileInfo.lineNumber}):\n\`\`\`\n${snippet}\n\`\`\`\n`;
    }
  }

  const prompt = `
Kamu adalah Emergency Error Doctor, Debugging Specialist, dan Principal SRE Engineer kelas dunia.
Tugasmu adalah menganalisis pesan error atau stack trace di bawah ini, mendiagnosis akar masalahnya secara presisi, dan memberikan perbaikan kode konkret.

PESAN ERROR / STACK TRACE:
\`\`\`
${errorLogText.substring(0, 10000)}
\`\`\`
${codeContextSnippet}

Format Jawaban yang Wajib Kamu Berikan (Gunakan Markdown Telegram):

🩺 *DIAGNOSIS ERROR & AKAR MASALAH:*
(Jelaskan secara lugas apa yang sebenarnya gagal dan mengapa error ini terjadi)

📍 *LOKASI TERDAMPAK:*
(Sebutkan file, fungsi, atau modul yang menjadi pemicu)

🩹 *REKOMENDASI PERBAIKAN KODE (THE FIX):*
\`\`\`
(Tuliskan perbaikan kode konkret yang siap pakai atau konfigurasi yang perlu diubah)
\`\`\`

🛡️ *TINDAKAN PENCEGAHAN:*
(1-2 tips teknis agar bug serupa tidak terulang di masa mendatang)
`;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Kamu adalah debugging doctor profesional. Analisis error dengan cepat, to-the-point, dan berikan solusi kode yang langsung bisa menyelesaikan masalah.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    });

    const result = response.choices[0]?.message?.content || "Gagal menghasilkan diagnosis.";
    return {
      success: true,
      diagnosisText: result,
      detectedFile: fileInfo ? fileInfo.filePath : null
    };
  } catch (err) {
    return {
      success: false,
      error: `Gagal mendiagnosis error: ${err.message}`
    };
  }
}

module.exports = {
  diagnoseError
};
