import Constants from "expo-constants";

// ─── API Configuration ───────────────────────────────────────────────────────
// Physical-device testing: replace YOUR_WIFI_IP with your computer's local IP.
//   Windows → run `ipconfig`  and look for "IPv4 Address" (e.g. 192.168.1.42)
//   macOS   → run `ipconfig getifaddr en0`
//
// Example: http://192.168.1.42:8000
//
// By default we auto-detect your Expo dev host IP and use port 8000.
// Alternatively, set the EXPO_PUBLIC_API_URL environment variable in a
// .env.local file at the frontend root and it will take precedence.
// ─────────────────────────────────────────────────────────────────────────────
const host = Constants.expoConfig?.hostUri?.split(":")[0];
const autoDetectedBaseUrl = host ? `http://${host}:8000` : "http://localhost:8000";

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? autoDetectedBaseUrl;
