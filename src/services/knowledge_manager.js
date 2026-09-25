const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { openai } = require('../core/ai');
const { KNOWLEDGE_DIR, NOTES_DIR, REPOS_DIR, INDEX_FILE, ensureDirectories } = require('../config/paths');

// Inisialisasi folder knowledge
function ensureDirs() {
  ensureDirectories();
}

// Baca index knowledge
function loadIndex() {
  ensureDirs();
  try {
    const raw = fs.readFileSync(INDEX_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading knowledge index:", err.message);
    return [];
  }
}

// Simpan index knowledge
function saveIndex(indexData) {
  ensureDirs();
  try {
    fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2), 'utf-8');
  } catch (err) {
    console.error("Error saving knowledge index:", err.message);
  }
}

// Inisialisasi OpenAI client untuk analisis mendalam
function getOpenAIClient() {
  return openai;
}

/**
 * Format prompt knowledge context untuk diinjeksi ke System Prompt
 */
function getKnowledgeContext() {
  const index = loadIndex();
  if (!index || index.length === 0) {
    return "";
  }

  let text = "\n\n## 🧠 MEMORY & KNOWLEDGE BASE PERMANEN (YANG SUDAH DIPELAJARI)\n";
  text += "Hermes telah mempelajari dan menyimpan repositori, materi, dan skill berikut ke dalam memori permanen:\n\n";

  index.forEach((item, idx) => {
    const tags = item.tags && item.tags.length ? ` [${item.tags.join(', ')}]` : '';
    text += `${idx + 1}. **${item.title}** (${item.type})${tags}\n`;
    text += `   - **Ringkasan:** ${item.summary}\n`;
    if (item.keyTakeaways && item.keyTakeaways.length) {
      text += `   - **Poin Kunci:** ${item.keyTakeaways.join('; ')}\n`;
    }
    text += `   - **File Catatan Lengkap:** \`${item.noteFile}\`\n\n`;
  });

  text += `> *Instruksi Pengetahuan:* Gunakan pemahaman dari materi di atas saat user bertanya atau meminta solusi terkait topik tersebut. Jika perlu membaca kode/catatan lengkapnya, gunakan tool \`baca_file\` pada path file catatan di atas.\n`;

  return text;
}

/**
 * Parser hasil analisis AI yang tangguh terhadap truncation atau variasi format model
 */
function parseAiKnowledgeOutput(rawText, defaultTitle, defaultTags, defaultSummary) {
  let title = defaultTitle;
  let tags = defaultTags || [];
  let summary = defaultSummary || "";
  let keyTakeaways = [];
  let detailedNotes = "";

  // 1. Cek format delimiter: ---METADATA--- dan ---DETAILED_NOTES---
  if (rawText.includes('---METADATA---') || rawText.includes('---DETAILED_NOTES---')) {
    const metaMatch = rawText.match(/---METADATA---([\s\S]*?)(?:---DETAILED_NOTES---|$)/i);
    const notesMatch = rawText.match(/---DETAILED_NOTES---([\s\S]*)$/i);

    if (metaMatch) {
      const metaBlock = metaMatch[1];
      const tMatch = metaBlock.match(/TITLE:\s*([^\r\n]+)/i);
      if (tMatch && tMatch[1].trim()) title = tMatch[1].trim();

      const tagMatch = metaBlock.match(/TAGS:\s*([^\r\n]+)/i);
      if (tagMatch) {
        tags = tagMatch[1].split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      }

      const sMatch = metaBlock.match(/SUMMARY:\s*([\s\S]*?)(?=KEY_TAKEAWAYS:|---DETAILED_NOTES---|$)/i);
      if (sMatch && sMatch[1].trim()) {
        summary = sMatch[1].replace(/\s+/g, ' ').trim();
      }

      const kwMatch = metaBlock.match(/KEY_TAKEAWAYS:\s*([\s\S]*?)(?=---DETAILED_NOTES---|$)/i);
      if (kwMatch) {
        const lines = kwMatch[1].split(/\r?\n/);
        for (const line of lines) {
          const clean = line.replace(/^[\s*•\-–\d.)]+/, '').trim();
          if (clean.length > 5) keyTakeaways.push(clean);
        }
      }
    }

    if (notesMatch && notesMatch[1].trim()) {
      detailedNotes = notesMatch[1].trim();
    } else {
      detailedNotes = rawText.replace(/---METADATA---[\s\S]*?(?:---DETAILED_NOTES---|$)/i, '').trim();
    }

    if (summary && detailedNotes) {
      return { title, tags, summary, keyTakeaways, detailedNotes };
    }
  }

  // 2. Cek format JSON jika model merespon dalam JSON
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title || defaultTitle,
        tags: parsed.tags && parsed.tags.length ? parsed.tags : defaultTags,
        summary: parsed.summary || defaultSummary,
        keyTakeaways: parsed.keyTakeaways || [],
        detailedNotes: parsed.detailedNotes || rawText
      };
    } catch {}
  }

  // 3. Fallback jika output polos
  return {
    title: defaultTitle,
    tags: defaultTags,
    summary: summary || defaultSummary,
    keyTakeaways: keyTakeaways,
    detailedNotes: detailedNotes || rawText
  };
}

