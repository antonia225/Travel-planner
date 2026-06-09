// ─── API Configuration ───────────────────────────────────────────────────────
// Physical-device testing: replace YOUR_WIFI_IP with your computer's local IP.
//   Windows → run `ipconfig`  and look for "IPv4 Address" (e.g. 192.168.1.42)
//   macOS   → run `ipconfig getifaddr en0`
//
// Example: http://192.168.1.42:8000
//
// Set EXPO_PUBLIC_API_URL in a .env.local file at the frontend root when
// testing on a physical device. The emulator/default fallback is localhost.
// ─────────────────────────────────────────────────────────────────────────────
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

const REQUEST_TIMEOUT_MS = 30_000;
const AI_REQUEST_TIMEOUT_MS = 10 * 60_000;

export type Activity = {
  title: string;
  description: string;
  time_slot: string;
};

export type DailySchedule = {
  day_number: number;
  activities: Activity[];
};

export type ItineraryResponse = {
  destination: string;
  days: DailySchedule[];
};

export type BudgetRecommendation = {
  category: string;
  recommendation: string;
  estimated_cost: string;
};

export type BudgetOptimizerResponse = {
  destination: string;
  total_budget: number;
  recommendations: BudgetRecommendation[];
};

export type InterestCategoriesResponse = {
  categories: string[];
  descriptions: Record<string, string>;
};

export type UserProfile = {
  id: number;
  email: string;
  name: string;
  interests: string[];
};

export type TripListResponse = {
  id: number;
  destination: string;
  startDate: string;
  endDate: string;
  numberOfDays?: number;
  duration_days?: number;
  summary: string;
  createdAt: string;
  status: "upcoming" | "past";
};

export type TripDetailsResponse = TripListResponse & {
  itinerary: ItineraryResponse;
};

async function fetchJson<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail =
        typeof errorData?.detail === "string"
          ? errorData.detail
          : "Request failed";
      throw new Error(detail);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timerId);
  }
}

export function getMe(token: string): Promise<UserProfile> {
  return fetchJson<UserProfile>("/me", {}, token);
}

export function updateMyInterests(
  token: string,
  interests: string[]
): Promise<UserProfile> {
  return fetchJson<UserProfile>(
    "/me/interests",
    {
      method: "PUT",
      body: JSON.stringify({ interests }),
    },
    token
  );
}

export function getInterestCategories(): Promise<InterestCategoriesResponse> {
  return fetchJson<InterestCategoriesResponse>("/interests/categories");
}

export function generateItinerary(
  token: string,
  destination: string,
  numDays: number
): Promise<ItineraryResponse> {
  return fetchJson<ItineraryResponse>(
    "/generate-itinerary",
    {
      method: "POST",
      body: JSON.stringify({ destination, num_days: numDays }),
    },
    token,
    AI_REQUEST_TIMEOUT_MS
  );
}

export function optimizeBudget(
  destination: string,
  budget: number
): Promise<BudgetOptimizerResponse> {
  return fetchJson<BudgetOptimizerResponse>(
    "/optimize-budget",
    {
      method: "POST",
      body: JSON.stringify({ destination, budget }),
    },
    null,
    AI_REQUEST_TIMEOUT_MS
  );
}

export function saveTrip(payload: {
  destination: string;
  startDate: string;
  endDate: string;
  summary: string;
  itinerary: ItineraryResponse;
}): Promise<TripDetailsResponse> {
  return fetchJson<TripDetailsResponse>("/trips/save", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listSavedTrips(): Promise<TripListResponse[]> {
  return fetchJson<TripListResponse[]>("/trips/saved");
}

export function getSavedTrip(tripId: number): Promise<TripDetailsResponse> {
  return fetchJson<TripDetailsResponse>(`/trips/${tripId}`);
}
