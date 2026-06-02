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
const API_PORT = 8000;
const autoDetectedBaseUrl = host
  ? `http://${host}:${API_PORT}`
  : `http://localhost:${API_PORT}`;

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? autoDetectedBaseUrl;

export type GeneratedTripData = {
  destination?: string;
  days?: {
    day_number?: number;
    activities?: {
      title?: string;
      description?: string;
      time_slot?: string;
    }[];
  }[];
  [key: string]: unknown;
};

export type SavedTrip = {
  id: number;
  user_id: number;
  name: string;
  trip_data: GeneratedTripData;
  created_at: string;
  updated_at: string;
};

type BackendErrorResponse = {
  detail?: unknown;
};

function formatBackendDetail(detail: unknown) {
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (
          item &&
          typeof item === "object" &&
          "msg" in item &&
          typeof item.msg === "string"
        ) {
          return item.msg;
        }

        return JSON.stringify(item);
      })
      .join("; ");
  }

  if (detail) {
    return JSON.stringify(detail);
  }

  return null;
}

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const result = (await response.json().catch(() => null)) as
    | T
    | BackendErrorResponse
    | null;

  if (!response.ok) {
    const message =
      result &&
      typeof result === "object" &&
      "detail" in result
        ? formatBackendDetail(result.detail)
        : null;
    throw new Error(message || `Backend error: ${response.status}`);
  }

  return result as T;
}

export function listSavedTrips(token: string) {
  return request<SavedTrip[]>("/saved-trips", token);
}

export function readSavedTrip(token: string, tripId: number) {
  return request<SavedTrip>(`/saved-trips/${tripId}`, token);
}

export function saveGeneratedTrip(
  token: string,
  name: string,
  tripData: GeneratedTripData
) {
  return request<SavedTrip>("/saved-trips", token, {
    method: "POST",
    body: JSON.stringify({ name, tripData }),
  });
}

export function renameSavedTrip(token: string, tripId: number, name: string) {
  return request<SavedTrip>(`/saved-trips/${tripId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteSavedTrip(token: string, tripId: number) {
  return request<void>(`/saved-trips/${tripId}`, token, {
    method: "DELETE",
  });
}
