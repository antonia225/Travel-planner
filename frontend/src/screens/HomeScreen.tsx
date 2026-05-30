import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import TripSearchForm from "../components/TripSearchForm";
import { BASE_URL } from "../services/api";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  teal700: "#0f766e",
  teal600: "#0d9488",
  teal200: "#99f6e4",
  teal100: "#ccfbf1",
  teal50: "#f0fdfa",
  slate900: "#0f172a",
  slate500: "#64748b",
  slate400: "#94a3b8",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
  white: "#ffffff",
  red500: "#ef4444",
  red100: "#fee2e2",
  red900: "#7f1d1d",
  red800: "#991b1b",
  slate700: "#334155",
};

type TripSearchData = {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budget: number;
};

type ItineraryActivity = {
  title?: string;
  description?: string;
  time_slot?: string;
};

type ItineraryDay = {
  day_number?: number;
  activities?: ItineraryActivity[];
};

type ItineraryResult = {
  destination?: string;
  days?: ItineraryDay[];
  [key: string]: unknown;
};

type BackendErrorResponse = {
  detail?: unknown;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function countTripDays(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}

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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, token, logout, isLoading } = useAuth();

  const [isGeneratingTrip, setIsGeneratingTrip] = useState(false);
  const [itineraryResult, setItineraryResult] = useState<ItineraryResult | null>(
    null
  );
  const [tripError, setTripError] = useState<string | null>(null);

  const handleLogout = async () => {
    await logout();
  };

  const handleTripSearch = async (tripData: TripSearchData) => {
    if (!token) {
      const message = "Please log in again before generating a trip.";
      setTripError(message);
      Alert.alert("Not logged in", message);
      return;
    }

    const numDays = countTripDays(tripData.startDate, tripData.endDate);

    if (numDays < 1) {
      const message = "End date must be after start date.";
      setTripError(message);
      Alert.alert("Invalid dates", message);
      return;
    }

    try {
      setIsGeneratingTrip(true);
      setItineraryResult(null);
      setTripError(null);

      console.log("BASE_URL:", BASE_URL);
      console.log("Sending trip data to backend:", {
        destination: tripData.destination,
        num_days: numDays,
      });

      const response = await fetch(`${BASE_URL}/generate-itinerary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          destination: tripData.destination,
          num_days: numDays,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | ItineraryResult
        | BackendErrorResponse
        | null;

      if (!response.ok) {
        const backendMessage =
          result && "detail" in result
            ? formatBackendDetail(result.detail)
            : null;

        const message =
          backendMessage ||
          `Backend error: ${response.status} ${response.statusText}`;

        console.log("Backend error:", result);
        setTripError(message);
        Alert.alert("Could not generate itinerary", message);
        return;
      }

      console.log("AI itinerary result:", result);
      setItineraryResult(result as ItineraryResult);
      Alert.alert("Success", "AI itinerary generated.");
    } catch (error) {
      const message = getErrorMessage(error);
      console.log("Trip search failed:", error);
      setTripError(message);
      Alert.alert("Could not connect to backend", message);
    } finally {
      setIsGeneratingTrip(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={C.white} />
          <Text style={s.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scrollContent}>
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.iconBadge}>
            <Text style={{ fontSize: 36 }}>✈️</Text>
          </View>
          <View style={s.headerContent}>
            <Text style={s.greeting}>Welcome back,</Text>
            <Text style={s.userName}>{user?.name || "Traveler"}</Text>
          </View>
        </View>

        {/* ── User Info Card ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Account Details</Text>

          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Name</Text>
            <Text style={s.infoValue}>{user?.name}</Text>
          </View>

          <View style={s.divider} />

          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Email</Text>
            <Text style={s.infoValue}>{user?.email}</Text>
          </View>

          <View style={s.divider} />

          <View style={s.infoRow}>
            <Text style={s.infoLabel}>User ID</Text>
            <Text style={[s.infoValue, s.infoValueMuted]}>{user?.id}</Text>
          </View>
        </View>

        {/* ── Trip Search Form ── */}
        <View style={s.sectionSpacing}>
          <TripSearchForm onSubmit={handleTripSearch} />
        </View>

        {/* ── Loading Result ── */}
        {isGeneratingTrip ? (
          <View style={s.resultCard}>
            <ActivityIndicator size="large" color={C.teal600} />
            <Text style={s.resultLoadingText}>Generating itinerary...</Text>
          </View>
        ) : null}

        {/* ── Error Result ── */}
        {tripError ? (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>Trip generation failed</Text>
            <Text style={s.errorMessage}>{tripError}</Text>
            <Text style={s.errorMessage}>BASE_URL: {BASE_URL}</Text>
          </View>
        ) : null}

        {/* ── AI Result ── */}
        {itineraryResult ? (
          <View style={s.resultCard}>
            <Text style={s.cardTitle}>
              AI Itinerary for {itineraryResult.destination || "your trip"}
            </Text>

            {itineraryResult.days && itineraryResult.days.length > 0 ? (
              itineraryResult.days.map((day, index) => (
                <View key={index} style={s.dayResult}>
                  <Text style={s.dayTitle}>
                    Day {day.day_number || index + 1}
                  </Text>

                  {day.activities && day.activities.length > 0 ? (
                    day.activities.map((activity, activityIndex) => (
                      <View key={activityIndex} style={s.activityBox}>
                        <Text style={s.activityTitle}>
                          {activity.time_slot ? `${activity.time_slot} - ` : ""}
                          {activity.title || "Activity"}
                        </Text>

                        {activity.description ? (
                          <Text style={s.resultText}>
                            {activity.description}
                          </Text>
                        ) : null}
                      </View>
                    ))
                  ) : (
                    <Text style={s.resultText}>No activities found.</Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={s.resultText}>
                {JSON.stringify(itineraryResult, null, 2)}
              </Text>
            )}
          </View>
        ) : null}

        {/* ── Features Placeholder ── */}
        <View style={s.featuresCard}>
          <Text style={s.cardTitle}>Features</Text>
          <View style={s.featureItem}>
            <Text style={s.featureIcon}>🗺️</Text>
            <Text style={s.featureText}>Plan your perfect trip</Text>
          </View>
          <View style={s.featureItem}>
            <Text style={s.featureIcon}>🤖</Text>
            <Text style={s.featureText}>AI-powered recommendations</Text>
          </View>
          <View style={s.featureItem}>
            <Text style={s.featureIcon}>📍</Text>
            <Text style={s.featureText}>Discover hidden gems</Text>
          </View>
        </View>

        {/* ── Logout Button ── */}
        <TouchableOpacity
          style={s.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={s.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.teal700,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  sectionSpacing: {
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    color: C.white,
    fontSize: 14,
    fontWeight: "600",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
    gap: 16,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    color: C.teal100,
    fontSize: 14,
    fontWeight: "500",
  },
  userName: {
    color: C.white,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 4,
  },

  // Card
  card: {
    backgroundColor: C.slate50,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    color: C.slate900,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoLabel: {
    color: C.slate500,
    fontSize: 13,
    fontWeight: "600",
  },
  infoValue: {
    color: C.slate900,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  infoValueMuted: {
    color: C.slate400,
    fontSize: 12,
    fontFamily: "monospace",
  },
  divider: {
    height: 1,
    backgroundColor: C.slate200,
  },

  // Result Card
  resultCard: {
    backgroundColor: C.slate50,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  resultLoadingText: {
    color: C.slate700,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
  },
  dayResult: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  dayTitle: {
    color: C.teal700,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  activityBox: {
    backgroundColor: C.slate50,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  activityTitle: {
    color: C.slate900,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  resultText: {
    color: C.slate700,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    marginBottom: 4,
  },

  // Error Card
  errorCard: {
    backgroundColor: C.red100,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  errorTitle: {
    color: C.red800,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  errorMessage: {
    color: C.red900,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginBottom: 4,
  },

  // Features Card
  featuresCard: {
    backgroundColor: C.slate50,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureText: {
    color: C.slate700,
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },

  // Logout Button
  logoutButton: {
    backgroundColor: C.red500,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonText: {
    color: C.white,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});