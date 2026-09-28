# 📚 Catatan Pengetahuan: kirodotdev/KiroCrew

- **URL:** https://github.com/kirodotdev/KiroCrew.git
- **Waktu Dipelajari:** 27/9/2026, 16.59.06
- **Tags:** kirodotdev, kirocrew, persistent-agent, local-first-ai, self-improving-workspace, multi-channel-agent
- **Ringkasan:** Kiro Crew adalah workspace pengembangan open-source berbasis Python yang menjalankan AI agent secara lokal (atau remote) di hardware pengguna, bersifat persisten lintas sesi, self-learning, dan self-evolving. Repositori ini menyediakan agent yang dapat dipanggil melalui CLI, dashboard web, desktop app, serta kanal messaging (Slack, Discord), dengan dukungan tugas multi-langkah unattended, recurring jobs, dan heartbeat monitoring.

---

# 1. Konsep Utama & Arsitektur

Kiro Crew adalah **persistent workspace for development work** — bukan sekadar CLI agent sekali-jalan seperti kebanyakan tooling LLM saat ini. Nilai intinya adalah *continuity*: pekerjaan yang dimulai di satu sesi (mis. dari CLI) dapat dilanjutkan di sesi lain (mis. melalui Slack), dan tugas multi-langkah tetap berjalan unattended di antara interaksi pengguna.

Arsitektur tingkat tinggi yang bisa dibaca dari struktur repo dan metadata:

1. **Local-first runtime, remote-optional.** Aplikasi didesain berjalan di hardware pengguna (macOS/Windows/Linux) melalui desktop app, one-line install, atau Docker image untuk server always-on. Ini berbeda dari arsitektur SaaS yang mengirim semua state ke cloud.

2. **Multi-surface front-end.** Satu backend agent diekspos melalui beberapa surface:
   - CLI (`kirocrew` console script via `_bootstrap:main`)
   - Web dashboard
   - Desktop app (bundled dengan auto-update; contohnya `KiroCrew.dmg` dan `KiroCrew-Setup.exe`)
   - Messaging channels (Slack, Discord)
   Surface-surface ini adalah *projections* dari state workspace yang sama, bukan runtime terpisah.

3. **Persistent, self-improving, self-evolving.** Ini tiga sifat yang dijanjikan README:
   - *Persistent*: workspace bertahan lintas sesi.
   - *Self-learning*: agent memperbarui kemampuannya (skills) berdasarkan pekerjaan sebelumnya.
   - *Self-evolving*: agent mengubah konfigurasi/runtime-nya sendiri (mis. membuat skill baru, mengatur schedule baru).
   Konsekuensinya, state harus serializable dan bertahan di disk, dan agent butuh mekanisme aman untuk menulis ulang artefak miliknya sendiri.

4. **Agent runtime default adalah `kiro-cli`.** Kiro Crew memang *orchestrator*, sementara inference/agent loop utama di-delegasikan ke `kiro-cli` yang di-install & sign-in terpisah. First launch memverifikasi prasyarat ini dan menautkan ke setup guide bila belum terpasang — pola *runtime dependency probe with graceful degradation*.

5. **Core primitives dari sisi fungsional:**
   - **Apps**: kombu paket (UI purpose-built + agents + skills + schedules + integrations + backend services) untuk pekerjaan tertentu.
   - **Skills**: kemampuan reusable yang dapat dipanggil agent.
   - **Schedules**: recurring jobs yang berjalan sesuai jadwal pengguna.
   - **Heartbeats**: monitoring sistem berkala sampai ada yang butuh perhatian.
   - **Multi-step tasks**: dieksekusi unattended.
   Kombinasi ini adalah pola *long-running agent + event-driven triggers*.

6. **Distribution channels**: Stable / Insider / Nightly, dengan aturan promosi dan update lane sendiri — pola rilis khas produk desktop (bukan library).

7. **Bootstrap & packaging.** `pyproject.toml` mendefinisikan satu entry point script, sedangkan metadata dependencies tetap di `setup.cfg` namun di-*forward* ke `[project]` melalui `dynamic = ["dependencies", "optional-dependencies"]`. Ini pola kompatibilitas setuptools modern yang menghindari hilangnya extras secara diam-diam — sebuah *build-system footgun* yang mereka dokumentasikan langsung di komentar.

# 2. Pola Desain & Teknik Coding Kunci

Beberapa pola yang jelas muncul dari cuplikan kode dan konfigurasi:

