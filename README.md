# Let's Journaling

A calm, private journaling platform to organize your day, build habits, reflect, and grow.

## Features

- **Daily Journal** — Guided reflection questions, free notes, mood tracking, water intake, checklist, photo uploads, and a built-in pomodoro timer
- **Activity Scheduler** — Plan your day with activities, reminders, categories, and color coding
- **History** — Calendar view with mood/journal indicators and searchable timeline
- **Statistics** — Mood trends, water intake, focus minutes, activity completion, and AI-generated insights
- **Friends & Pen Pal** — Search users, send friend requests, and exchange asynchronous letters
- **Public Feed** — Share journals publicly with likes and saves
- **Google Calendar Sync** — Bidirectional activity synchronization (requires Google Workspace connection)
- **PWA** — Installable, offline-capable, with app icons and manifest
- **Dark Mode** — Full light/dark theme support
- **Authentication** — Email/password and Google OAuth

## Tech Stack

- **Frontend**: Next.js 13.5 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Charts**: Recharts
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (already provisioned in `.env`)
- Google OAuth credentials (optional, for Google Calendar sync)

### Installation

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

### Environment Variables

The following are pre-populated in `.env`:

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

For Google Calendar sync, add these as Supabase Edge Function secrets (not in `.env`):

```
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

## Deployment

### Netlify

1. Push this repository to GitHub
2. Connect the repo to Netlify
3. Set environment variables in Netlify dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Build settings are auto-detected from `netlify.toml`:
   - Build command: `npx next build`
   - Publish directory: `.next`
   - Plugin: `@netlify/plugin-nextjs`

### Supabase Configuration

The database schema, RLS policies, and storage buckets are already applied via migrations. To set up a new Supabase project:

1. Create a new Supabase project
2. Run the SQL migrations in order from `supabase/migrations/`
3. Enable Google OAuth provider in Supabase Dashboard > Authentication > Providers
4. Add your site URL to Supabase Dashboard > Authentication > URL Configuration

### Google Cloud Configuration (Optional)

For Google Calendar sync:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs:
   - `https://<your-supabase-url>/auth/v1/callback`
   - `https://<your-site-url>/auth/callback`
6. Copy the Client ID and Client Secret
7. In Supabase Dashboard > Authentication > Providers > Google:
   - Enter Client ID and Client Secret
8. Add as Supabase Edge Function secrets:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

## Build

```bash
npm run build
```

## License

Private project.
