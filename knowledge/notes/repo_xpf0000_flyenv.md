# 📚 Catatan Pengetahuan: xpf0000/FlyEnv

- **URL:** https://github.com/xpf0000/FlyEnv.git
- **Waktu Dipelajari:** 28/9/2026, 11.26.54
- **Tags:** xpf0000, flyenv, local-dev-environment, electron, cross-platform, runtime-manager, mcp, ai-tooling, xampp-alternative
- **Ringkasan:** FlyEnv adalah aplikasi desktop native cross-platform (Windows, macOS, Linux) yang berfungsi sebagai pengganti modern XAMPP/MAMP/Laragon/Laravel Herd untuk mengelola stack pengembangan lokal secara lengkap — runtime (PHP, Node.js, Python, Java, Go, .NET, dll), database (MySQL, PostgreSQL, MongoDB, Redis, ClickHouse, Neo4j, Qdrant), web server (Nginx, Apache, Caddy, FrankenPHP, Tomcat), hingga AI coding CLI dan MCP Server — semuanya tanpa container. Fokus utamanya adalah menyediakan workspace terpadu untuk menjalankan layanan native per-project tanpa overhead Docker, sekaligus menjadi jembatan antara workflow developer klasik dan tooling AI modern.

---

# 1. Konsep Utama & Arsitektur

FlyEnv adalah **desktop orchestration layer** di atas layanan-layanan native OS. Berbeda dengan Docker Desktop yang menyembunyikan proses di dalam VM/container, FlyEnv menjalankan setiap service (mis. `php-fpm`, `mysqld`, `nginx`, `redis-server`) langsung di host:

```
┌─────────────────────────────────────────────────┐
│              FlyEnv Desktop App                 │  ← UI (kemungkinan Electron/Tauri)
│  • Runtime manager  • Site manager  • MCP srv   │
└───────────────┬─────────────────────────────────┘
                │ spawn / supervise / config
┌───────────────▼─────────────────────────────────┐
│           Native OS Processes                   │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌───────┐  │
│  │Nginx   │→ │php-fpm │  │mysqld  │  │redis  │  │
│  └───┬────┘  └────────┘  └────────┘  └───────┘  │
│      │ Hosts file + TLS Cert                    │
│  myapp.test ──▶ 127.0.0.1:port                 │
└─────────────────────────────────────────────────┘
                │ stdio / HTTP
┌───────────────▼─────────────────────────────────┐
│  AI Coding Clients (Claude Code, Codex, ...)    │
│  memanggil tools via FlyEnv MCP Server          │
└─────────────────────────────────────────────────┘
```

Komponen konseptual utama:

1. **Runtime Manager** — mendownload, memasang, dan memverifikasi versi runtime (PHP 7.4/8.x, Node 18/20/22, Python 3.x, dst.). Setiap runtime terisolasi di folder sendiri sehingga bisa dipasang paralel tanpa konflik.

2. **Per-Project Version Binding** — saat developer membuka folder proyek, FlyEnv memilih versi runtime yang sesuai (menggunakan file konfigurasi seperti `.nvmrc`, `composer.json`, atau metadata khusus FlyEnv). Ini meniru Herd/`nvm`/`pyenv` tapi terpadu.

3. **Service Supervisor** — mengelola lifecycle proses: start/stop/restart, port allocation anti-bentrok, health check, dan pengumpulan log. Berperan mirip `systemd`/`launchd` mini dalam scope dev.

4. **Site Manager & Web Layer** — mengonfigurasi **virtual host** untuk domain lokal (`myapp.test`), mengelola file `hosts`, menerbitkan sertifikat TLS self-signed (mungkin via `mkcert` atau CA internal), dan mengatur reverse proxy (Nginx/Apache/Caddy/`FrankenPHP`) ke runtime upstream.

5. **AI/MCP Layer** — FlyEnv MCP Server mengekspos tool-tool seperti "start service", "list runtimes", "query DB", atau "inspect logs" melalui protokol **Model Context Protocol** sehingga AI agent (Claude Code, Codex, dsb.) dapat beroperasi pada environment lokal secara terkendali. Ini adalah pembeda utama dibanding XAMPP/Laragon.

