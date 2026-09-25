# 🌐 User interface design - Wikipedia

- **URL Sumber:** https://en.wikipedia.org/wiki/User_interface_design
- **Tipe Materi:** documentation
- **Waktu Dipelajari:** 25/9/2026, 09.42.49
- **Tags:** docs, guide, ui-design, ux-design, design-thinking, iso-9241, usability, human-computer-interaction
- **Ringkasan:** Dokumen ini merupakan artikel ensiklopedis yang memaparkan definisi, jenis, prinsip, dan metodologi desain antarmuka pengguna (UI) dengan fokus pada maksimalisasi usability dan user experience. Nilai pentingnya terletak pada penyatuan kerangka praktis (design thinking EDIPT, usability testing) dengan standar internasional (ISO 9241) yang dapat langsung dijadikan acuan oleh AI Agent Hermes saat membantu pengguna merancang, mengevaluasi, atau mengaudit antarmuka digital.

---

# 1. Konsep Utama & Latar Belakang

**Definisi UI Design**
User Interface (UI) design atau *user interface engineering* adalah disiplin merancang antarmuka untuk mesin dan perangkat lunak — komputer, peralatan rumah tangga, perangkat mobile, hingga perangkat elektronik lain — dengan fokus utama memaksimalkan **usability** dan **user experience**. Dalam konteks perangkat lunak, UI design berpusat pada **information architecture**: proses membangun antarmuka yang secara jelas mengomunikasikan kepada pengguna apa yang penting.

**Tujuan Fundamental**
Tujuan UI design adalah membuat interaksi pengguna **sesederhana dan seefisien mungkin** dalam mencapai tujuan pengguna (*user-centered design*). Prinsip emas: *"Good user interface design facilitates finishing the task at hand without drawing unnecessary attention to itself."* Antarmuka yang baik bersifat transparan — pengguna fokus pada tugasnya, bukan pada antarmukanya.

**Tiga Jenis Antarmuka Pengguna**
1. **Graphical User Interfaces (GUIs)** — Interaksi melalui representasi visual di layar komputer. Contoh: desktop.
2. **Voice-controlled interfaces** — Interaksi melalui suara. Contoh: Siri (smartphone), Alexa (Amazon).
3. **Gesture-based interactive interfaces** — Interaksi melalui tubuh di lingkungan 3D. Contoh: game VR.

**UI vs UX — Perbedaan Krusial**
- **UI design** = *craft* (keahlian) menciptakan pengalaman pengguna yang konkret: menjaga pengguna tetap terinformasi, memberi feedback tepat waktu, menetapkan *look and feel*.
- **UX design** = keseluruhan proses menciptakan pengalaman pengguna (end-to-end).

Menurut **Don Norman & Jakob Nielsen**: pengalaman pengguna total harus dibedakan dari antarmuka. Contoh: website review film dengan UI pencarian sempurna tetap memiliki UX buruk jika databasenya hanya berisi film studio besar dan mengabaikan rilis independen kecil.

**Peran Estetika & Teknis**
Graphic design dan typography mendukung usability, memengaruhi cara pengguna melakukan interaksi, dan meningkatkan daya tarik estetis. Desain harus menyeimbangkan **technical functionality** dan **visual elements** (misalnya *mental model*) sehingga sistem tidak hanya beroperasi tetapi juga usable dan adaptif terhadap kebutuhan pengguna yang berubah.

# 2. Metode, Arsitektur, atau Alur Kerja Kunci

## 2.1 Design Thinking Framework: EDIPT

Diciptakan tahun 2004 oleh **David M. Kelley**, pendiri Stanford d.school (Hasso Plattner Institute of Design). Akronim **EDIPT** merujuk pada lima tahap yang bersifat **non-linear** dan **iteratif** — desainer dapat melompat antar tahap.

| Tahap | Aktivitas Inti | Output/Detail |
|---|---|---|
| **E — Empathize** | Riset pengguna untuk memahami kebutuhan & pain points audiens target. | Kumpulkan data kualitatif via *semi-structured interviews*. Hindari asumsi pribadi. |
| **D — Define** | Menetapkan problem statement yang berfokus pada kebutuhan pengguna. | Satu kalimat, memuat: *user + specific need + desired outcome*. |
| **I — Ideate** | Brainstorming solusi atas problem statement yang telah disempurnakan. | Solusi harus selaras dengan *feasibility* & *viability* stakeholder sambil menjaga *user desirability*. |
| **P — Prototype** | Merancang solusi dalam berbagai fidelitas (low, mid, high). | Iteratif — eksplorasi beberapa solusi, jangan berhenti pada konsep pertama. |
| **T — Test** | Menyajikan prototipe ke audiens target untuk mengumpulkan feedback. | Bila perlu, kembali ke tahap awal untuk menyempurnakan prototipe. |

