# 🌐 Heuristic evaluation - Wikipedia

- **URL Sumber:** https://en.wikipedia.org/wiki/Heuristic_evaluation
- **Tipe Materi:** documentation
- **Waktu Dipelajari:** 25/9/2026, 09.40.49
- **Tags:** docs, guide, usability, ui-design, hci, nielsen-heuristics, ux-evaluation, heuristic-evaluation
- **Ringkasan:** Dokumen ini menjelaskan heuristic evaluation—metode inspeksi usability untuk mengidentifikasi masalah pada desain antarmuka (UI) dengan menilai kepatuhannya terhadap prinsip usability yang diakui. Nilai utamanya adalah menyediakan framework evaluasi UI cepat, murah, dan tidak bergantung pada user testing, dengan Nielsen's 10 Usability Heuristics sebagai standar industri yang paling banyak dipakai untuk mendesain UI yang mudah dipahami manusia.

---

# 1. Konsep Utama & Latar Belakang

**Definisi:** Heuristic evaluation adalah *usability inspection method* untuk software komputer yang membantu mengidentifikasi masalah usability pada desain user interface. Evaluator memeriksa interface dan menilai kepatuhannya terhadap prinsip usability yang diakui (disebut "heuristics").

**Sejarah & Asal-usul:**
- Dikembangkan oleh **Rolf Molich** dan **Jakob Nielsen** berdasarkan pengalaman bertahun-tahun dalam mengajar dan konsultasi usability engineering.
- Versi awal heuristik muncul dalam dua paper Nielsen & Molich (1989–1990).
- Nielsen mempublikasikan set yang diperbarui pada **1994**, dan set final yang masih dipakai hingga kini dipublikasikan pada **2005**.

**Karakteristik utama:**
- Termasuk salah satu metode inspeksi usability **paling informal** di bidang Human-Computer Interaction (HCI).
- Ada banyak set heuristik; mereka **tidak saling eksklusif** dan sering tumpang-tindih dalam aspek UI design.
- Masalah usability yang ditemukan biasanya **dikategorikan (sering skala numerik)** berdasarkan estimasi dampaknya terhadap performa atau penerimaan user.
- Sering dilakukan dalam konteks **use cases** (tugas user tipikal) untuk memberi feedback ke developer seberapa kompatibel interface dengan kebutuhan user.
- Sangat berguna pada **tahap awal desain** dan **sebelum user-based testing**.

**Mengapa penting:**
- Tidak bergantung pada user—menghindari beban recruiting, scheduling, penyediaan tempat, dan pembayaran partisipan.
- Cepat: bisa selesai dalam hitungan hari; durasi bervariasi berdasarkan ukuran artefak, kompleksitas, tujuan review, sifat masalah, dan kompetensi reviewer.
- Digunakan untuk mengidentifikasi area evaluasi atau mengeliminasi masalah desain sebelum user-based evaluation.

**Keterbatasan/kritik:**
- Hasil **sangat dipengaruhi pengetahuan expert reviewer** → bersifat "one-sided".
- Hasilnya sering **berbeda dari performance testing**—masing-masing jenis testing menemukan set masalah yang berbeda (tidak bisa saling menggantikan).
- Nielsen dalam laporan aslinya menyatakan **individual evaluator "mostly quite bad"**; karenanya butuh multiple evaluators dengan hasil diagregasi.

---

# 2. Metode, Arsitektur, atau Alur Kerja Kunci

**Proses Heuristic Evaluation:**

1. **Tentukan scope & framework** — tergantung ukuran dan tipe proyek; gunakan kerangka riset untuk mengurangi bias dan memaksimalkan temuan.
2. **Jumlah evaluator:** Nielsen merekomendasikan **3–5 evaluator**. Lebih dari 5 tidak selalu menambah insight dan bisa menambah biaya melebihi manfaat.
3. **Individual-first:** Evaluator WAJIB memeriksa prototype **secara independen** sebelum diskusi kelompok—untuk mengurangi *group confirmation bias*.
4. **Observer trade-off:**
   - *Tanpa observer:* evaluator menulis laporan individual sendiri → lebih banyak effort & waktu interpretasi, tapi menghemat biaya observer.
   - *Dengan observer:* evaluator memberi analisis verbal; observer mentranskrip & menginterpretasi → mengurangi beban evaluator dan waktu interpretasi lintas evaluator.
