# Release Changelog

## Web3 Migration

- Replaced Better-Auth runtime flow with Privy email OTP + embedded wallet flow.
- Updated app auth bootstrap and bearer token wiring to use Privy access tokens.
- Added biometric foreground gate using expo-local-authentication.
- Added Lit client boot + encryption/decryption helpers for memory payloads.
- Added media chunking helpers for encrypted payload processing.
- Added offline-first SQLite memory queue (`memory_queue`) and sync state management.
- Replaced memory save path with encrypt -> enqueue -> background sync orchestration.
- Added 30-second background sync worker with connectivity checks.
- Added Shared memories tab with decrypt-on-open flow using Lit session signatures.
- Removed Appwrite upload helper and `react-native-appwrite` dependency from app runtime.

## API/Env

- API base URL now sourced from `EXPO_PUBLIC_API_URL`.
- Privy token forwarding added to API requests (`Authorization: Bearer <token>`).
- Frontend env requirements now include:
  - `EXPO_PUBLIC_PRIVY_APP_ID`
  - `EXPO_PUBLIC_PRIVY_CLIENT_ID`
  - `EXPO_PUBLIC_API_URL`

## Notes

- Existing lint baseline still contains historical unrelated warnings/errors outside this migration scope.
- Legacy research documents under `.info2ai/` remain as non-runtime references.
