# 🌐 https://lawsofux.com/

- **URL Sumber:** https://lawsofux.com/
- **Tipe Materi:** documentation
- **Waktu Dipelajari:** 25/9/2026, 09.38.24
- **Tags:** docs, guide, ux, ui, design-principles, cognitive-psychology, hci, design-system
- **Ringkasan:** Laws of UX adalah kompilasi 30 prinsip psikologi kognitif dan perilaku manusia (seperti Hick's Law, Fitts's Law, Miller's Law, dan Jakob's Law) yang menjadi fondasi ilmiah untuk merancang antarmuka pengguna. Materi ini krusial bagi AI Agent Hermes dalam memberikan rekomendasi desain, audit UX, atau mengevaluasi keputusan UI karena setiap hukum memiliki dasar empiris yang dapat diterjemahkan menjadi aturan implementasi konkret.

---

# 1. Konsep Utama & Latar Belakang

**Laws of UX** (diinisiasi oleh Jon Yablonski) adalah kumpulan prinsip yang menggabungkan **psikologi kognitif, ergonomi, dan Human-Computer Interaction (HCI)** menjadi panduan praktis untuk desain antarmuka. Inti filosofinya: keputusan desain sebaiknya berbasis bukti empiris tentang bagaimana manusia berpikir, mengingat, dan mengambil keputusan — bukan semata estetika atau intuisi.

## Kategorisasi 30 Hukum

**A. Hukum yang berkaitan dengan Persepsi Visual (Gestalt & Attention):**
- **Law of Proximity** — objek yang berdekatan dianggap satu grup.
- **Law of Common Region** — elemen dalam batas area yang sama dianggap bergrup.
- **Law of Similarity** — elemen visual serupa dianggap satu kesatuan.
- **Law of Uniform Connectedness** — elemen yang terhubung secara visual terasa lebih berelasi.
- **Law of Prägnanz** — otak menyederhanakan citra ambigu ke bentuk paling sederhana.
- **Von Restorff Effect (Isolation Effect)** — item yang berbeda paling mudah diingat.
- **Selective Attention** — perhatian terfokus pada stimulus yang relevan dengan tujuan.

**B. Hukum tentang Beban Kognitif & Memori:**
- **Miller's Law** — working memory terbatas pada 7±2 item.
- **Chunking** — kelompokkan informasi menjadi unit bermakna untuk melebihi batas Miller.
- **Cognitive Load** — total resource mental untuk memahami interface.
- **Working Memory** — sistem kognitif penyimpan sementara informasi.
- **Serial Position Effect** — ingatan terbaik pada item pertama (primacy) dan terakhir (recency).

**C. Hukum tentang Waktu, Keputusan, dan Aksi:**
- **Hick's Law** — waktu keputusan naik logaritmik terhadap jumlah pilihan.
- **Fitts's Law** — waktu akuisisi target = fungsi jarak & ukuran target.
- **Doherty Threshold** — produktivitas naik saat respons sistem <400ms.
- **Goal-Gradient Effect** — motivasi mendekati tujuan meningkat seiring kedekatan.
- **Parkinson's Law** — pekerjaan mengembang mengisi waktu yang tersedia.

**D. Hukum tentang Perilaku & Pengalaman Pengguna:**
- **Jakob's Law** — pengguna mengharapkan situs Anda bekerja seperti situs lain yang dikenal.
- **Mental Model** — representasi internal pengguna tentang cara sistem bekerja.
- **Paradox of the Active User** — pengguna tidak membaca manual, langsung mencoba.
- **Peak-End Rule** — penilaian pengalaman berdasarkan puncak dan akhir.
- **Zeigarnik Effect** — tugas belum selesai lebih diingat.
- **Paradox of Choice / Choice Overload** — terlalu banyak opsi → kelumpuhan keputusan.

**E. Prinsip Universal / Meta-Level:**
- **Aesthetic-Usability Effect** — desain indah dipersepsi lebih usable.
- **Cognitive Bias** — distorsi sistematis dalam penilaian.
- **Occam's Razor** — pilih solusi dengan asumsi paling sedikit.
- **Pareto Principle (80/20)** — 80% efek dari 20% penyebab.
- **Tesler's Law (Conservation of Complexity)** — kompleksitas tak bisa dihilangkan, hanya dipindahkan.
- **Postel's Law (Robustness Principle)** — liberal menerima, konservatif mengirim.
- **Flow** — kondisi fokus penuh dan imersi.

