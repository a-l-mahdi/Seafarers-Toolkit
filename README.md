# Seafarers Toolkit

A personal management app for seafarers — documents, contracts, sea time, career progress, and leave tracking.

Built with React Native + Expo (SDK 57), TypeScript, Expo Router, TanStack Query, Zustand, and SQLite (offline-first).

## Features

- **Dashboard** — rank, contract countdown, sea time progress, document alerts at a glance
- **Documents** — store certificates (PDF/JPG/PNG), expiry tracking with notifications
- **Contracts & Vessels** — join/sign-off dates, auto-calculated contract end, countdown
- **Sea Time** — auto-calculated from contracts + manual historical records, broken down by rank
- **Career** — next rank requirements, progress bar, estimated promotion date
- **Leave** — onboard/leave ratio, expected return date after sign-off
- **Calendar** — onboard/leave/expiry visualization
- **i18n** — English & Persian (RTL) with Jalali calendar support

## Getting started

```bash
npm install
npm start
```

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start Expo dev server |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS (macOS required) |
| `npm test` | Run unit tests (Jest) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## Building an APK

Uses [EAS Build](https://docs.expo.dev/build/introduction/) with the `preview` profile (produces an installable APK):

```bash
eas build -p android --profile preview
```

## Project structure

```
src/
├── app/          # Expo Router screens (tabs + modals)
├── components/   # Reusable UI components
├── constants/    # Theme tokens
├── database/     # SQLite schema + repositories
├── domain/       # Pure business logic (sea time, contracts, career, leave)
├── hooks/        # TanStack Query hooks
├── i18n/         # en/fa translations
├── services/     # File storage, notifications
├── store/        # Zustand settings store
├── types/        # Domain types
└── utils/        # Date utilities (timezone-safe, Jalali), validation
```
