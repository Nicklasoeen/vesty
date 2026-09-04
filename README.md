# Vesty

Vesty is an iOS-first social investment club application focused on helping private groups coordinate a shared long-term investment strategy while each member retains their own investments.

This repository currently includes a local Supabase backend, email/password authentication, profile onboarding V1, and Create / Join Club V1. Portfolio totals remain demo presentation until the financial pipeline exists.

## Requirements

- Node.js 22
- pnpm 11
- Docker
- Xcode and an iOS Simulator for iOS development

## Installation

```sh
corepack enable
pnpm install
```

## Local backend

The Supabase stack is local-development only. No remote Supabase project is connected.

First-time setup:

```sh
pnpm supabase:start
pnpm supabase:status
cp apps/mobile/.env.example apps/mobile/.env
```

Replace the publishable-key placeholder in `apps/mobile/.env` with the local publishable key shown by `pnpm supabase:status`. Never put a service-role or secret key in `EXPO_PUBLIC_*` variables.

The default `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321` works from the iOS Simulator and Expo web on the same Mac. A physical iPhone cannot reach that address (`127.0.0.1` is the phone). For device testing, set `EXPO_PUBLIC_SUPABASE_URL` to `http://<Mac-LAN-IP>:55321`, keep the phone and Mac on the same Wi-Fi, and allow inbound TCP 55321 if a firewall is blocking it. Do not commit a personal LAN IP.

Daily development:

```sh
pnpm supabase:start
pnpm ios
pnpm supabase:stop
```

Versioned migrations live in `supabase/migrations/` and can be replayed with `pnpm exec supabase db reset --local --no-seed`. RLS protects the domain tables. Club creation, invitation issuance, and invitation acceptance go through trusted RPCs; direct client writes to those tables remain blocked. Local authorization and create/join tests cover that boundary. No remote Supabase project is connected. Never use a service-role or private key in the mobile application.

Local Auth has email confirmations disabled (`enable_confirmations = false`), so development accounts are stored as confirmed. Email-bound invitation acceptance compares the authenticated `auth.users.email` and requires `email_confirmed_at`. A typed email in the mobile UI is never treated as identity. Shareable invite codes are the V1 join factor.

## Mobile development

Start the Expo development server:

```sh
pnpm mobile
```

Open the app in an iOS Simulator:

```sh
pnpm ios
```

Android remains supported for future development:

```sh
pnpm android
```

## Code quality

```sh
pnpm lint
pnpm typecheck
pnpm test:db
```

## Repository structure

```text
apps/
  mobile/       Expo and React Native application
packages/       Future shared packages
supabase/       Supabase configuration and versioned migrations
docs/           Domain and physical schema contracts
.cursor/rules/  Future scoped Cursor rules
AGENTS.md       Engineering contract for AI-assisted development
```
