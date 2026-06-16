import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
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
} from "lucide-react-native";

import AppCard from "../components/AppCard";
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
import { colors, radius, shadows, spacing, typography } from "../theme/designSystem";
import {
  getVisibleBudgetOptimizationSavings,
  removeBudgetRecommendationForActivity,
} from "../utils/budgetOptimization";

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
  travelers?: number | null;
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

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
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
  const tripGenerationControllerRef = useRef<AbortController | null>(null);
  const budgetOptimizationControllerRef = useRef<AbortController | null>(null);
  const activityRegenerationControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      tripGenerationControllerRef.current?.abort();
      budgetOptimizationControllerRef.current?.abort();
      activityRegenerationControllerRef.current?.abort();
    };
  }, []);

  const handleTripSearch = async (tripData: TripSearchData) => {
    if (isGeneratingTrip) {
      return;
    }

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

    const controller = new AbortController();
    tripGenerationControllerRef.current = controller;

    try {
      setIsGeneratingTrip(true);
      setTripError(null);
      setActivityErrors({});
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
        signal: controller.signal,
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
      if (controller.signal.aborted) {
        return;
      }

      const enrichedItinerary: ItineraryResult = {
        ...generatedItinerary,
        start_date: generatedItinerary.start_date ?? tripData.startDate,
        end_date: generatedItinerary.end_date ?? tripData.endDate,
        budget_eur: generatedItinerary.budget_eur ?? tripData.budget,
        travelers: generatedItinerary.travelers ?? tripData.travelers,
        currency: generatedItinerary.currency ?? "EUR",
        days: addCalendarDatesToDays(generatedItinerary.days, tripData.startDate),
      };

      setItineraryResult(enrichedItinerary);
      setActivityBudgetEur(tripData.budget);
      setSavedTripId(null);
      setBudgetOptimizationStatus("idle");
      setBudgetOptimizationResult(null);
      setBudgetOptimizationError(null);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      const message = getErrorMessage(error);
      console.log("Trip search failed:", error);
      setTripError(message);
      Alert.alert("Could not connect to backend", message);
    } finally {
      if (tripGenerationControllerRef.current === controller) {
        tripGenerationControllerRef.current = null;
        setIsGeneratingTrip(false);
      }
    }
  };

  const handleCancelTripGeneration = () => {
    tripGenerationControllerRef.current?.abort();
    tripGenerationControllerRef.current = null;
    setIsGeneratingTrip(false);
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

    const controller = new AbortController();
    budgetOptimizationControllerRef.current = controller;

    try {
      setBudgetOptimizationStatus("loading");
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
        expensiveActivities,
        controller.signal
      );

      if (controller.signal.aborted) {
        return;
      }

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
      if (isAbortError(error)) {
        return;
      }

      const message = getErrorMessage(error);
      setBudgetOptimizationStatus("error");
      setBudgetOptimizationError(message);
    } finally {
      if (budgetOptimizationControllerRef.current === controller) {
        budgetOptimizationControllerRef.current = null;
      }
    }
  };

  const handleCancelBudgetOptimization = () => {
    budgetOptimizationControllerRef.current?.abort();
    budgetOptimizationControllerRef.current = null;
    setBudgetOptimizationStatus(
      budgetOptimizationResult || itineraryResult?.budget_optimization
        ? "success"
        : "idle"
    );
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
    const controller = new AbortController();
    activityRegenerationControllerRef.current = controller;

    try {
      setRegeneratingActivityKey(activityKey);
      setActivityErrors((current) => {
        const next = { ...current };
        delete next[activityKey];
        return next;
      });

      const replacement = await regenerateActivity(
        token,
        {
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
        },
        controller.signal
      );

      if (controller.signal.aborted) {
        return;
      }

      const nextBudgetOptimization = removeBudgetRecommendationForActivity(
        itineraryResult.days,
        currentBudgetOptimization,
        dayIndex,
        activityIndex
      );

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
          budget_optimization: nextBudgetOptimization,
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
      setBudgetOptimizationStatus(nextBudgetOptimization ? "success" : "idle");
      setBudgetOptimizationResult(nextBudgetOptimization);
      setBudgetOptimizationError(null);
      setSavedTripId(null);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      setActivityErrors((current) => ({
        ...current,
        [activityKey]: getErrorMessage(error),
      }));
    } finally {
      if (activityRegenerationControllerRef.current === controller) {
        activityRegenerationControllerRef.current = null;
        setRegeneratingActivityKey(null);
      }
    }
  };

  const handleCancelRegenerateActivity = () => {
    activityRegenerationControllerRef.current?.abort();
    activityRegenerationControllerRef.current = null;
    setRegeneratingActivityKey(null);
  };

  const displayedActivityTotal =
    itineraryResult?.total_estimated_cost_eur ?? sumActivityCosts(itineraryResult?.days);
  const currency = itineraryResult?.currency ?? "EUR";
  const isOptimizingBudget = budgetOptimizationStatus === "loading";
  const currentBudgetOptimization =
    budgetOptimizationResult ?? itineraryResult?.budget_optimization ?? null;
  const currentEstimatedSavings =
    getVisibleBudgetOptimizationSavings(
      itineraryResult?.days,
      currentBudgetOptimization
    );

  if (isLoading) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.root}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.white} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={styles.brandMark}>
            <Compass color={colors.teal700} size={22} strokeWidth={2.3} />
          </View>
          <View style={styles.topBarActions}>
            {canAccessAdmin(user) ? (
              <TouchableOpacity
                style={styles.navIconButton}
                activeOpacity={0.82}
                onPress={() => navigation.navigate("AdminDashboard")}
              >
                <ShieldCheck color={colors.slate700} size={18} strokeWidth={2.3} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.navIconButton}
              activeOpacity={0.82}
              onPress={() => navigation.navigate("Library")}
            >
              <BookOpen color={colors.slate700} size={18} strokeWidth={2.3} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navIconButton}
              activeOpacity={0.82}
              onPress={() => navigation.navigate("Profile")}
            >
              <UserRound color={colors.slate700} size={18} strokeWidth={2.3} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.coverStory}>
          <ImageBackground
            source={require("../../assets/travel-editorial-hero.png")}
            resizeMode="cover"
            style={styles.coverImage}
            imageStyle={styles.coverImageInner}
          >
            <View style={styles.coverScrim} />
            <View style={styles.coverCopy}>
              <Text style={styles.heroKicker}>Curated travel studio</Text>
              <Text style={styles.heroTitle}>
                Journeys that feel like luxury.
              </Text>
              <Text style={styles.heroSub}>
                Curated routes, refined pacing, and budget clarity for escapes
                that feel considered from the first step.
              </Text>
            </View>
          </ImageBackground>
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeLabel}>Concierge profile</Text>
            <Text style={styles.welcomeName}>{user?.name || "Traveler"}</Text>
            <View style={styles.welcomeMetaRow}>
              <View style={styles.welcomeMeta}>
                <Sparkles color={colors.gold600} size={15} strokeWidth={2.4} />
                <Text style={styles.welcomeMetaText}>AI planner</Text>
              </View>
              <View style={styles.welcomeMeta}>
                <Heart color={colors.gold600} size={15} strokeWidth={2.4} />
                <Text style={styles.welcomeMetaText}>
                  {user?.interests.length || 0} interests
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.plannerSection}>
          <Text style={styles.sectionLabel}>Plan the escape</Text>
          <TripSearchForm
            isSubmitting={isGeneratingTrip}
            onCancel={handleCancelTripGeneration}
            onSubmit={handleTripSearch}
          />
        </View>

        <View style={styles.contentFlow}>
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
                    budgetEur={itineraryResult.budget_eur ?? activityBudgetEur}
                    travelers={itineraryResult.travelers}
                    currency={currency}
                    estimatedSavingsEur={currentEstimatedSavings}
                  />

                  <View style={styles.budgetActions}>
                    <PrimaryButton
                      title={
                        isOptimizingBudget ? "Optimizing budget" : "Optimize Budget"
                      }
                      loading={isOptimizingBudget}
                      disabled={isOptimizingBudget}
                      fullWidth={false}
                      icon={
                        <Sparkles
                          color={colors.white}
                          size={16}
                          strokeWidth={2.4}
                        />
                      }
                      onPress={handleOptimizeBudget}
                      style={styles.optimizeBudgetButton}
                    />
                    {isOptimizingBudget ? (
                      <PrimaryButton
                        title="Cancel"
                        fullWidth={false}
                        variant="destructive"
                        onPress={handleCancelBudgetOptimization}
                        style={styles.cancelBudgetButton}
                      />
                    ) : null}
                  </View>

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

                  <ItineraryTimeline
                    days={itineraryResult.days}
                    budgetOptimization={currentBudgetOptimization}
                    regeneratingActivityKey={regeneratingActivityKey}
                    activityErrors={activityErrors}
                    onRegenerateActivity={handleRegenerateActivity}
                    onCancelRegenerateActivity={handleCancelRegenerateActivity}
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
    backgroundColor: colors.slate50,
    flex: 1,
  },
  scrollContent: {
    alignSelf: "center",
    maxWidth: 760,
    paddingBottom: 48,
    paddingHorizontal: 18,
    paddingTop: 12,
    width: "100%",
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
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.slate200,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
    ...shadows.soft,
  },
  topBarActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  navIconButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.slate200,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  coverStory: {
    gap: 0,
  },
  coverImage: {
    borderRadius: 28,
    height: 356,
    justifyContent: "flex-end",
    overflow: "hidden",
    ...shadows.card,
  },
  coverImageInner: {
    borderRadius: 28,
  },
  coverScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(24, 49, 58, 0.28)",
  },
  coverCopy: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 68,
    paddingTop: spacing.xxxl,
  },
  heroKicker: {
    color: colors.cream,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: spacing.md,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: colors.white,
    fontFamily: typography.displayFontFamily,
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 38,
    marginBottom: spacing.md,
  },
  heroSub: {
    color: colors.slate100,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
  },
  welcomeCard: {
    backgroundColor: "rgba(255, 250, 240, 0.98)",
    borderColor: "rgba(155, 116, 50, 0.18)",
    borderRadius: radius.lg,
    borderWidth: 1,
    marginHorizontal: spacing.md,
    marginTop: -34,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    ...shadows.soft,
  },
  welcomeLabel: {
    color: colors.gold600,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  welcomeName: {
    color: colors.slate900,
    fontFamily: typography.displayFontFamily,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
    marginTop: 3,
  },
  welcomeMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  welcomeMeta: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "rgba(155, 116, 50, 0.14)",
    borderWidth: 1,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  welcomeMetaText: {
    color: colors.slate700,
    fontSize: 12,
    fontWeight: "800",
  },
  plannerSection: {
    marginTop: spacing.xxl,
  },
  sectionLabel: {
    color: colors.gold600,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  contentFlow: {
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionCard: {
    marginBottom: 0,
    padding: spacing.lg,
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
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  optimizeBudgetButton: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    ...shadows.soft,
  },
  cancelBudgetButton: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
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
  resultText: {
    color: colors.slate700,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
});
