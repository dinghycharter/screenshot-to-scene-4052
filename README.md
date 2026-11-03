# DinghyCharter

DinghyCharter is a TanStack Start application for finding and booking dinghy charters. It uses Supabase for authentication and data, Vite for development and builds, and Nitro for Vercel deployment.

## Requirements

- Node.js 22.12 or later
- npm
- A Supabase project

## Local development

1. Copy `.env.example` to `.env` and set the Supabase project URL and publishable key.
2. Install dependencies and start the development server:

   ```sh
   npm install
   npm run dev
   ```

## Build

```sh
npm run build
```

## Vercel environment

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for Production, Preview, and Development in the Vercel project settings. These are the Supabase project URL and publishable (formerly anon) key; never use a service role key for either variable.

The `vercel.json` file enables TanStack Start framework detection. Vercel builds the Nitro server and serves the client assets.
