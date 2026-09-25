# 📚 Catatan Pengetahuan: miqdadbadjuber/anti-slop

- **URL:** https://github.com/miqdadbadjuber/anti-slop.git
- **Waktu Dipelajari:** 25/9/2026, 08.55.22
- **Tags:** miqdadbadjuber, anti-slop, ai-agent-rules, prompt-architecture, design-filter, plugin-marketplace, mcp-server, agent-skills
- **Ringkasan:** Repositori "anti-slop" adalah sistem aturan (rules) untuk AI coding agent yang berfungsi sebagai *filter* — bukan style guide — untuk menghapus "AI slop": copy generik, angka palsu, pola UI klise (sparkle logo, beta pill, fake terminal), tanpa membuat hasil jadi steril. Ia didistribusikan sebagai multi-plugin (Claude, Cline, Codex, Cursor, Kimi) dengan 38 aturan bertingkat (R-01 s/d R-38), Liveliness Toolkit, Delivery Gate, dan CLI + MCP server untuk validasi kontras.

---

# 1. Konsep Utama & Arsitektur

## 1.1 Filosofi Inti
anti-slop mendefinisikan dirinya sebagai **"a filter, not a style guide"**. Artinya repositori ini tidak pernah mengeluarkan instruksi seperti "gunakan biru #0A84FF" atau "pakai font Inter". Yang ia lakukan adalah:
1. **Menghapus** pola-pola slop yang dikenali (sparkle logo, "NEXT-GEN AI 2.0 beta" pill, fake terminal dengan latensi palsu, statistik karangan seperti "10,000% ROI Synergy Multiplier").
2. **Menjaga** agar hasil tidak jadi steril — melalui Liveliness Toolkit (lihat §2).
3. **Menyerahkan direction** ke file eksternal `DESIGN.md` milik user.

Ini membentuk dua-sumbu orthogonal:
- Sumbu **filter** dipegang oleh anti-slop (menghilangkan yang salah).
- Sumbu **arah/keindahan** dipegang oleh `DESIGN.md` (mengisi ruang kosong hasil filter).

README menegaskan: *"A sterile result means the direction was missing, not that the filter failed (R-37)."* Jadi kegagalan estetika bukan tanggung jawab anti-slop.

## 1.2 Tiga Tier Aturan (R-01..R-38)
| Tier | Sifat | Contoh Peran |
|---|---|---|
| **Hard Gate** | Absolut, tidak bisa dinegosiasi | Larangan angka fiktif, testimonial palsu, klaim "AI-powered" sebagai nilai jual |
| **Purpose-Gate** | Teknik diizinkan HANYA jika ada alasan eksplisit | Glassmorphism, gradient, animasi — boleh jika dibenarkan oleh konteks |
| **Quality Locks** | Konsistensi | Token warna konsisten, spacing rhythm konsisten, tidak campur metapora visual |

Perhatikan bahwa sistem ini tidak pernah bilang "jangan pakai gradient" — ia bilang "gradient masuk Purpose-Gate, kamu harus punya alasan". Ini adalah model **gated permission**, bukan blacklist kaku. Ini pola penting: aturan berbasis *reason-required* lebih robust daripada aturan *forbidden-list*, karena agent diminta untuk berpikir, bukan menghafal larangan.

## 1.3 Distribusi Multi-Plugin
Struktur folder menunjukkan repositori ini didesain sebagai **portable spec** yang bisa dikonsumsi berbagai IDE/agent:
```
.claude-plugin/   → plugin.json + marketplace.json + MCP launcher
.cline-plugin/    → plugin.js
.codex-plugin/    → plugin.json
.cursor-plugin/   → marketplace.json + plugin.json
.kimi-plugin/     → plugin.json
.agents/plugins/  → marketplace.json (format agent generik)
```
Semuanya menunjuk ke **root yang sama** (`"./source": "./"`) dan pada `.claude-plugin/plugin.json` memuat skills dari `./skills/` dengan deklarasi MCP server. Ini adalah pola **single-source-of-truth, multi-adapter** — konten aturan ditulis sekali, manifest per-ekosistem hanya membungkusnya.

