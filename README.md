# Vesty

Vesty is an iOS-first social investment club application focused on helping private groups coordinate a shared long-term investment strategy while each member retains their own investments.

This repository is currently in the foundation and setup phase. Product features and backend integrations have not been implemented.

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

Replace the publishable-key placeholder in `apps/mobile/.env` with the local publishable key shown by `pnpm supabase:status`. The configured `127.0.0.1` URL is reachable from the iOS Simulator; physical-device networking is not configured yet.

Daily development:

```sh
pnpm supabase:start
pnpm ios
pnpm supabase:stop
```

Database and domain migrations will be added in a later architecture task. Never use a service-role or private key in the mobile application.

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
```

## Repository structure

```text
apps/
  mobile/       Expo and React Native application
packages/       Future shared packages
supabase/       Future Supabase configuration and migrations
.cursor/rules/  Future scoped Cursor rules
AGENTS.md       Engineering contract for AI-assisted development
```