6. **Cross-Platform Abstraction** — kode yang sama berjalan di Windows (`services.exe`, path `C:\Users\...`), macOS (`launchd`-style), dan Linux (`systemd`/manual). Perbedaan dikurung di lapisan adaptor (kemungkinan modul per-OS).

Alur kerja tipikal:
- Pengguna menginstal runtime via GUI → FlyEnv mengunduh binary → mendaftarkan ke manifest lokal.
- Pengguna membuat site → FlyEnv menulis vhost + entri hosts + cert → mengaitkan ke runtime version + web server.
- Pengguna menjalankan proyek Laravel → FlyEnv menyala-nyalakan Nginx + php-fpm + MySQL + Redis secara otomatis.
- Developer AI-tooling memanggil MCP server → tool FlyEnv dijalankan → hasil (status service, log, dsb.) dikembalikan ke agent.

# 2. Pola Desain & Teknik Coding Kunci

Beberapa pola arsitektural yang tampak dari positioning produknya:

- **Native-over-Container (anti-Docker for daily dev)**: alih-alih membungkus service dalam OCI image, FlyEnv memakai binary native OS. Trade-off: startup jauh lebih cepat, RAM lebih kecil, tapi tidak ada parity produksi. Pola ini menuntut abstraction layer OS-specific yang kuat (path separator, service manager, permission model).

- **Declarative Stack Recipes**: alih-alih memaksa pengguna memilih 5 service satu per satu, FlyEnv menyediakan template ("Laravel", "Django", "ERPNext", "Gitea"). Ini adalah implementasi pola **Composite Command / Preset** — kombinasi deklaratif dari service graph yang telah diuji.

- **Per-Project Isolation via Directory-Scoped Config**: mirip `direnv`, `.tool-versions`, atau `mise`. Binding versi dilakukan berdasarkan direktori proyek, sehingga developer cukup `cd` ke folder dan menjalankan `flyenv up` (atau via GUI) untuk memperoleh environment yang benar.

- **Supervisor dengan Port Arbitration**: karena service native berbagi port dengan aplikasi lain di host, FlyEnv harus mengelola alokasi port (deteksi konflik, reassign otomatis, sinkronisasi ke config Nginx/PHP). Ini adalah pola **Resource Manager + Lock** yang mencegah race condition antar-service.

- **Local HTTPS by Default**: menerapkan pola "cert authority internal" — buat CA sekali, tanda-tangani cert per-domain lokal, dan distribusikan CA ke trust store OS. Ini meniru `mkcert` dan menjadikan `https://myapp.test` benar-benar hijau di browser.

- **MCP as First-Class Interface**: sementara tooling lain mengekspos CLI/HTTP, FlyEnv mengekspos **MCP server** sebagai warga kelas satu. Ini pola **Capability-based Access** — AI agent hanya bisa memanggil tool yang dideklarasikan; tidak ada eksekusi shell arbitrer. Bagus untuk auditability dan sandboxing.

- **Process Log Multiplexing**: pola agregasi stdout/stderr dari banyak proses ke satu kanal terstruktur (mirip `foreman`/`overmind`/`process-compose`) agar UI dapat menampilkan timeline gabungan dan AI agent dapat mem-query "log semua service sejak 5 menit lalu".

- **Idempotent Provisioning**: install/uninstall runtime harus idempotent (aman dijalankan berulang). Umumnya diimplementasi dengan manifest hash checksum per-file.

# 3. Cuplikan Kode Kunci & Cara Kerja Fungsi

Sayangnya struktur file repo tidak tersedia penuh dalam prompt ini, sehingga saya tidak dapat mengutip path & fungsi asli secara presisi. Namun berdasarkan pola proyek sejenis (Electron + TypeScript + Go/Rust helper), struktur yang paling mungkin adalah:

```ts
// Konseptual — Runtime Binding per-project
function resolveRuntimeForProject(projectPath: string): RuntimeSpec {
  const cfg = readProjectManifest(projectPath); // .

---
### Struktur Berkas Utama
```
📁 xpf0000/FlyEnv (via GitHub API)
```
