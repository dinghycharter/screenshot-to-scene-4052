# Project instructions

- Keep Supabase configuration aligned across local development and Vercel. The browser uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; server code also accepts the same `VITE_` variables and the unprefixed equivalents.
- Never commit `.env` files or Supabase service role keys.
- Do not rewrite published Git history.