---

# 2. Metode, Arsitektur, atau Alur Kerja Kunci

## Cara Menerapkan Laws of UX dalam Proses Desain

**Langkah 1 — Audit Kognitif Awal**
Petakan interface saat ini terhadap tiga dimensi:
- *Memory load* (Miller, Chunking, Working Memory)
- *Decision load* (Hick, Choice Overload, Paradox of Active User)
- *Interaction cost* (Fitts, Doherty, Parkinson)

**Langkah 2 — Terjemahkan Hukum menjadi Heuristik Desain**

| Hukum | Heuristik Desain |
|---|---|
| Fitts's Law | Target utama (CTA) harus besar & dekat dengan posisi cursor/thumb |
| Hick's Law | Batasi opsi utama ≤5–7; gunakan progressive disclosure |
| Miller's Law | Chunk form menjadi grup 3–5 field per langkah |
| Jakob's Law | Gunakan pola standar: nav di atas/samping, ikon upload, dsb. |
| Von Restorff | Bedakan 1 CTA primer secara visual dari CTA sekunder |
| Goal-Gradient | Tampilkan progress bar agar pengguna terdorong menyelesaikan |
| Peak-End Rule | Rancang momen puncak (delight) dan ending (confirmation) |
| Aesthetic-Usability | Investasi di visual polish karena memengaruhi persepsi usability |
| Zeigarnik | Tampilkan "X% complete" untuk memicu penyelesaian |
| Doherty Threshold | Targetkan LCP/TTI < 400ms; jika lebih, tampilkan skeleton UX |

**Langkah 3 — Validasi melalui Testing**
- A/B test pada pilihan Hick's Law (jumlah opsi).
- Heatmap & click-tracking untuk memverifikasi Fitts's Law.
- Time-on-task untuk Doherty Threshold.
- SUS + aesthetic rating untuk Aesthetic-Usability Effect.

**Langkah 4 — Iterasi Berbasis Mental Model**
Selalu cek apakah alur desain selaras dengan mental model target pengguna (biasanya dari aplikasi populer di domain serupa).

---

# 3. Snippet Kode / Formula / Implementasi Praktis

## Formula Hick's Law
```
RT = a + b * log2(n + 1)
```
- RT = reaction time
- n = jumlah pilihan setara
- a, b = konstanta empiris per konteks

**Implikasi kode:** saat menyusun menu, jumlah item top-level sebaiknya ≤7.

## Formula Fitts's Law (versi Shannon)
```
T = a + b * log2(1 + D/W)
```
- T = waktu untuk acquire target
- D = jarak ke target
- W = lebar target

**Implikasi CSS:**
```css
/* CTA utama dekat dengan area natural thumb (mobile) */
.primary-cta {
  min-height: 48px;        /* target size memadai */
  min-width: 48px;
  padding: 12px 24px;
  position: sticky;
  bottom: 16px;            /* jarak minimum dari titik interaksi */
}
```

## Chunking Form (Miller's Law)
```html
<!-- ❌ Anti-pattern: 12 field dalam 1 layar -->
<form>...</form>

<!-- ✅ Chunking: 3 langkah x 4 field -->
<fieldset>
  <legend>Langkah 1 dari 3 — Data Diri</legend>
  <!-- 4 field -->
</fieldset>
<progress max="3" value="1"></progress>
```

## Goal-Gradient + Zeigarnik
```js
// Progress indicator memicu motivasi menyelesaikan
const progress = completedSteps / totalSteps;
if (progress > 0 && progress < 1) {
  showProgressBar(progress); // setengah jalan termotivasi menyelesaikan
}
```

## Doherty Threshold Budget
```js
// Target respons UI < 400ms; jika backend lebih lambat, gunakan optimistic UI
async function submitForm(data) {
  renderOptimistic(data);          // update UI < 100ms
  try {
    await api.post('/submit', data); // backend
