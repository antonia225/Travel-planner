// ─── API Configuration ───────────────────────────────────────────────────────
// Physical-device testing: replace YOUR_WIFI_IP with your computer's local IP.
//   Windows → run `ipconfig`  and look for "IPv4 Address" (e.g. 192.168.1.42)
//   macOS   → run `ipconfig getifaddr en0`
//
// Example: http://192.168.1.42:8000
//
// Alternatively, set the EXPO_PUBLIC_API_URL environment variable in a
// .env.local file at the frontend root and it will take precedence.
// ─────────────────────────────────────────────────────────────────────────────
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.188:8000";

const authHeaders = (token?: string) => {
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
};

export interface SavedTrip {
  id: number;
  user_id: number;
  title: string;
  destination: string;
  start_date: string;
  duration_days: number;
  itinerary_data: Record<string, any>;
  created_at: string;
}

export interface SavedTripsResponse {
  trips: SavedTrip[];
}

async function parseResponse(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

export async function fetchSavedTrips(token: string): Promise<SavedTripsResponse> {
  const response = await fetch(`${BASE_URL}/trips`, {
    method: "GET",
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch saved trips");
  }

  return parseResponse(response);
}

export async function fetchSavedTrip(token: string, id: number): Promise<SavedTrip> {
  const response = await fetch(`${BASE_URL}/trips/${id}`, {
    method: "GET",
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch saved trip");
  }

  return parseResponse(response);
}

export async function createSavedTrip(
  token: string,
  payload: Omit<SavedTrip, "id" | "user_id" | "created_at">
): Promise<SavedTrip> {
  const response = await fetch(`${BASE_URL}/trips`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to create saved trip");
  }

  return parseResponse(response);
}

export async function updateSavedTrip(
  token: string,
  id: number,
  payload: Partial<Omit<SavedTrip, "id" | "user_id" | "created_at">>
): Promise<SavedTrip> {
  const response = await fetch(`${BASE_URL}/trips/${id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to update saved trip");
  }

  return parseResponse(response);
}

export async function deleteSavedTrip(token: string, id: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/trips/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error("Failed to delete saved trip");
  }
}