/**
 * Pelajari Repositori GitHub
 */
async function studyGithubRepo(repoUrl, focusTopic = "") {
  ensureDirs();

  // Validasi URL
  const match = repoUrl.match(/github\.com\/([a-zA-Z0-9_\-.]+)\/([a-zA-Z0-9_\-.]+)/i);
  if (!match) {
    return {
      success: false,
      error: "Format URL GitHub tidak valid. Contoh yang benar: https://github.com/owner/repository"
    };
  }

  const owner = match[1];
  let repoName = match[2].replace(/\.git$/, '');
  const slug = `${owner}_${repoName}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const targetDir = path.join(REPOS_DIR, `temp_${slug}_${Date.now()}`);

  try {
    // 1. Clone shallow (--depth 1)
    const cleanRepoUrl = `https://github.com/${owner}/${repoName}.git`;
    console.log(`Cloning ${cleanRepoUrl} into ${targetDir}...`);
    execSync(`git clone --depth 1 "${cleanRepoUrl}" "${targetDir}"`, {
      encoding: 'utf-8',
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (!fs.existsSync(targetDir)) {
      return { success: false, error: "Gagal mengklon repositori ke folder lokal." };
    }

    // 2. Scan file dan struktur direktori
    const dirEntries = fs.readdirSync(targetDir, { withFileTypes: true });
    const structureSummary = [];
    let readmeContent = "";
    let packageInfo = "";
    const sourceSnippets = [];

    // Baca README
    const readmeFile = dirEntries.find(e => /^readme(\.(md|markdown|rst|txt))?$/i.test(e.name));
    if (readmeFile) {
      try {
        const rawReadme = fs.readFileSync(path.join(targetDir, readmeFile.name), 'utf-8');
        readmeContent = rawReadme.substring(0, 10000); // Ambil sampai 10k karakter
      } catch {}
    }

    // Baca package.json atau requirements.txt atau Cargo.toml
    const depFiles = ['package.json', 'requirements.txt', 'pyproject.toml', 'Cargo.toml', 'go.mod'];
    for (const df of depFiles) {
      const depPath = path.join(targetDir, df);
      if (fs.existsSync(depPath)) {
        try {
          const content = fs.readFileSync(depPath, 'utf-8');
          packageInfo += `\n--- ${df} ---\n${content.substring(0, 2000)}\n`;
        } catch {}
      }
    }

    // Scan file struktur tingkat 1 & 2
    for (const e of dirEntries) {
      if (['.git', 'node_modules', 'dist', 'build', '.github'].includes(e.name)) continue;
      if (e.isDirectory()) {
        structureSummary.push(`📁 ${e.name}/`);
        try {
          const sub = fs.readdirSync(path.join(targetDir, e.name), { withFileTypes: true });
          sub.slice(0, 8).forEach(s => {
            structureSummary.push(`   └─ ${s.isDirectory() ? '📁' : '📄'} ${s.name}`);
          });
        } catch {}
      } else {
        structureSummary.push(`📄 ${e.name}`);
      }
    }

    // Ambil sampel file kode penting (maksimal 3 file)
    function findCodeFiles(dir, max = 3) {
      const results = [];
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const it of items) {
        if (['.git', 'node_modules', 'dist', 'build', 'vendor'].includes(it.name)) continue;
        const full = path.join(dir, it.name);
        if (it.isFile() && /\.(js|ts|py|go|rs|cpp|c|sh|json)$/i.test(it.name)) {
          if (!it.name.includes('.min.') && !it.name.includes('test') && !it.name.includes('spec')) {
            results.push(full);
            if (results.length >= max) break;
          }
        } else if (it.isDirectory() && results.length < max) {
          try {
            results.push(...findCodeFiles(full, max - results.length));
          } catch {}
        }
      }
      return results;
    }

    const codeFiles = findCodeFiles(targetDir, 3);
    for (const cf of codeFiles) {
      try {
        const rel = path.relative(targetDir, cf);
        const code = fs.readFileSync(cf, 'utf-8').substring(0, 3500);
        sourceSnippets.push(`\n### Cuplikan File: \`${rel}\`\n\`\`\`\n${code}\n\`\`\``);
      } catch {}
    }

    // 3. Analisis dengan AI (LLM) untuk menghasilkan catatan pengetahuan terstruktur
    const openai = getOpenAIClient();
    let noteMarkdown = "";
    let aiSummary = "";
    let keyTakeaways = [];
    let tags = [];

    const promptPayload = `
Kamu adalah Knowledge & Architecture Analyst AI.
Tugasmu adalah menganalisis repositori GitHub ini secara mendalam agar AI Agent Hermes bisa memahami, mengingat, dan memanfaatkan teknik, arsitektur, dan kode dari repositori ini di masa depan.

Repositori: ${owner}/${repoName} (${cleanRepoUrl})
Fokus Topik Khusus: ${focusTopic || "Arsitektur, pola coding, fungsi utama, dan implementasi terbaik"}

STRUKTUR FILE:
${structureSummary.slice(0, 30).join('\n')}

DEPENDENSI / KONFIGURASI:
${packageInfo || "Tidak ada file dependensi utama."}

README EXCERPT:
${readmeContent ? readmeContent.substring(0, 4000) : "Tidak ada README."}

SAMPEL KODE:
${sourceSnippets.join('\n\n')}

Instruksi Format Output:
Berikan output analisis terstruktur persis dengan penanda delimiter berikut:

---METADATA---
TITLE: ${owner}/${repoName}
TAGS: ${owner}, ${repoName}, deeplearning, architecture
SUMMARY: Ringkasan padat 2-3 kalimat mengenai apa repositori ini dan apa kegunaan utamanya.
KEY_TAKEAWAYS:
- Poin arsitektur / pola penting 1
- Poin arsitektur / pola penting 2
- Poin arsitektur / pola penting 3
- Poin arsitektur / pola penting 4
---DETAILED_NOTES---
# 1. Konsep Utama & Arsitektur
(Penjelasan mendalam arsitektur dan alur kerja repositori...)

# 2. Pola Desain & Teknik Coding Kunci
(Pola desain cerdas, efisiensi komputasi, atau trik teknis...)

# 3. Cuplikan Kode Kunci & Cara Kerja Fungsi
(Snippet kode dan penjelasan cara pakainya...)

# 4. Panduan Penggunaan & Rekomendasi Integrasi
(Tips praktis pemakaian...)
`;

    if (openai) {
      try {
        const model = process.env.AI_MODEL || "deepseek-v4-flash:free";
        const res = await openai.chat.completions.create({
          model: model,
          messages: [{ role: "user", content: promptPayload }],
          temperature: 0.2,
          max_tokens: 2200
        });

        const rawAi = res.choices[0]?.message?.content || "";
        const parsed = parseAiKnowledgeOutput(rawAi, `${owner}/${repoName}`, [owner, repoName], `Repositori ${owner}/${repoName}`);
        aiSummary = parsed.summary;
        keyTakeaways = parsed.keyTakeaways;
        tags = parsed.tags;
        noteMarkdown = parsed.detailedNotes;
      } catch (errAi) {
        console.error("AI Analysis Error:", errAi.message);
        aiSummary = `Repositori ${owner}/${repoName} - Berhasil dipelajari dari README dan struktur kode.`;
        noteMarkdown = `## Analisis Repositori: ${owner}/${repoName}\n\n**README:**\n${readmeContent.substring(0, 3000)}\n\n**Struktur Direktori:**\n${structureSummary.join('\n')}`;
        tags = [owner, repoName];
      }
    } else {
      aiSummary = `Repositori ${owner}/${repoName} - Berhasil diindeks secara lokal.`;
      noteMarkdown = `## Repositori: ${owner}/${repoName}\n\nURL: ${cleanRepoUrl}\n\n**Struktur File:**\n${structureSummary.join('\n')}\n\n**README:**\n${readmeContent.substring(0, 3000)}`;
      tags = [owner, repoName];
    }

    // 4. Simpan catatan ke knowledge/notes/
    const noteFileName = `repo_${slug}.md`;
    const noteFilePath = path.join(NOTES_DIR, noteFileName);
    const fullNoteContent =
      `# 📚 Catatan Pengetahuan: ${owner}/${repoName}\n\n` +
      `- **URL:** ${cleanRepoUrl}\n` +
      `- **Waktu Dipelajari:** ${new Date().toLocaleString('id-ID')}\n` +
      `- **Tags:** ${tags.join(', ')}\n` +
      `- **Ringkasan:** ${aiSummary}\n\n` +
      `---\n\n` +
      `${noteMarkdown}\n\n` +
      `---\n` +
      `### Struktur Berkas Utama\n\`\`\`\n${structureSummary.slice(0, 35).join('\n')}\n\`\`\`\n`;

    fs.writeFileSync(noteFilePath, fullNoteContent, 'utf-8');

    // 5. Update index.json
    const index = loadIndex();
    const existingIdx = index.findIndex(item => item.id === `repo_${slug}`);

    const knowledgeEntry = {
      id: `repo_${slug}`,
      type: "github_repo",
      title: `${owner}/${repoName}`,
      source: cleanRepoUrl,
      tags: tags,
      summary: aiSummary,
      keyTakeaways: keyTakeaways,
      noteFile: path.relative(path.resolve('./'), noteFilePath).replace(/\\/g, '/'),
      learnedAt: Date.now()
    };

    if (existingIdx >= 0) {
      index[existingIdx] = knowledgeEntry;
    } else {
      index.unshift(knowledgeEntry);
    }
    saveIndex(index);

    // 6. Cleanup clone directory untuk menghemat disk
    try {
      fs.rmSync(targetDir, { recursive: true, force: true });
    } catch {}

    return {
      success: true,
      entry: knowledgeEntry,
      notePath: noteFilePath
    };
  } catch (err) {
    // Pastikan folder temp dihapus jika error
    try {
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
    } catch {}

    return {
      success: false,
      error: `Gagal mempelajari repo: ${err.message}`
    };
  }
}