## 1.4 Alur Kerja Agent
Dari prespektif agent yang memuat anti-slop:
1. **Load manifest** → agent membaca plugin.json untuk tahu skills apa yang tersedia.
2. **Additive load** → agent hanya memuat skill yang relevan dengan task (misal: hanya `copy-writing` untuk task penulisan, hanya `ui-rules` untuk task build UI).
3. **Apply rules** → saat generate, agent melewati setiap output melalui tier Rules (Hard Gate dulu, lalu Purpose-Gate, lalu Quality Locks).
4. **Liveliness pass** → setel dial ENERGY/RHYTHM/MOTION + Design Read agar tidak flat.
5. **Delivery Gate** → wajibkan laporan PASS/FAIL empat blok sebelum output dianggap selesai.
6. **Optionally** call MCP `antislop-contrast` untuk validasi kontras warna (a11y).

# 2. Pola Desain & Teknik Coding Kunci

## 2.1 Pola: Filter-Not-Style-Guide (Separation of Concerns)
Pola paling penting: *constraint yang membatasi vs sumber arahan*. Daripada mencampur "jangan pakai X" dengan "pakai Y", anti-slop memisahkan:
- **Rules** = subtractive (menghapus slop).
- **DESIGN.md** = additive (menambah arah).

Keuntungan teknis: aturan filter bisa dipakai ulang di semua proyek tanpa bentrok identitas visual. Ini pola yang bisa ditiru untuk AI agent lain — pisahkan **linter** dari **config**.

## 2.2 Pola: Tiered Gating (Hard / Purpose / Quality)
```
Hard Gate   → deny
Purpose-Gate → ask("kenapa?") → allow|deny
Quality Lock → must remain consistent
```
Ini adalah pola **policy engine bergaya Unix capabilities**: bukan allow-list statis, tapi kombinasi deny-default untuk hal yang membahayakan (klaim palsu) dan reason-required untuk teknik yang bisa jadi slop tapi juga bisa valid (glassmorphism, gradient, animasi).

## 2.3 Pola: Additive Skills (Lazy Context Loading)
Sebab plugin mendeklarasikan `"skills": ["./skills/"]` dan deskripsi berbunyi "Loads as six skills", agent tidak akan memuat semua skill sekaligus. Skill dimuat **sesuai concern yang disentuh task**. Ini menghemat context window — penting karena aturan anti-slop bisa panjang, dan memuat semua hanya untuk task copywriting adalah pemborosan token.

## 2.4 Pola: Self-Audit Embedding (Delivery Gate)
Delivery Gate memaksa agent untuk menghasilkan **laporan 4 blok PASS/FAIL** sebelum benar-benar "ship" output. Ini teknik yang memperkuat compliance:
- Memaksa agent "berpikir" sebelum output final = memaksa setidaknya satu pass ekstra atas rules.
- Output yang dihasilkan adalah *self-declaration*, memudahkan debugging bila aturan dilanggar.
- Pola ini portabel ke prompt framework lain (Chain-of-Verification, Reflexion).

## 2.5 Pola: Liveliness Dial
Alih-alih "buat desain bagus", aturan merinci tiga dial numerik:
- **ENERGY

---
### Struktur Berkas Utama
```
📁 .agents/
   └─ 📁 plugins
📁 .claude-plugin/
   └─ 📄 contrast-mcp-launcher.mjs
   └─ 📄 marketplace.json
   └─ 📄 plugin.json
📁 .cline-plugin/
   └─ 📄 plugin.js
📁 .codex-plugin/
   └─ 📄 plugin.json
📁 .cursor-plugin/
   └─ 📄 marketplace.json
   └─ 📄 plugin.json
📄 .gitignore
📁 .kimi-plugin/
   └─ 📄 plugin.json
📄 antislop.md
📁 assets/
   └─ 📄 antislop-banner.png
   └─ 📁 compare
   └─ 📄 profile.png
📁 cli/
   └─ 📄 .gitignore
   └─ 📄 index.mjs
   └─ 📁 lib
   └─ 📄 package-lock.json
   └─ 📄 package.json
   └─ 📁 scripts
📄 GUIDE.md
📄 LICENSE
📄 package.json
📄 plugin.json
📄 README.md
📄 ROADMAP.md
📁 rules/
```