5. **Agregasi hasil** — gabungkan temuan dari beberapa evaluator.
6. **Kategorisasi severity** — klasifikasikan masalah berdasarkan estimasi dampak pada user.

**Nielsen's 10 Usability Heuristics (versi final 2005):**

| # | Heuristic | Prinsip |
|---|-----------|---------|
| 1 | **Visibility of system status** | Sistem selalu memberi tahu user apa yang sedang terjadi via feedback tepat waktu. |
| 2 | **Match between system and the real world** | Gunakan bahasa, kata, frasa, dan konsep yang familiar bagi user (bukan istilah sistem). Ikuti konvensi dunia nyata; informasi tampil natural & logis. |
| 3 | **User control and freedom** | User sering memilih fungsi secara keliru → sediakan "emergency exit" yang jelas. Dukung undo & redo. |
| 4 | **Consistency and standards** | User tidak boleh bingung apakah kata, situasi, atau aksi berbeda bermakna sama. Ikuti konvensi platform. |
| 5 | **Error prevention** | Lebih baik dari pesan error bagus adalah desain yang mencegah masalah sejak awal. Eliminasi kondisi rawan error atau minta konfirmasi sebelum aksi komit. |
| 6 | **Recognition rather than recall** | Minimalkan beban memori user—buat objek, aksi, dan opsi terlihat. Jangan suruh user mengingat info antar bagian dialog. |
| 7 | **Flexibility and efficiency of use** | Sediakan akselerator (tak terlihat oleh novice) untuk mempercepat expert user. Biarkan user menyesuaikan aksi yang sering dilakukan. |
| 8 | **Aesthetic and minimalist design** | Dialog tidak boleh memuat info irelevan/jarang dibutuhkan. Setiap unit info ekstra bersaing dengan info relevan dan menurunkan visibilitas relatifnya. |
| 9 | **Help users recognize, diagnose, and recover from errors** | Pesan error dalam bahasa sederhana (tanpa kode), menunjukkan masalah secara presisi, dan menyarankan solusi konstruktif. |
| 10 | **Help and documentation** | Walau lebih baik jika sistem bisa dipakai tanpa dokumentasi, sediakan help yang mudah dicari, fokus pada task user, berisi langkah konkret, dan tidak terlalu panjang. |

**Kerangka Alternatif (untuk konteks lebih luas):**

- **Gerhardt-Powals' Cognitive Engineering Principles** (pendekatan lebih holistik): automate unwanted workload; reduce uncertainty; fuse data; present new info with meaningful aids; use names conceptually related to function; group data consistently; limit data-driven tasks; include only needed info at a given time; provide multiple coding of data; practice judicious redundancy.
- **Shneiderman's Eight Golden Rules (1986):** consistency; shortcuts for frequent users; informative feedback; dialog closure; simple error handling; easy reversal of actions; internal locus of control; reduce short-term memory load.
- **Weinschenk & Barker Classification (2000):** 20 tipe heuristik, mis. User Control, Human Limitations, Modal Integrity, Accommodation, Linguistic Clarity, Aesthetic Integrity, Simplicity, Predictability, Interpretation, Accuracy, Technical Clarity, Flexibility, Fulfillment.

---

# 3. Snippet Kode / Formula / Implementasi Praktis

**Template Checklist Review (Nielsen's 10 Heuristics):**

```
HEURISTIC EVALUATION CHECKLIST
Project: ______________  Evaluator: ______  Tanggal: ________

[ ] 1. VISIB
