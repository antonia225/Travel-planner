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

export type RegenerateActivityRequest = {
  destination: string;
  dayIndex: number;
  activityIndex: number;
  oldActivity: Activity;
  itinerary?: ItineraryResponse;
  dayPlan?: DailySchedule;
  userPreferences?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
};

export type RegenerateActivityResponse = {
  activity: Activity;
};

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
  role: UserRole;
  is_active: boolean;
};

export type UserRole = "user" | "admin" | "super_admin";

export type AdminUser = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
};

export type AdminStats = {
  total_requests: number;
  active_requests: number;
  p95_latency_ms: number;
  error_count: number;
};

export function canAccessAdmin(user?: UserProfile | null): boolean {
  return user?.role === "admin" || user?.role === "super_admin";
}

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

export type SavedTrip = {
  id: number;
  user_id: number;
  name: string;
  trip_data: GeneratedTripData;
  created_at: string;
  updated_at: string;
};

function formatErrorDetail(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const location = Array.isArray(record.loc)
            ? record.loc.join(".")
            : undefined;
          const message =
            typeof record.msg === "string"
              ? record.msg
              : JSON.stringify(record);

          return location ? `${location}: ${message}` : message;
        }

        return String(item);
      })
      .filter(Boolean);

    return messages.join("\n");
  }

  if (detail && typeof detail === "object") {
    return JSON.stringify(detail);
  }

  return "";
}

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
      const detail = formatErrorDetail(errorData?.detail) || "Request failed";
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

export function updateMyProfile(
  token: string,
  name: string,
  email: string
): Promise<UserProfile> {
  return fetchJson<UserProfile>(
    "/me",
    {
      method: "PATCH",
      body: JSON.stringify({ name, email }),
    },
    token
  );
}

export function changeMyPassword(
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  return fetchJson<void>(
    "/me/password",
    {
      method: "PUT",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    },
    token
  );
}

export function getInterestCategories(): Promise<InterestCategoriesResponse> {
  return fetchJson<InterestCategoriesResponse>("/interests/categories");
}

export function listInterestCategories(): Promise<InterestCategoriesResponse> {
  return getInterestCategories();
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

export async function regenerateActivity(
  token: string,
  payload: RegenerateActivityRequest
): Promise<Activity> {
  const response = await fetchJson<RegenerateActivityResponse>(
    "/itinerary/regenerate-activity",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
    AI_REQUEST_TIMEOUT_MS
  );

  return response.activity;
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

export function saveGeneratedTrip(
  token: string,
  name: string,
  tripData: GeneratedTripData
): Promise<SavedTrip> {
  return fetchJson<SavedTrip>(
    "/saved-trips",
    {
      method: "POST",
      body: JSON.stringify({ name, tripData }),
    },
    token
  );
}

export function listSavedTrips(token: string): Promise<SavedTrip[]>;
export function listSavedTrips(): Promise<TripListResponse[]>;
export function listSavedTrips(
  token?: string
): Promise<SavedTrip[] | TripListResponse[]> {
  if (token) {
    return fetchJson<SavedTrip[]>("/saved-trips", {}, token);
  }

  return fetchJson<TripListResponse[]>("/trips/saved");
}

export function getSavedTrip(tripId: number): Promise<TripDetailsResponse> {
  return fetchJson<TripDetailsResponse>(`/trips/${tripId}`);
}

export function renameSavedTrip(
  token: string,
  tripId: number,
  name: string
): Promise<SavedTrip> {
  return fetchJson<SavedTrip>(
    `/saved-trips/${tripId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ name }),
    },
    token
  );
}

export function deleteSavedTrip(token: string, tripId: number): Promise<void> {
  return fetchJson<void>(
    `/saved-trips/${tripId}`,
    {
      method: "DELETE",
    },
    token
  );
}

export function listAdminUsers(token: string): Promise<AdminUser[]> {
  return fetchJson<AdminUser[]>("/admin/users", {}, token);
}

export function getAdminStats(adminToken?: string): Promise<AdminStats> {
  const headers = adminToken
    ? { "X-Admin-Token": adminToken }
    : process.env.EXPO_PUBLIC_ADMIN_TOKEN
    ? { "X-Admin-Token": process.env.EXPO_PUBLIC_ADMIN_TOKEN }
    : {};

  return fetchJson<AdminStats>("/admin/stats", { headers });
}

export function updateAdminUserRole(
  token: string,
  userId: number,
  role: UserRole
): Promise<AdminUser> {
  return fetchJson<AdminUser>(
    `/admin/users/${userId}/role`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    },
    token
  );
}

export function updateAdminUserStatus(
  token: string,
  userId: number,
  isActive: boolean
): Promise<AdminUser> {
  return fetchJson<AdminUser>(
    `/admin/users/${userId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    },
    token
  );
}