/**
 * Konversi HTML menjadi Markdown terstruktur dan bersih
 */
function cleanHtmlToMarkdown(html) {
  if (!html) return "";

  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '');

  // Coba ambil konten di dalam elemen artikel / main utama jika ada
  const articleMatch = cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
                       cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (articleMatch && articleMatch[1].length > 500) {
    cleaned = articleMatch[1];
  }

  // Konversi heading HTML ke Markdown
  cleaned = cleaned.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n')
                   .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n')
                   .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n')
                   .replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n');

  // Konversi blok kode
  cleaned = cleaned.replace(/<pre\b[^>]*><code\b[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')
                   .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')
                   .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, ' `$1` ');

  // Konversi list
  cleaned = cleaned.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '\n• $1');

  // Konversi paragraf & baris baru
  cleaned = cleaned.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
                   .replace(/<br\s*[\/]?>/gi, '\n');

  // Buang sisa tag HTML
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // Decode karakter HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&copy;/g, '©');

  return cleaned.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}

/**
 * Pelajari Materi dari Segala Jenis URL (Dokumentasi, Blog, ArXiv Paper, HuggingFace, Raw Code)
 */
async function studyUrl(url, focusTopic = "") {
  ensureDirs();

  try {
    let pageTitle = url;
    let contentSample = "";
    let detectedType = "web_document";
    let defaultTags = ["web-knowledge"];

    // ── 1. Spesialisasi URL ArXiv (Paper Ilmiah AI/ML) ──
    const arxivMatch = url.match(/arxiv\.org\/(abs|pdf)\/([0-9]+\.[0-9]+(?:v[0-9]+)?)/i);
    if (arxivMatch) {
      const arxivId = arxivMatch[2];
      detectedType = "research_paper";
      defaultTags = ["arxiv", "paper-ai", "research"];

      const absUrl = `https://arxiv.org/abs/${arxivId}`;
      const res = await fetch(absUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HermesBot/2.4' }
      });
      const html = await res.text();

      const titleMatch = html.match(/<h1 class="title mathjax"><span class="descriptor">Title:<\/span>([\s\S]*?)<\/h1>/i);
      pageTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : `arXiv:${arxivId}`;

      const authorsMatch = html.match(/<div class="authors"><span class="descriptor">Authors:<\/span>([\s\S]*?)<\/div>/i);
      const authors = authorsMatch ? authorsMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : "";

      const absMatch = html.match(/<blockquote class="abstract mathjax"><span class="descriptor">Abstract:<\/span>([\s\S]*?)<\/blockquote>/i);
      const abstract = absMatch ? absMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : "";

      const subjectsMatch = html.match(/<td class="tablecell subjects">([\s\S]*?)<\/td>/i);
      const subjects = subjectsMatch ? subjectsMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : "";

      contentSample =
        `JUDUL PAPER: ${pageTitle}\n` +
        `ARXIV ID: ${arxivId}\n` +
        `PENULIS: ${authors}\n` +
        `SUBJECTS: ${subjects}\n\n` +
        `ABSTRACT:\n${abstract}\n`;
    }

    // ── 2. Spesialisasi Hugging Face (Model Card / Dataset) ──
    else if (url.includes('huggingface.co') && !url.includes('/raw/')) {
      detectedType = "huggingface_model";
      defaultTags = ["huggingface", "ai-model", "deeplearning"];

      const hfMatch = url.match(/huggingface\.co\/([^\/]+)\/([^\/?#]+)/i);
      if (hfMatch) {
        const owner = hfMatch[1];
        const modelName = hfMatch[2];
        pageTitle = `${owner}/${modelName} (Hugging Face)`;

        // Coba fetch README / Model Card langsung dari raw repo HF
        try {
          const rawReadmeRes = await fetch(`https://huggingface.co/${owner}/${modelName}/raw/main/README.md`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HermesBot/2.4' }
          });
          if (rawReadmeRes.ok) {
            const rawText = await rawReadmeRes.text();
            contentSample = rawText.substring(0, 15000);
          }
        } catch {}
      }

      // Fallback jika raw README tidak ada
      if (!contentSample) {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HermesBot/2.4' }
        });
        const html = await res.text();
        contentSample = cleanHtmlToMarkdown(html).substring(0, 12000);
      }
    }

    // ── 3. Spesialisasi File Kode / Raw / Markdown ──
    else if (
      url.includes('raw.githubusercontent.com') ||
      url.includes('gist.github.com') ||
      /\.(md|txt|py|js|ts|json|yaml|yml|rs|go|cpp|c|sh|sql)$/i.test(url.split('?')[0])
    ) {
      detectedType = "code_file";
      defaultTags = ["code", "snippet", "implementation"];
      pageTitle = path.basename(url.split('?')[0]) || "Code / Text Resource";

      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HermesBot/2.4' }
      });
      const rawText = await res.text();
      contentSample = `\`\`\`\n${rawText.substring(0, 15000)}\n\`\`\``;
    }

    // ── 4. URL Umum: Dokumentasi, Artikel Blog, Tutorial, Web Page ──
    else {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain,text/markdown,*/*;q=0.8'
        }
      });

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
        return {
          success: false,
          error: "URL mengarah langsung ke file biner PDF. Disarankan gunakan link halaman web / abstract (misal link arXiv atau link artikel)."
        };
      }

      const html = await res.text();

      // Ekstrak Title
      const titleMatch = html.match(/<title\b[^>]*>([^<]*)<\/title>/i) ||
                         html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i) ||
                         html.match(/<h1\b[^>]*>([^<]*)<\/h1>/i);
      pageTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : url;

      // Konversi HTML ke Markdown terstruktur
      contentSample = cleanHtmlToMarkdown(html).substring(0, 14000);
      if (url.includes('medium.com') || url.includes('dev.to') || url.includes('substack.com')) {
        detectedType = "blog_article";
        defaultTags = ["blog", "tutorial"];
      } else {
        detectedType = "documentation";
        defaultTags = ["docs", "guide"];
      }
    }

    if (!contentSample || contentSample.length < 50) {
      return {
        success: false,
        error: "Konten teks dari URL terlalu pendek atau tidak dapat diekstraksi."
      };
    }

    // ── 5. Analisis Cerdas Menggunakan Model AI ──
    const openai = getOpenAIClient();
    let summary = `Materi dari ${pageTitle}`;
    let keyTakeaways = [];
    let detailedNotes = contentSample.substring(0, 4000);
    let tags = defaultTags;

    if (openai) {
      try {
        const model = process.env.AI_MODEL || "deepseek-v4-flash:free";
        const promptPayload = `
Kamu adalah Principal AI Engineer & Knowledge Curator.
Tugasmu adalah menganalisis materi dari URL ini secara mendalam agar AI Agent Hermes bisa memahami, mengingat, dan menggunakannya di masa depan.

SUMBER URL: ${url}
JUDUL DOKUMEN: ${pageTitle}
TIPE MATERI: ${detectedType}
FOKUS TOPIK: ${focusTopic || "Konsep inti, arsitektur, teknik/metode penting, snippet kode/formula kunci, dan panduan praktis"}

KONTEN MATERI:
${contentSample}

Instruksi Format Output:
Berikan output analisis terstruktur persis dengan penanda delimiter berikut:

---METADATA---
TITLE: ${pageTitle.replace(/[\r\n]/g, ' ')}
TAGS: ${defaultTags.join(', ')}
SUMMARY: Ringkasan padat 2-3 kalimat menjelaskan apa materi ini dan nilai pentingnya.
KEY_TAKEAWAYS:
- Poin kunci / konsep penting 1
- Poin kunci / konsep penting 2
- Poin kunci / konsep penting 3
- Poin kunci / konsep penting 4
---DETAILED_NOTES---
# 1. Konsep Utama & Latar Belakang
(Penjelasan mendalam topik ini...)

# 2. Metode, Arsitektur, atau Alur Kerja Kunci
(Penjelasan langkah teknis, algoritma, atau metodenya...)

# 3. Snippet Kode / Formula / Implementasi Praktis
(Contoh kode atau cara menerapkan...)

# 4. Panduan & Tips Praktis untuk Proyek
(Takeaways dan rekomendasi...)
`;

        const aiRes = await openai.chat.completions.create({
          model: model,
          messages: [{ role: "user", content: promptPayload }],
          temperature: 0.2,
          max_tokens: 2200
        });

        const rawAi = aiRes.choices[0]?.message?.content || "";
        const parsed = parseAiKnowledgeOutput(rawAi, pageTitle, defaultTags, `Materi dari ${pageTitle}`);
        pageTitle = parsed.title;
        summary = parsed.summary;
        keyTakeaways = parsed.keyTakeaways;
        tags = parsed.tags;
        detailedNotes = parsed.detailedNotes;
      } catch (errAi) {
        console.error("AI URL analysis error:", errAi.message);
        summary = `Dokumen teknis "${pageTitle}" - berhasil diindeks dari konten teks.`;
        detailedNotes = `## ${pageTitle}\n\n**Sumber:** ${url}\n\n${contentSample.substring(0, 4000)}`;
      }
    } else {
      summary = `Dokumen teknis "${pageTitle}" - berhasil disimpan ke memori lokal.`;
      detailedNotes = `## ${pageTitle}\n\n**Sumber:** ${url}\n\n${contentSample.substring(0, 4000)}`;
    }

    // ── 6. Simpan Catatan ke knowledge/notes/ ──
    const slug = pageTitle.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 35) || 'doc';
    const noteFileName = `url_${slug}_${Date.now()}.md`;
    const noteFilePath = path.join(NOTES_DIR, noteFileName);

    const fullNoteContent =
      `# 🌐 ${pageTitle}\n\n` +
      `- **URL Sumber:** ${url}\n` +
      `- **Tipe Materi:** ${detectedType}\n` +
      `- **Waktu Dipelajari:** ${new Date().toLocaleString('id-ID')}\n` +
      `- **Tags:** ${tags.join(', ')}\n` +
      `- **Ringkasan:** ${summary}\n\n` +
      `---\n\n` +
      `${detailedNotes}\n`;

    fs.writeFileSync(noteFilePath, fullNoteContent, 'utf-8');

    // ── 7. Daftarkan ke knowledge/index.json ──
    const index = loadIndex();
    const entryId = `url_${slug}_${Date.now()}`;
    const knowledgeEntry = {
      id: entryId,
      type: detectedType,
      title: pageTitle,
      source: url,
      tags: tags,
      summary: summary,
      keyTakeaways: keyTakeaways,
      noteFile: path.relative(path.resolve('./'), noteFilePath).replace(/\\/g, '/'),
      learnedAt: Date.now()
    };

    index.unshift(knowledgeEntry);
    saveIndex(index);

    return {
      success: true,
      entry: knowledgeEntry,
      notePath: noteFilePath
    };
  } catch (err) {
    return {
      success: false,
      error: `Gagal membaca atau mempelajari URL: ${err.message}`
    };
  }
}

/**
 * Cari Pengetahuan di Memory
 */
function searchKnowledge(query) {
  const index = loadIndex();
  const q = (query || '').toLowerCase();

  const matched = index.filter(item => {
    const inTitle = (item.title || '').toLowerCase().includes(q);
    const inSummary = (item.summary || '').toLowerCase().includes(q);
    const inTags = (item.tags || []).some(t => t.toLowerCase().includes(q));
    const inTakeaways = (item.keyTakeaways || []).some(t => t.toLowerCase().includes(q));
    return inTitle || inSummary || inTags || inTakeaways;
  });

  if (matched.length === 0) {
    return `Tidak ditemukan materi terkait "${query}" di memori pengetahuan permanen Hermes.`;
  }

  let res = `🧠 *Ditemukan ${matched.length} materi terkait "${query}":*\n\n`;
  matched.forEach((m, idx) => {
    res += `${idx + 1}. *${m.title}* (${m.type})\n`;
    res += `   📝 ${m.summary}\n`;
    if (m.keyTakeaways && m.keyTakeaways.length) {
      res += `   💡 ${m.keyTakeaways.join(' | ')}\n`;
    }
    res += `   📂 Catatan: \`${m.noteFile}\`\n\n`;
  });

  return res;
}

/**
 * Daftar Semua Pengetahuan yang Sudah Dipelajari
 */
function listKnowledge() {
  const index = loadIndex();
  if (index.length === 0) {
    return (
      `🧠 *Basis Pengetahuan Hermes Masih Kosong!*\n\n` +
      `Lo bisa nyuruh gw belajar repositori atau materi baru:\n` +
      `• \`/learn <link github / url>\`\n` +
      `• Atau suruh di chat: _"Hermes, tolong pelajarin repo https://github.com/..."_\n\n` +
      `Setelah dipelajari, gw bakal simpan intisari dan kodenya secara permanen ke memori!`
    );
  }

  let text = `🧠 *Daftar Pengetahuan & Skill Permanen Hermes (${index.length} materi):*\n\n`;
  index.forEach((item, idx) => {
    const dateStr = new Date(item.learnedAt).toLocaleDateString('id-ID');
    text += `${idx + 1}. *${item.title}*\n`;
    text += `   🏷️ ${item.type} | 📅 ${dateStr}\n`;
    text += `   💡 ${item.summary}\n`;
    text += `   📄 File: \`${item.noteFile}\`\n\n`;
  });

  text += `_Ketik \`/learn <url>\` untuk menambah pengetahuan baru atau tanyakan langsung apa saja terkait repo di atas!_`;
  return text;
}

// ─────────────────────────────────────────────
// Tool Definitions untuk OpenAI Function Calling
// ─────────────────────────────────────────────
const knowledgeToolDefinitions = [
  {
    type: "function",
    function: {
      name: "pelajari_repo",
      description: "Mempelajari repositori GitHub secara mendalam: meng-clone, menganalisis struktur & kode, merangkum arsitektur, dan menyimpannya secara permanen ke basis pengetahuan Hermes agar Hermes makin pintar.",
      parameters: {
        type: "object",
        properties: {
          repoUrl: {
            type: "string",
            description: "URL repositori GitHub lengkap. Contoh: 'https://github.com/huggingface/transformers' atau 'https://github.com/karpathy/nanoGPT'"
          },
          focusTopic: {
            type: "string",
            description: "Fokus topik atau hal yang ingin dipelajari secara khusus (opsional, contoh: 'cara training LoRA', 'pipeline tokenization')"
          }
        },
        required: ["repoUrl"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "pelajari_url",
      description: "Mempelajari dan mengingat materi dari segala jenis URL web (dokumentasi teknis, paper ilmiah ArXiv, model/dataset Hugging Face, artikel blog/tutorial, atau raw code) dan menyimpannya secara permanen ke memori otak Hermes.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "URL lengkap yang ingin dipelajari (contoh: https://arxiv.org/abs/..., https://huggingface.co/..., https://docs.python.org/..., atau link blog/artikel teknis)"
          },
          focusTopic: {
            type: "string",
            description: "Fokus topik atau hal spesifik yang ingin diekstrak (opsional)"
          }
        },
        required: ["url"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cari_pengetahuan",
      description: "Mencari topik, repositori, atau teknik yang pernah dipelajari sebelumnya di memori permanen Hermes.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Kata kunci topik atau nama repositori yang ingin dicari di memori"
          }
        },
        required: ["query"],
        additionalProperties: false
      }
    }
  }
];

module.exports = {
  getKnowledgeContext,
  studyGithubRepo,
  studyUrl,
  searchKnowledge,
  listKnowledge,
  knowledgeToolDefinitions
};
