# Fold

Fold is a mobile application built with React Native and Expo, featuring a beautiful, dynamic timeline for capturing and sharing memories (photos, videos, audio, text). It is powered by a high-performance backend using Hono, Drizzle ORM, and Neon Serverless Postgres.

## Tech Stack

### Frontend (App)
* **Framework:** [Expo](https://expo.dev/) / React Native
* **Routing:** Expo Router (File-based routing)
* **State Management:** Zustand
* **Styling:** StyleSheet & [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/) for fluid, 60fps animations
* **Gestures:** [React Native Gesture Handler](https://docs.swmansion.com/react-native-gesture-handler/)
* **Media:** Expo Camera, Expo Image Picker, Expo Audio
* **Notifications:** Expo Push Notifications
* **Language:** TypeScript

### Backend (API)
* **Framework:** [Hono](https://hono.dev/) (Edge-ready, blazing fast web framework)
* **Runtime:** Node.js (deployment-ready for Vercel/Cloudflare)
* **Database:** [Neon](https://neon.tech/) (Serverless Postgres)
* **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
* **Authentication:** Privy email OTP + embedded wallets (@privy-io/expo)
* **Storage:** IPFS via backend relay (Pinata) + on-chain CID recording on Polygon Amoy
* **Language:** TypeScript

---

## Project Structure

This repository is organized into two main parts: the frontend mobile app and the backend API.

```text
├── app/                  # Frontend: Expo Router screens and layouts
├── components/           # Frontend: Reusable UI components
├── constants/            # Frontend: Theme, colors, config
├── lib/                  # Frontend: API client, Zustand stores, utilities
├── assets/               # Frontend: Fonts, images, splash screens
├── fold.config.js        # Global app configuration
│
└── fold.backend/         # Backend: Hono API Server
    ├── src/
    │   ├── db/           # Drizzle schema and connection instances
    │   ├── lib/          # Privy auth config, IPFS relay + blockchain middleware
    │   └── routes/       # API endpoints (auth, timeline, profile, connects)
    ├── drizzle/          # Database migrations
    └── drizzle.config.ts # Drizzle configuration
```

---

## Local Development Setup

### Prerequisites
* Node.js (v18+)
* npm or pnpm
* EAS CLI (`npm install -g eas-cli`)
* A [Neon](https://neon.tech/) Postgres database URL
* Privy app credentials
* Pinata + Polygon Amoy relay credentials in backend

### 1. Backend Setup

Navigate to the backend directory:
```bash
cd fold.backend
```

Install dependencies:
```bash
npm install
```

Set up your environment variables. Create a `.env` file in `fold.backend/` based on `.env.example`:
```env
# Database
DATABASE_URL="postgres://user:password@ep-cool-resonance-123.neon.tech/fold"

# Authentication (Privy + Wallet Linking)
PRIVY_APP_ID="your-privy-app-id"
PRIVY_APP_SECRET="your-privy-app-secret"

# Storage + Chain Relay
PINATA_JWT="your-pinata-jwt"
POLYGON_AMOY_RPC_URL="https://rpc-amoy.polygon.technology"
PIMLICO_API_KEY="your-pimlico-key"
```

Push the database schema to Neon:
```bash
npm run db:push
```

Start the local API development server:
```bash
npm run dev
```
The backend will run on `http://localhost:3000`.

### 2. Frontend (App) Setup

Open a new terminal and navigate to the root directory:
```bash
cd fold   # (or wherever your root app folder is)
```

Install dependencies:
```bash
npm install
```

Set up your environment variables. Create a `.env` file in the root directory:
```env
# Point this to your local backend IP or production URL
# Note: For physical devices testing locally, use your machine's local IP (e.g., 192.168.1.X) instead of localhost
EXPO_PUBLIC_PRIVY_APP_ID=""
EXPO_PUBLIC_PRIVY_CLIENT_ID=""
EXPO_PUBLIC_API_URL="http://localhost:3000"
```

Start the Expo development server:
```bash
npx expo start
```

### 3. Running on a Device / Emulator

1. **Expo Go:** You can scan the QR code from the terminal to open the app in Expo Go. Note that push notifications will not work in Expo Go.
2. **Development Build (Recommended):** For full functionality including native push notifications and custom fonts:
   ```bash
   eas build --profile development --platform android # or ios
   ```

---

## Features

* **Timeline:** An immersive, horizontally or vertically scrolling feed of your personal memories.
* **Rich Media:** Add photos, videos, audio notes, and text entries.
* **Connections:** Connect with partners or friends via invite codes or direct requests to share memories.
* **Profiles & Streaks:** Track activity levels, earn badges (Early Bird, On Fire, Centurion), and maintain memory creation streaks.
* **Shared Memories:** Receive encrypted memories and decrypt locally with Lit session signatures.
* **Offline-first Queue:** Memories are encrypted on-device, stored in SQLite, and synced in the background.
* **Web3 Storage + Chain:** Encrypted payloads relay to IPFS and CID records are written on Polygon Amoy.
* **Push Notifications:** Powered by Expo Push to keep users engaged with connection requests and shared memories.

---

## Deployment

### Backend
The backend is built with Hono, making it versatile for edge or serverless deployment.
To deploy to Vercel:
```bash
cd fold.backend
npm install -g vercel
vercel
```

### Frontend
Deploying the app uses EAS (Expo Application Services):
```bash
eas build --platform all
eas submit --platform all
```