### a. **Token-ownership-first Windows filesystem probe**
File `.github/actions/setup-windows-tests/probe.py` mendemonstrasikan pola yang sangat spesifik: sebelum menjalankan tests, CI memverifikasi bahwa runner Windows *benar-benar* mendukung coverage filesystem yang diharapkan. Kuncinya adalah urutan operasi:
1. Dapatkan SID user saat ini (`platform_compat.current_user_sid()`).
2. Buat file di direktori sementara, lalu **sebelum** lockdown, panggil `windows_acl.describe(target).owner_sid` dan pastikan sama dengan token SID.
3. Baru kemudian restrict ACL ke owner, lalu verifikasi read/write/symlink/rename/cleanup sukses.

Ini mencegah *false negative* yang muncul ketika test di-skip diam-diam di lingkungan Windows yang tidak mendukung symlink atau ACL, dan mencegah *false positive* ketika test lulus karena tidak benar-benar mengeksekusi operasi filesystem yang dimaksud. Komentar `# _allocator_owner requires exact token ownership BEFORE lockdown` adalah signal eksplisit bahwa urutan ini kritis.

### b. **Dynamic dependencies via `dynamic` list**
```toml
dynamic = ["dependencies", "optional-dependencies"]
```
Ini bukan sekadar deklarasi — komentar di file menjelaskan *mengapa*: begitu `[project]` table ada, setuptools mengabaikan metadata di `setup.cfg` kecuali field dinyatakan sebagai `dynamic`. Tanpa deklarasi ini, `pip install -e ".[dev]"` akan melaporkan "does not provide the extra 'dev'" dan tidak memasang tooling apapun. Pola ini adalah *migration artifact* yang didokumentasikan sebagai pelajaran, dan mengindikasikan repo melakukan refactor dari `setup.cfg`-only ke `pyproject.toml`-forwarding secara bertahap.

### c. **Pinned dev toolchain with duration-balanced test sharding**
`dependency-groups.dev` berisi versi *pinned exact* (mis. `pytest==9.0.3`, `black==26.3.1`, `mypy==1.14.1`, `jsonschema==4.26.0`) dan `pytest-split==0.11.0` untuk sharding berbasis durasi. Ini pola yang lazim di repo besar: hasil test deterministik, waktu CI turun drastis karena setiap shard menerima beban komputasi seimbang, bukan split alfabetis.

Poin desain lanjutan: `jsonschema` dan PyJWT sengaja dijaga di dua tempat — dev group *dan* runtime extras — dengan komentar eksplisit bahwa packaged installs tidak boleh diam-diam melewatkan schema checks. Ini pola *"security-critical tool accrued to both dependency planes"*.

### d. **Reproducible AI review lanes with committed lockfile**
`.github/review-cli/package.json` mendeskripsikan sebuah *private* CLI (`kirocrew-review-cli`, tidak di-ship) yang hanya ada agar `codex-review.yml` dan `fork-gpt-review.yml` menggunakan `npm ci` dari lockfile yang di-commit, bukan resolusi versi floating saat job berjalan. Alasannya diberi langsung di deskripsi paket:
> "Those jobs hold Bedrock credentials and read PR content, so the exact code they execute must change only by a commit to this repo."

Ini adalah *supply-chain hardening* untuk pipeline AI review: dua tool AI (`@anthropic-ai/claude-code`, `@openai/codex`) di-pin ke

---
### Struktur Berkas Utama
```
📄 .dockerignore
📄 .gitattributes
📄 .gitignore
📄 .jscpd.json
📁 .kiro/
   └─ 📁 settings
   └─ 📁 specs
📄 .nvmrc
📄 .semgrepignore
📄 .vulnerability-exceptions.json
📄 .vulnerability-exceptions.schema.json
📄 .woke.yml
📄 AGENTS.md
📄 AUTOSDE.yaml
📄 CHANGELOG.md
📄 CLAUDE.md
📄 CODE_OF_CONDUCT.md
📄 CONTRIBUTING.md
📄 GOVERNANCE.md
📄 LICENSE
📄 MAINTAINERS.md
📄 MANIFEST.in
📄 Makefile
📄 NOTICE
📄 README.md
📄 SECURITY.md
📄 TENETS.md
📄 THIRD-PARTY-NOTICES
📁 assets/
   └─ 📄 banner.svg
📁 bin/
   └─ 📄 kirocrew
📄 build-chain-audit-baseline.json
📄 cli.sh
📄 cloud-install.sh
```
