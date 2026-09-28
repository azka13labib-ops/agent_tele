# 📚 Catatan Pengetahuan: shadcn-ui/ui

- **URL:** https://github.com/shadcn-ui/ui.git
- **Waktu Dipelajari:** 25/9/2026, 22.34.40
- **Tags:** shadcn-ui, ui, component-registry, radix-ui, tailwindcss, cli, accessible-components, react, monorepo, copy-paste-distribution
- **Ringkasan:** shadcn/ui adalah kumpulan komponen UI React yang didesain cantik dan accessible, dibagikan bukan lewat npm package biasa melainkan lewat sistem *copy-paste registry* berbasis JSON. Komponen dibangun dari primitives Radix UI dan distyling dengan Tailwind CSS, lalu didistribusikan ke proyek pengguna menggunakan CLI (`shadcn`). Filosofi intinya: "Open Code, bukan Open Source library" — pengguna memiliki kode sumber komponennya sendiri.

---

# 1. Konsep Utama & Arsitektur

## 1.1 Filosofi Dasar: "Open Code" bukan "Open Source Package"
shadcn/ui secara fundamental berbeda dari library komponen UI konvensional (MUI, Chakra, Ant Design). Perbedaan krusialnya:

| Aspek | Library Konvensional | shadcn/ui |
|---|---|---|
| Distribusi | `npm install @mui/material` | `npx shadcn@latest add button` |
| Kepemilikan kode | Ada di `node_modules` | Ada di `src/components/ui/` (milik user) |
| Kustomisasi | Override theme/props | Edit file langsung |
| Update | `npm update` | `npx shadcn@latest diff` (re-sync) |
| Lock-in | Tinggi | Minimal |

Dengan pola ini, **registry** menjadi pusat arsitektur — sebuah katalog JSON yang mendeskripsikan komponen apa saja yang tersedia, dependency apa yang dibutuhkan, file apa yang harus di-copy, dan ke mana target tujuannya.

## 1.2 Struktur Monorepo (Turborepo + pnpm workspaces)

```
ui/
├── apps/
│   └── v4/                    # Website dokumentasi + registry generator (Next.js)
├── packages/
│   ├── shadcn/                # CLI distribusi (npm: shadcn)
│   ├── react/                 # Runtime helpers/primitives React
│   └── helpers/               # Utility lintas package (path, fs, config)
├── templates/                 # Starter templates untuk berbagai framework
└── turbo.json                 # Orkestrasi pipeline
```

Pembagian tanggung jawab:
- **`apps/v4`** — Sumber kebenaran untuk semua komponen. Berisi `registry/` (source komponen) dan menghasilkan JSON registry saat build. Nama "v4" merujuk pada generasi keempat (sebelumnya v1–v3).
- **`packages/shadcn`** — CLI Node.js yang di-install user (`npx shadcn@latest`). Tugasnya: fetch registry JSON, resolve dependency (npm + registry-internal), tulis file ke disk, dan patch konfigurasi user (`components.json`, `tailwind.config`, `tsconfig.json`).
- **`packages/react`** — Primitives reusable yang dipakai oleh banyak komponen (mis. `Slot`, `composeRefs`, pattern Radix passthrough).
- **`packages/helpers`** — Utilitas generik.

## 1.3 Alur Kerja Distribusi (End-to-End)

```
[Developer shadcn/ui]
       │
       │ menulis komponen di apps/v4/registry/new-york-v4/ui/button.tsx
       ▼
[registry:build]  ──►  apps/v4/public/r/*.json  (registry artifacts)
       │
       │ dipublish ke https://ui.shadcn.com/r/styles/new-york/button.json
       ▼
[User menjalankan]  npx shadcn@latest add button
       │
       ▼
[CLI shadcn]
   1. Fetch registry index: https://ui.shadcn.com/r/index.json
   2. Resolve komponen "button" → cek dependencies + registryDependencies
   3. Fetch komponen JSON individual
   4. Install npm deps (radix-ui, class-variance-authority, clsx, tailwind-merge)
   5. Tulis file ke components/ui/button.tsx (sesuai alias di components.json)
   6. Patch tailwind config, tsconfig paths, css variables
       │
       ▼
[User memiliki kode penuh, bebas dimodifikasi]
```

## 1.4 Peran `components.json` sebagai Kontrak Konfigurasi

File ini dibuat user saat pertama kali menjalankan `npx shadcn@latest init`, dan menjadi kontrak antara user dan CLI:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "hooks": "@/hooks"
  }
}
```

CLI membaca file ini untuk tahu **di mana menulis file**, **style apa yang dipakai**, dan **apakah menggunakan CSS variables**. Inilah yang membuat CLI bisa bekerja di berbagai framework (Next.js, Vite, Remix, Astro, dll) tanpa hardcode.

## 1.5 Registry Build Pipeline (Script `registry:build`)

`package.json` root mendefinisikan:

```json
"registry:build": "pnpm --filter=v4 registry:build && pnpm lint:fix && pnpm format:write -- --loglevel silent"
```

Artinya: setiap kali registry dibangun, kode hasil generate **otomatis diformat dan di-lint**. Ini memastikan output registry konsisten dan tidak mengandung artefak lint. Ada juga pipeline health check terpisah:

```json
"registry:health": "turbo run registry:health --filter=v4",
"registry:health:check": "turbo run registry:health:check --filter=v4"
```

Pipeline `registry:health` memvalidasi integritas registry (dependency cycles, missing deps, dll) sebelum publish — sebuah guardrail penting untuk kualitas distribusi.

---

# 2. Pola Desain & Teknik Coding Kunci

## 2.1 Wrapper Pattern: Radix + cva + tailwind-merge

Pattern inti hampir semua komponen shadcn/ui adalah **"headless primitive dari Radix UI, dibungkus styling Tailwind, dengan variant API dari `class-variance-authority`, dan diforward ref"**. Contoh Button:

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-

---
### Struktur Berkas Utama
```
📁 .changeset/
   └─ 📄 config.json
   └─ 📄 README.md
📁 .claude/
   └─ 📄 launch.json
   └─ 📄 settings.local.json
📄 .commitlintrc.json
📁 .cursor/
   └─ 📁 rules
📁 .cursor-plugin/
   └─ 📄 plugin.json
📄 .editorconfig
📄 .eslintignore
📄 .eslintrc.json
📄 .gitignore
📄 .kodiak.toml
📄 .npmrc
📄 .nvmrc
📄 .prettierignore
📁 .vscode/
   └─ 📄 settings.json
📁 apps/
   └─ 📁 v4
📄 CONTRIBUTING.md
📄 LICENSE.md
📄 package.json
📁 packages/
   └─ 📁 helpers
   └─ 📁 react
   └─ 📁 shadcn
   └─ 📁 tests
📄 pnpm-lock.yaml
📄 pnpm-workspace.yaml
📄 prettier.config.cjs
📄 README.md
```
