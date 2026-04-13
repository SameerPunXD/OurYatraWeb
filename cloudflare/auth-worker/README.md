# OurYatra Auth Relay (Cloudflare Worker)

Signup email verification now uses an in-app 6-digit code flow. This worker is only kept as a legacy link-relay path for older confirmation links.

This worker relays Supabase email confirmation links to the web app callback route.

## 1) Deploy with CLI

```bash
cd cloudflare/auth-worker
npm install
npx wrangler login
npx wrangler deploy
```

After deploy, note your Worker URL, e.g.:
`https://ouryatra-auth-relay.<subdomain>.workers.dev`

## 2) Update app env

In project `.env`:

```env
VITE_SIGNUP_REDIRECT_URL=https://ouryatra-auth-relay.<subdomain>.workers.dev/confirm
VITE_PASSWORD_RESET_REDIRECT_URL=https://ouryatra.netlify.app/reset-password
```

Then rebuild/redeploy frontend.

## 3) Supabase URL config

In Supabase Authentication → URL Configuration:

- Site URL: `https://ouryatra.netlify.app`
- Redirect URLs:
  - `https://ouryatra.netlify.app/auth/callback`
  - `https://ouryatra.netlify.app/reset-password`
  - `https://ouryatra-auth-relay.<subdomain>.workers.dev/confirm`

## 4) How it works

- Signup email link goes to Worker `/confirm`
- Worker redirects to app `/auth/callback` with same query params
- App callback exchanges auth code for session and redirects to login
