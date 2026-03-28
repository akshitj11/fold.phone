# Migration Notes

This document captures the app-side Web3 migration status and the backend readiness checklist required for production.

## Scope Completed (App)

- Better-Auth client flow removed from runtime app paths.
- Privy integrated for email OTP auth and embedded wallet access.
- API client uses Privy bearer token injection with `EXPO_PUBLIC_API_URL`.
- Lit client initialized on app startup (`datil-dev` network).
- Memory encryption/decryption implemented in app layer before sync.
- Local offline queue implemented with Expo SQLite (`memory_queue`).
- Background sync worker added (30s polling + connectivity gate).
- Shared memories tab added with Lit session-sig decrypt path.
- Biometric foreground lock added via `expo-local-authentication`.

## Required Backend Endpoints

These endpoints must exist and return the expected shapes for the app flow to work.

### Auth

- `POST /api/auth/wallet-link`
  - body: `{ walletAddress: string }`
  - auth: bearer token
  - expected: success response with linked wallet metadata

### Memory Sync

- `POST /api/upload/ipfs`
  - body: `{ payload: string }` where payload is encrypted JSON blob
  - auth: bearer token
  - expected: `{ cid: string }`

- `POST /api/memories`
  - body: `{ cid: string, metadata: object }`
  - auth: bearer token
  - expected: persisted memory entry metadata

- `POST /api/blockchain/record`
  - body: `{ cid: string }`
  - auth: bearer token
  - expected: tx receipt reference / status

### Shared Memories

- `GET /api/share/received`
  - auth: bearer token
  - expected item fields used by app:
    - `id`
    - `ciphertext`
    - `dataToEncryptHash`
    - `accessControlConditions`
    - optional `type`, `title`, `createdAt`

## Polygon + Relay Checklist

- Polygon Amoy RPC reachable from backend runtime.
- Pimlico key present and valid for configured chain/network.
- CID record contract address and ABI configured in backend.
- Backend signer/account has testnet gas and can broadcast.
- IPFS relay credentials valid (Pinata JWT or equivalent).

## Frontend Env Required

- `EXPO_PUBLIC_PRIVY_APP_ID`
- `EXPO_PUBLIC_PRIVY_CLIENT_ID`
- `EXPO_PUBLIC_API_URL`

## Backend Env Recommended Baseline

- `PRIVY_APP_ID`
- `PRIVY_APP_SECRET`
- `PINATA_JWT`
- `POLYGON_AMOY_RPC_URL`
- `PIMLICO_API_KEY`
- contract-specific keys (address, signer key, chain id)

## Smoke Test Flow

1. Login with email OTP.
2. Confirm wallet link call succeeds once authenticated.
3. Save a memory while online:
   - queue row created first
   - `/api/upload/ipfs` returns CID
   - `/api/memories` succeeds
   - `/api/blockchain/record` succeeds
   - queue row marked synced
4. Save a memory while offline:
   - queue row remains pending
   - once online, worker syncs and marks synced
5. Open Shared tab and decrypt one shared memory.

## Known Non-Blocking Items

- Repository still contains historical reference docs under `.info2ai/` that mention Better-Auth/S3; these are archival notes and not runtime app code.
- Existing lint baseline has unrelated legacy warnings/errors outside this migration scope.
- lib/api.ts still contains a legacy uploadMedia helper targeting /api/upload; it is currently unused by app runtime and can be removed in a dedicated follow-up if backend endpoint is fully retired.
