import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Compass,
  Heart,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
} from "lucide-react-native";

import AppCard from "../components/AppCard";
import BudgetOptimizationSummary from "../components/BudgetOptimizationSummary";
import ItineraryBudgetSummary from "../components/ItineraryBudgetSummary";
import ItineraryTimeline from "../components/ItineraryTimeline";
import PrimaryButton from "../components/PrimaryButton";
import SectionHeader from "../components/SectionHeader";
import TripSearchForm from "../components/TripSearchForm";
import { useAuth } from "../context/AuthContext";
import {
  BASE_URL,
  canAccessAdmin,
  optimizeBudget,
  regenerateActivity,
  saveGeneratedTrip,
} from "../services/api";
import type {
  Activity,
  BudgetOptimizerActivity,
  BudgetOptimizerResponse,
  ItineraryResponse,
} from "../services/api";
import { colors, radius, shadows, spacing } from "../theme/designSystem";

const EURO = "\u20ac";

type TripSearchData = {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budget: number;
};

export type ItineraryActivity = {
  title?: string;
  description?: string;
  time_slot?: string;
  estimated_cost_eur?: number | null;
};

export type ItineraryDay = {
  day_number?: number;
  date?: string | null;
  activities?: ItineraryActivity[];
};

export type ItineraryResult = {
  destination?: string;
  currency?: "EUR";
  total_estimated_cost_eur?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  budget_eur?: number | null;
  budget_optimization?: BudgetOptimizerResponse | null;
  days?: ItineraryDay[];
  [key: string]: unknown;
};

type BackendErrorResponse = {
  detail?: unknown;
};

type BudgetOptimizationStatus = "idle" | "loading" | "success" | "error";

type Props = {
  navigation: {
    navigate: (screen: string) => void;
  };
};

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

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sumActivityCosts(days?: ItineraryDay[]) {
  return (days ?? []).reduce(
    (total, day) =>
      total +
      (day.activities ?? []).reduce(
        (dayTotal, activity) => dayTotal + (activity.estimated_cost_eur ?? 0),
        0
      ),
    0
  );
}

function addCalendarDatesToDays(days: ItineraryDay[] | undefined, startDate: string) {
  const parsedStartDate = parseLocalDate(startDate);

  return (days ?? []).map((day, index) => ({
    ...day,
    date: day.date ?? formatIsoDate(addDays(parsedStartDate, index)),
  }));
}

export function selectMostExpensiveBudgetActivities(
  days: ItineraryDay[] | undefined,
  limit = 3
): BudgetOptimizerActivity[] {
  return (days ?? [])
    .flatMap((day, dayIndex) =>
      (day.activities ?? []).map((activity) => ({
        title: activity.title?.trim() || "Untitled activity",
        description: activity.description?.trim() || "No description provided.",
        time_slot: activity.time_slot?.trim() || "Flexible time",
        day_number: day.day_number ?? dayIndex + 1,
        estimated_cost_eur: activity.estimated_cost_eur,
      }))
    )
    .filter(
      (
        activity
      ): activity is BudgetOptimizerActivity =>
        typeof activity.estimated_cost_eur === "number" &&
        activity.estimated_cost_eur > 0
    )
    .sort((first, second) => second.estimated_cost_eur - first.estimated_cost_eur)
    .slice(0, limit);
}

export function buildTripDataToSave<T extends ItineraryResult>(
  itinerary: T,
  budgetOptimization: BudgetOptimizerResponse | null
): T {
  if (!budgetOptimization) {
    return itinerary;
  }

  return {
    ...itinerary,
    budget_optimization: budgetOptimization,
  };
}

