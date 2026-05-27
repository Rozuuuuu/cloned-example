# Habi — Fabric Scanner App

A mobile-first web application that lets users scan fabric swatches, identify fiber composition, grade quality, and receive personalized care & sustainability advice. Built with React, TypeScript, Vite, and Supabase.

---

## Features

- **Fabric Scanner** — Capture a photo via camera or pick from your gallery to analyze fabric fiber structure. A demo mode (`🧪`) is also available for quick testing.
- **AI-Powered Analysis** — Identifies fabric name, fiber type (e.g. "100% Natural Linen" or "85% Polyester, 15% Rayon"), and assigns a quality grade.
- **Personalized Dashboard** — Displays recent scans, weather-aware fabric advice, and a user persona (`HulasLevel`) that adapts recommendations to your lifestyle.
- **Scan History** — Browse all previous scans with cached images for fast offline rendering.
- **Scan Detail** — Deep-dive view for each scan, including wash tips, resale value, upcycling ideas, breathability, and sustainability scores.
- **Authentication** — Supabase Auth with a protected route guard and sign-out-everywhere support.
- **Onboarding** — First-run flow to set your `HulasLevel` persona (`pawisin`, `normal`, or `chill`).
- **Offline Sync** — Scans made offline are queued locally and synced to Supabase when connectivity is restored.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) |
| Routing | React Router v6 |
| Data Fetching | TanStack Query v5 |
| Backend / DB | Supabase (Postgres + Auth + Storage) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Testing | Vitest + Testing Library |

---

## Project Structure

```
src/
├── components/         # Shared UI components
│   ├── BottomNav.tsx   # Mobile bottom navigation bar
│   ├── ConfirmDialog.tsx
│   ├── NavLink.tsx
│   └── ui/             # shadcn/ui component library
├── hooks/
│   ├── use-auth-guard.ts   # Route protection + session helpers
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── integrations/
│   └── supabase/           # Auto-generated Supabase client & types
├── lib/
│   └── habi.ts             # Core business logic (scan saving, weather, image cache, offline sync)
├── pages/
│   ├── Index.tsx           # Landing / splash
│   ├── Login.tsx           # Auth page
│   ├── Onboarding.tsx      # HulasLevel setup
│   ├── Dashboard.tsx       # Main hub with recent scans & weather advice
│   ├── Scanner.tsx         # Camera / gallery fabric scanner
│   ├── Result.tsx          # Scan result summary
│   ├── ScanDetail.tsx      # Full scan details
│   ├── History.tsx         # All past scans
│   └── NotFound.tsx
└── App.tsx                 # Route definitions + providers
```

---

## Database Schema

Managed via Supabase migrations (`supabase/migrations/`).

### `public.profiles`
Stores per-user preferences. Auto-created on signup via a trigger.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | References `auth.users` |
| `hulas_level` | `text` | `pawisin` \| `normal` \| `chill` |
| `created_at` | `timestamptz` | |

### `public.scans`
Stores fabric scan results.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | References `auth.users` |
| `fabric_name` | `text` | e.g. "Premium Linen" |
| `grade` | `text` | e.g. "A+" |
| `fiber_type` | `text` | e.g. "100% Natural Linen" |
| `image_path` | `text` | Path in `scan-images` storage bucket |
| `scanned_at` | `timestamptz` | |

Row-level security is enabled on all tables — users can only access their own data.

### Storage

A public `scan-images` bucket holds fabric photos. Upload and delete are restricted to the owning user; listing is owner-only.

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone the repo

```bash
git clone https://github.com/Rozuuuuu/cloned-example.git
cd cloned-example
```

### 2. Install dependencies

```bash
npm install
# or
bun install
```

### 3. Configure Supabase

Create a `.env` file at the project root (or set environment variables):

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### 4. Run database migrations

```bash
supabase db push
# or apply the SQL in supabase/migrations/ manually via the Supabase dashboard
```

### 5. Start the dev server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Development build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

---

## Image Handling

Scan images are validated on the client before upload:

- Accepted formats: JPEG, PNG, WebP, HEIC, HEIF
- Maximum file size: **10 MB**

Images are cached locally in an LRU cache (capped at 50 entries) for fast offline rendering in History and ScanDetail.

---

## Offline Support

Scans created while offline are stored in `localStorage` and synced to Supabase automatically when the connection is restored. The Dashboard surfaces sync status toasts to keep users informed.

---

## License

This project is private. All rights reserved.