**Pertanyaan kunci pada tahap Empathize:**
- Apa yang pengguna inginkan agar sistem lakukan?
- Bagaimana sistem masuk ke alur kerja/aktivitas harian pengguna?
- Seberapa paham teknologi pengguna, dan sistem serupa apa yang sudah mereka pakai?
- Estetika dan gaya fungsionalitas apa yang menarik bagi pengguna?

## 2.2 Usability Testing

Dipopulerkan oleh **Nielsen Norman Group** (didirikan Jakob Nielsen & Don Norman, 1998). Jakob Nielsen memelopori gerakan usability dan menciptakan *"10 Usability Heuristics for User Interface Design."*

**Definisi:** Usability mendefinisikan kualitas antarmuka dari sisi kemudahan penggunaan. Usability rendah membebani pengguna → mereka gagal mencapai tujuan → antarmuka ditinggalkan.

**Dua Metode Evaluasi:**

1. **Usability Inspection** — Evaluator memeriksa antarmuka.
   - Lebih murah, dapat dilakukan lebih awal (bahkan pada prototipe/spesifikasi).
   - Metode umum: *cognitive walkthrough* (fokus pada kemudahan tugas bagi pengguna baru), *heuristic evaluation* (set heuristik untuk mengidentifikasi masalah), *pluralistic walkthrough* (sekelompok orang menelusuri skenario tugas dan mendiskusikan isu usability).

2. **Usability Testing** — Pengujian prototipe pada pengguna nyata.
   - Sering memakai teknik *think aloud protocol*: pengguna diminta berbicara tentang pikirannya selama pengalaman berlangsung.
   - Memungkinkan desainer memahami penerimaan desain dari sudut pandang pengguna.

## 2.3 Standar ISO 9241 — Prinsip Ergonomis Antarmuka

ISO 9241 Part 10 menetapkan kerangka prinsip ergonomis untuk teknik dialog.

### Tujuh Prinsip Dialog (Dimensi Dinamis — "Feel")
1. **Suitability for the task** — Dialog mendukung penyelesaian tugas secara efektif dan efisien.
2. **Self-descriptiveness** — Setiap langkah dialog langsung dipahami melalui feedback sistem atau penjelasan atas permintaan.
3. **Controllability** — Pengguna mampu memulai dan mengendalikan arah serta tempo interaksi sampai tujuan tercapai.
4. **Conformity with user expectations** — Konsisten, sesuai karakteristik pengguna (pengetahuan, edukasi, pengalaman) dan konvensi yang diterima umum.
5. **Error tolerance** — Meski ada input salah, hasil yang diinginkan tetap tercapai dengan sedikit atau tanpa aksi tambahan.
6. **Suitability for individualization** — Antarmuka dapat dimodifikasi sesuai kebutuhan tugas, preferensi, dan keterampilan pengguna.
7. **Suitability for learning** — Mendukung dan membimbing pengguna mempelajari sistem.

### Tujuh Atribut Presentasi Informasi (Dimensi Statis — "Look", Part 12)
1. **Clarity** — Informasi disampaikan cepat dan akurat.
2. **Discriminability** — Informasi yang ditampilkan dapat dibedakan secara akurat.
3. **Conciseness** — Pengguna tidak dibebani informasi berlebihan.
4. **Consistency** — Desain unik, sesuai ekspektasi pengguna.
5. **Detectability** — Perhatian pengguna diarahkan ke informasi yang diperlukan.
6. **Legibility** — Informasi mudah dibaca.
7. **Comprehensibility** — Makna jelas, tidak ambigu, dapat diinterpretasi dan dikenali.

### Definisi Usability (Part 11 — Tiga Faktor Kualitas)
- **Effectiveness** — Sejauh mana tujuan penggunaan sistem tercapai.
- **Efficiency** — Sumber daya yang harus dikeluarkan untuk mencapai tujuan.
- **Satisfaction** — Sejauh mana pengguna menganggap sistem
