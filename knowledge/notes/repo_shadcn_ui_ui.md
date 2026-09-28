# 📚 Catatan Pengetahuan: shadcn-ui/ui

- **URL:** https://github.com/shadcn-ui/ui.git
- **Waktu Dipelajari:** 27/9/2026, 13.55.55
- **Tags:** shadcn-ui, ui, react, tailwindcss, radix-ui, component-registry, copy-paste, accessibility, design-system
- **Ringkasan:** shadcn/ui adalah kumpulan komponen React yang dirancang dengan indah dan aksesibel, didistribusikan bukan sebagai paket npm melainkan lewat pola "copy-and-paste" melalui CLI dan registry JSON. Komponen dibangun di atas primitif headless (Radix UI / Base UI / React Aria) dan distyling dengan Tailwind CSS, memberi developer kendali penuh atas kode yang mereka miliki.

---

# 1. Konsep Utama & Arsitektur

## 1.1 Filosofi Dasar
shadcn/ui bukanlah "component library" dalam pengertian tradisional (seperti MUI/Ant). Ini adalah **distribusi kode sumber** — sebuah *registry* komponen yang bisa di-*scaffold* ke dalam proyek pengguna. File `.tsx` berpindah langsung ke folder `components/ui/` milik developer, sehingga developer dapat:
- Memodifikasi tanpa "eject" atau fork.
- Mengontrol versi terpisah per komponen.
- Tidak terikat pada lifecycle rilis library pihak ketiga.

Tagline "Beautifully designed components that you can copy and paste" adalah inti arsitekturnya.

## 1.2 Tiga Lapisan Arsitektur

**Lapisan 1 — Primitif (Headless Behavior)**
Komponen dasar tanpa styling: `@radix-ui/react-*` (default), `@base-ui-components/react`, atau `react-aria-components`. Lapisan ini menangani:
- Aksesibilitas (role ARIA, focus trap, keyboard navigation).
- Manajemen state internal (open/close, selected, expanded).
- Portal rendering untuk overlay (Dialog, Popover, DropdownMenu).

**Lapisan 2 — Style & Variant (Tailwind + CVA)**
- `class-variance-authority` mengelola *variant matrix* (mis. Button: `variant × size`).
- `tailwind-merge` + `clsx` dikombinasikan ke utilitas `cn()` untuk merge className tanpa konflik.
- Styling pakai `data-*` attributes (mis. `data-[state=open]:bg-accent`) untuk merespon state Radix tanpa prop drilling.

**Lapisan 3 — Design Tokens (CSS Variables)**
- Semua warna/font/radius didefinisikan sebagai CSS custom properties (`--background`, `--foreground`, `--primary`, `--radius`) di `globals.css`.
- Tailwind dikonfigurasi untuk memetakan token ini ke kelas (`bg-background`, `text-foreground`).
- Multi-tema: cukup tukar nilai variabel di selector `:root` / `.dark` / `[data-theme="..."]`.

## 1.3 Alur Kerja CLI & Registry

```
User → `npx shadcn@latest add button`
        │
        ▼
   CLI (packages/shadcn)
        │  fetch https://ui.shadcn.com/r/styles/{style}/{name}.json
        ▼
   Registry JSON:
   {
     "name": "button",
     "type": "registry:ui",
     "dependencies": ["@radix-ui/react-slot", "class-variance-authority"],
     "registryDependencies": ["utils"],
     "files": [{ "path": "ui/button.tsx", "content": "..." }],
     "cssVars": { ... }
   }
        │
        ▼
   CLI menulis file ke `components/ui/button.tsx`,
   menginstal npm deps, dan menyuntikkan CSS vars.
```

Struktur monorepo (ringkas):
- `apps/www` — situs dokumentasi (Next.js) + endpoint `/r/[...]` yang menyajikan registry.
- `packages/shadcn` — CLI (Node.js, pakai `commander`, `prompts`, `ts-morph` untuk mengedit file).
- `packages/registry` — definisi semua komponen (source of truth untuk JSON).
- `apps/v4` — galeri/eksperimen versi baru.

# 2. Pola Desain & Teknik Coding Kunci

## 2.1 Pattern: Primitive + Styled Wrapper (Forwarding Refs)
Setiap komponen UI adalah *wrapper tipis* di atas primitif Radix. Semua ref dan props diteruskan:

```tsx
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Content
    ref={ref}
    className={cn("fixed left-1/2 top-1/2 ...", className)}
    {...props}
  >
    {children}
  </DialogPrimitive.Content>
));
```

Keuntungan: API Radix tidak hilang; user masih bisa pakai `onOpenAutoFocus`, `forceMount`, dsb.

## 2.2 Pattern: `asChild` (Komposisi Tanpa Wrapper DOM)
Radix `Slot` memungkinkan komponen "menyumbangkan" props ke anak tunggal, mis. `<Button asChild><Link href="/">Home</Link></Button>` — Button tidak membungkus Link dengan `<button>`, melainkan menggabungkan props ke elemen `<a>`.

## 2.3 Pattern: CVA Variant Matrix
```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground ...",
        outline: "border border-input bg-background ...",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```
Variant matrix ini *type-safe* — TypeScript otomatis tahu `variant` hanya boleh salah satu key.

## 2.4 Pattern: `cn()` Utility
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```
Ini menyelesaikan masalah klasik Tailwind: `cn("p-2", className)` di mana `className="p-4"` akan menang, menangani konflik via urutan.

## 2.5 Pattern: Data Attributes untuk State
Alih-alih

---
### Struktur Berkas Utama
```
📁 shadcn-ui/ui (via GitHub API)
```