export default function HomeScreen({ navigation }: Props) {
  const { user, token, isLoading } = useAuth();

  const [isGeneratingTrip, setIsGeneratingTrip] = useState(false);
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [regeneratingActivityKey, setRegeneratingActivityKey] = useState<
    string | null
  >(null);
  const [activityErrors, setActivityErrors] = useState<
    Record<string, string | undefined>
  >({});
  const [activityBudgetEur, setActivityBudgetEur] = useState<number | null>(null);
  const [savedTripId, setSavedTripId] = useState<number | null>(null);
  const [itineraryResult, setItineraryResult] = useState<ItineraryResult | null>(
    null
  );
  const [tripError, setTripError] = useState<string | null>(null);
  const [budgetOptimizationStatus, setBudgetOptimizationStatus] =
    useState<BudgetOptimizationStatus>("idle");
  const [budgetOptimizationResult, setBudgetOptimizationResult] =
    useState<BudgetOptimizerResponse | null>(null);
  const [budgetOptimizationError, setBudgetOptimizationError] = useState<
    string | null
  >(null);

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
      setActivityBudgetEur(null);
      setSavedTripId(null);
      setTripError(null);
      setActivityErrors({});
      setBudgetOptimizationStatus("idle");
      setBudgetOptimizationResult(null);
      setBudgetOptimizationError(null);

      console.log("Sending trip data to backend:", {
        destination: tripData.destination,
        num_days: numDays,
        start_date: tripData.startDate,
        end_date: tripData.endDate,
        travelers: tripData.travelers,
        budget: tripData.budget,
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
          start_date: tripData.startDate,
          end_date: tripData.endDate,
          travelers: tripData.travelers,
          budget: tripData.budget,
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
      const generatedItinerary = result as ItineraryResult;
      const enrichedItinerary: ItineraryResult = {
        ...generatedItinerary,
        start_date: generatedItinerary.start_date ?? tripData.startDate,
        end_date: generatedItinerary.end_date ?? tripData.endDate,
        budget_eur: generatedItinerary.budget_eur ?? tripData.budget,
        currency: generatedItinerary.currency ?? "EUR",
        days: addCalendarDatesToDays(generatedItinerary.days, tripData.startDate),
      };

      setItineraryResult(enrichedItinerary);
      setActivityBudgetEur(tripData.budget);
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

  const handleSaveGeneratedTrip = async () => {
    if (!token || !itineraryResult) {
      Alert.alert("Nothing to save", "Generate a trip before saving it.");
      return;
    }

    const destination = itineraryResult.destination || "Generated trip";
    const tripDataToSave = buildTripDataToSave(
      itineraryResult,
      budgetOptimizationResult
    );

    try {
      setIsSavingTrip(true);
      const savedTrip = await saveGeneratedTrip(
        token,
        `${destination} trip`,
        tripDataToSave
      );
      setItineraryResult(tripDataToSave);
      setSavedTripId(savedTrip.id);
      Alert.alert("Trip saved", "You can find it in your library.");
    } catch (error) {
      Alert.alert("Could not save trip", getErrorMessage(error));
    } finally {
      setIsSavingTrip(false);
    }
  };

  const handleOptimizeBudget = async () => {
    if (budgetOptimizationStatus === "loading") {
      return;
    }

    if (!token) {
      const message = "Please log in again before optimizing your budget.";
      setBudgetOptimizationStatus("error");
      setBudgetOptimizationResult(null);
      setBudgetOptimizationError(message);
      Alert.alert("Not logged in", message);
      return;
    }

    if (!itineraryResult) {
      Alert.alert(
        "Nothing to optimize",
        "Generate a trip before optimizing its budget."
      );
      return;
    }

    const destination = itineraryResult.destination || "Generated trip";
    const budgetEur = itineraryResult.budget_eur ?? activityBudgetEur;

    if (typeof budgetEur !== "number" || budgetEur <= 0) {
      const message = "This itinerary does not have a valid budget to optimize.";
      setBudgetOptimizationStatus("error");
      setBudgetOptimizationResult(null);
      setBudgetOptimizationError(message);
      Alert.alert("Could not optimize budget", message);
      return;
    }

    try {
      setBudgetOptimizationStatus("loading");
      setBudgetOptimizationResult(null);
      setBudgetOptimizationError(null);

      const expensiveActivities = selectMostExpensiveBudgetActivities(
        itineraryResult.days
      );

      if (expensiveActivities.length === 0) {
        setBudgetOptimizationStatus("error");
        setBudgetOptimizationError(
          "No paid activities found to optimize in this itinerary."
        );
        return;
      }

      const result = await optimizeBudget(
        token,
        destination,
        budgetEur,
        expensiveActivities
      );

      setBudgetOptimizationResult(result);
      setBudgetOptimizationStatus("success");
      setItineraryResult((current) =>
        current
          ? {
              ...current,
              budget_optimization: result,
            }
          : current
      );
      setSavedTripId(null);
    } catch (error) {
      const message = getErrorMessage(error);
      setBudgetOptimizationResult(null);
      setBudgetOptimizationStatus("error");
      setBudgetOptimizationError(message);
    }
  };

  const handleRegenerateActivity = async (
    dayIndex: number,
    activityIndex: number,
    activity: ItineraryActivity
  ) => {
    if (regeneratingActivityKey) {
      return;
    }

    if (!token || !itineraryResult?.days?.length) {
      Alert.alert("Not ready", "Generate an itinerary before replacing activities.");
      return;
    }

    if (!activity.title || !activity.description || !activity.time_slot) {
      Alert.alert(
        "Cannot replace activity",
        "This activity is missing required details."
      );
      return;
    }

    const destination = itineraryResult.destination || "Generated trip";
    const activityKey = `${dayIndex}:${activityIndex}`;
    const currentTotal =
      itineraryResult.total_estimated_cost_eur ?? sumActivityCosts(itineraryResult.days);
    const budgetEur = itineraryResult.budget_eur ?? activityBudgetEur;
    const oldActivityCost = activity.estimated_cost_eur ?? 0;
    const remainingBudget =
      typeof budgetEur === "number" ? Math.max(budgetEur - currentTotal, 0) : null;
    const maxReplacementCostEur =
      remainingBudget === null ? undefined : oldActivityCost + remainingBudget;

    try {
      setRegeneratingActivityKey(activityKey);
      setActivityErrors((current) => {
        const next = { ...current };
        delete next[activityKey];
        return next;
      });

      const replacement = await regenerateActivity(token, {
        destination,
        dayIndex,
        activityIndex,
        oldActivity: activity as Activity,
        itinerary: {
          destination,
          days: itineraryResult.days,
        } as ItineraryResponse,
        userPreferences: {
          interests: user?.interests ?? [],
        },
        constraints: {
          preserveExactTimeSlot: activity.time_slot,
          currentTotalCostEur: currentTotal,
          budgetEur,
          maxReplacementCostEur,
        },
      });

      setItineraryResult((current) => {
        if (!current?.days) {
          return current;
        }

        const updatedDays = current.days.map((day, currentDayIndex) => {
            if (currentDayIndex !== dayIndex) {
              return day;
            }

            const activities = day.activities ?? [];
            return {
              ...day,
              activities: activities.map((item, currentActivityIndex) =>
                currentActivityIndex === activityIndex ? replacement : item
              ),
            };
          });

        return {
          ...current,
          budget_optimization: null,
          destination,
          currency: current.currency ?? "EUR",
          total_estimated_cost_eur: sumActivityCosts(updatedDays),
          days: updatedDays,
        };
      });
      setActivityErrors((current) => {
        const next = { ...current };
        delete next[activityKey];
        return next;
      });
      setBudgetOptimizationStatus("idle");
      setBudgetOptimizationResult(null);
      setBudgetOptimizationError(null);
      setSavedTripId(null);
    } catch (error) {
      setActivityErrors((current) => ({
        ...current,
        [activityKey]: getErrorMessage(error),
      }));
    } finally {
      setRegeneratingActivityKey(null);
    }
  };

  const displayedActivityTotal =
    itineraryResult?.total_estimated_cost_eur ?? sumActivityCosts(itineraryResult?.days);
  const currency = itineraryResult?.currency ?? "EUR";
  const isOptimizingBudget = budgetOptimizationStatus === "loading";

  if (isLoading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.white} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.iconBadge}>
              <Compass color={colors.white} size={30} strokeWidth={2.2} />
            </View>

            <View style={styles.headerActions}>
              {canAccessAdmin(user) ? (
                <TouchableOpacity
                  style={styles.headerButton}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate("AdminDashboard")}
                >
                  <ShieldCheck
                    color={colors.white}
                    size={17}
                    strokeWidth={2.3}
                  />
                  <Text style={styles.headerButtonText}>Admin</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.headerButton}
                activeOpacity={0.8}
                onPress={() => navigation.navigate("Library")}
              >
                <BookOpen color={colors.white} size={17} strokeWidth={2.3} />
                <Text style={styles.headerButtonText}>Library</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.headerButton, styles.profileButton]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate("Profile")}
              >
                <UserRound color={colors.white} size={17} strokeWidth={2.3} />
                <Text style={styles.headerButtonText}>Profile</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.heroKicker}>Trip planner</Text>
          <Text style={styles.heroTitle}>
            Where to next,{"\n"}
            {user?.name || "Traveler"}?
          </Text>
          <Text style={styles.heroSub}>
            Generate an itinerary, review the timeline, and save the trip when
            it feels right.
          </Text>

          <View style={styles.statRow}>
            <View style={[styles.stat, styles.statTeal]}>
              <Sparkles color={colors.teal700} size={18} strokeWidth={2.2} />
              <Text style={styles.statLabelDark}>AI planner</Text>
            </View>
            <View style={[styles.stat, styles.statSky]}>
              <WalletCards color={colors.sky600} size={18} strokeWidth={2.2} />
              <Text style={styles.statLabelDark}>Budget-aware</Text>
            </View>
            <View style={[styles.stat, styles.statAmber]}>
              <Heart color={colors.amber600} size={18} strokeWidth={2.2} />
              <Text style={styles.statLabelDark}>
                {user?.interests.length || 0} interests
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.contentSheet}>
          <TripSearchForm onSubmit={handleTripSearch} />

          {isGeneratingTrip ? (
            <AppCard elevated style={styles.feedbackCard}>
              <ActivityIndicator size="large" color={colors.teal600} />
              <Text style={styles.feedbackTitle}>Generating itinerary...</Text>
              <Text style={styles.feedbackText}>
                The planner is building your daily schedule.
              </Text>
            </AppCard>
          ) : null}

          {tripError ? (
            <View style={styles.errorCard}>
              <AlertCircle color={colors.red700} size={22} strokeWidth={2.4} />
              <View style={styles.errorCopy}>
                <Text style={styles.errorTitle}>Trip generation failed</Text>
                <Text style={styles.errorMessage}>{tripError}</Text>
              </View>
            </View>
          ) : null}

          {itineraryResult ? (
            <AppCard elevated style={styles.sectionCard}>
              <SectionHeader
                eyebrow="Generated itinerary"
                title={`AI itinerary for ${
                  itineraryResult.destination || "your trip"
                }`}
                action={
                  <PrimaryButton
                    title={savedTripId ? "Saved" : "Save"}
                    loading={isSavingTrip}
                    disabled={isSavingTrip || !!savedTripId}
                    fullWidth={false}
                    icon={
                      savedTripId ? (
                        <CheckCircle2
                          color={colors.white}
                          size={16}
                          strokeWidth={2.4}
                        />
                      ) : (
                        <Save
                          color={colors.white}
                          size={16}
                          strokeWidth={2.4}
                        />
                      )
                    }
                    onPress={handleSaveGeneratedTrip}
                    style={styles.saveTripButton}
                  />
                }
              />

              {itineraryResult.days && itineraryResult.days.length > 0 ? (
                <>
                  <ItineraryBudgetSummary
                    totalCostEur={displayedActivityTotal}
                    budgetEur={activityBudgetEur}
                    currency={currency}
                  />

                  <View style={styles.budgetActions}>
                    <PrimaryButton
                      title="Optimize Budget"
                      loading={isOptimizingBudget}
                      disabled={isOptimizingBudget}
                      fullWidth={false}
                      variant="secondary"
                      icon={
                        <Sparkles
                          color={colors.teal700}
                          size={16}
                          strokeWidth={2.4}
                        />
                      }
                      onPress={handleOptimizeBudget}
                      style={styles.optimizeBudgetButton}
                    />
                  </View>

                  {isOptimizingBudget ? (
                    <View style={styles.budgetFeedbackPanel}>
                      <ActivityIndicator size="small" color={colors.teal600} />
                      <Text style={styles.budgetFeedbackText}>
                        Optimizing your budget recommendations...
                      </Text>
                    </View>
                  ) : null}

                  {budgetOptimizationStatus === "error" &&
                  budgetOptimizationError ? (
                    <View style={styles.budgetErrorPanel}>
                      <AlertCircle
                        color={colors.red700}
                        size={16}
                        strokeWidth={2.4}
                      />
                      <Text style={styles.budgetErrorText}>
                        {budgetOptimizationError}
                      </Text>
                    </View>
                  ) : null}

                  {budgetOptimizationStatus === "success" &&
                  budgetOptimizationResult ? (
                    <BudgetOptimizationSummary
                      result={budgetOptimizationResult}
                      saved={!!savedTripId}
                    />
                  ) : null}

                  <ItineraryTimeline
                    days={itineraryResult.days}
                    regeneratingActivityKey={regeneratingActivityKey}
                    activityErrors={activityErrors}
                    onRegenerateActivity={handleRegenerateActivity}
                  />
                </>
              ) : (
                <Text style={styles.resultText}>
                  {JSON.stringify(itineraryResult, null, 2)}
                </Text>
              )}
            </AppCard>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.teal700,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
    marginTop: spacing.lg,
  },
  hero: {
    backgroundColor: colors.teal700,
    paddingBottom: 60,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  heroTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    marginBottom: spacing.xxl,
  },
  iconBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 16,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    flexShrink: 1,
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  headerButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  profileButton: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  headerButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  heroKicker: {
    color: colors.teal100,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: colors.white,
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 42,
    marginBottom: spacing.md,
  },
  heroSub: {
    color: colors.teal200,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    marginBottom: spacing.xxl,
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  stat: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minHeight: 62,
    padding: spacing.md,
  },
  statTeal: {
    backgroundColor: colors.teal50,
    borderColor: colors.teal200,
  },
  statSky: {
    backgroundColor: colors.sky50,
    borderColor: "#bae6fd",
  },
  statAmber: {
    backgroundColor: colors.amber50,
    borderColor: "#fde68a",
  },
  statLabelDark: {
    color: colors.slate700,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  contentSheet: {
    backgroundColor: colors.slate50,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    gap: spacing.lg,
    marginTop: -28,
    minHeight: 520,
    paddingBottom: 42,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  sectionCard: {
    marginBottom: 0,
  },
  feedbackCard: {
    alignItems: "center",
    gap: spacing.sm,
  },
  feedbackTitle: {
    color: colors.slate900,
    fontSize: 15,
    fontWeight: "800",
    marginTop: spacing.sm,
  },
  feedbackText: {
    color: colors.slate500,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    textAlign: "center",
  },
  errorCard: {
    alignItems: "flex-start",
    backgroundColor: colors.red50,
    borderColor: colors.redBorder,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.xl,
    ...shadows.soft,
  },
  errorCopy: {
    flex: 1,
  },
  errorTitle: {
    color: colors.red700,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
  errorMessage: {
    color: colors.red700,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  saveTripButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  budgetActions: {
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  optimizeBudgetButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  budgetFeedbackPanel: {
    alignItems: "center",
    backgroundColor: colors.teal50,
    borderColor: colors.teal200,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  budgetFeedbackText: {
    color: colors.teal700,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  budgetErrorPanel: {
    alignItems: "center",
    backgroundColor: colors.red50,
    borderColor: colors.redBorder,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  budgetErrorText: {
    color: colors.red700,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  budgetOptimizationPanel: {
    backgroundColor: colors.sky50,
    borderColor: "#bae6fd",
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  budgetOptimizationTitle: {
    color: colors.slate900,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  budgetOptimizationMeta: {
    color: colors.slate500,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: -spacing.sm,
  },
  recommendationList: {
    gap: spacing.sm,
  },
  recommendationItem: {
    backgroundColor: colors.white,
    borderColor: colors.slate100,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  recommendationHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  recommendationCategory: {
    color: colors.slate900,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  recommendationCost: {
    color: colors.teal700,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "right",
  },
  recommendationText: {
    color: colors.slate600,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  resultText: {
    color: colors.slate700,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
});
