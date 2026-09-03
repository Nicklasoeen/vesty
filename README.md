# Vesty

Vesty is an iOS-first social investment club application focused on helping private groups coordinate a shared long-term investment strategy while each member retains their own investments.

This repository is currently in the foundation and setup phase. Product features and backend integrations have not been implemented.

## Requirements

- Node.js 22
- pnpm 11
- Xcode and an iOS Simulator for iOS development

## Installation

```sh
corepack enable
pnpm install
```

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
