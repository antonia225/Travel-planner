import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import TripSearchForm from "../components/TripSearchForm";
import {
  BASE_URL,
  listInterestCategories,
  saveGeneratedTrip,
} from "../services/api";
import { allRulesMet, checkPassword } from "../utils/validation";
import {
  BudgetOptimizerResponse,
  getInterestCategories,
  getMe,
  getSavedTrip,
  generateItinerary,
  ItineraryResponse,
  listSavedTrips,
  optimizeBudget,
  saveTrip,
  TripDetailsResponse,
  TripListResponse,
  updateMyInterests,
} from "../services/api";

const C = {
  teal700: "#0f766e",
  teal600: "#0d9488",
  teal100: "#ccfbf1",
  teal50: "#f0fdfa",
  slate900: "#0f172a",
  slate700: "#334155",
  slate500: "#64748b",
  slate400: "#94a3b8",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
  white: "#ffffff",
  red500: "#ef4444",
  red50: "#fef2f2",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.textArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.slate400}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

function ActionButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  tone = "primary",
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "danger";
}) {
  const isDisabled = disabled || loading;
  const buttonStyle = [
    s.button,
    tone === "danger" ? s.buttonDanger : null,
    tone === "secondary" ? s.buttonSecondary : null,
    isDisabled ? s.buttonDisabled : null,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={tone === "secondary" ? C.teal600 : C.white} />
      ) : (
        <Text
          style={[
            s.buttonText,
            tone === "secondary" ? s.buttonTextSecondary : null,
            isDisabled ? s.buttonTextDisabled : null,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function formatInterest(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function tripDays(trip: TripListResponse) {
  return trip.numberOfDays ?? trip.duration_days ?? 0;
}

export default function HomeScreen() {
  const { user, token, logout, isLoading } = useAuth();

  const [categories, setCategories] = useState<string[]>([]);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    user?.interests ?? []
  );
  const [interestLoading, setInterestLoading] = useState(false);

  const [destination, setDestination] = useState("");
  const [numDays, setNumDays] = useState("3");
  const [itinerary, setItinerary] = useState<ItineraryResponse | null>(null);
  const [itineraryLoading, setItineraryLoading] = useState(false);

  const [budgetDestination, setBudgetDestination] = useState("");
  const [budget, setBudget] = useState("800");
  const [budgetPlan, setBudgetPlan] =
    useState<BudgetOptimizerResponse | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summary, setSummary] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);

  const [trips, setTrips] = useState<TripListResponse[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<TripDetailsResponse | null>(
    null
  );
  const [tripsLoading, setTripsLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedInterestSet = useMemo(
    () => new Set(selectedInterests),
    [selectedInterests]
  );

  const refreshTrips = useCallback(async () => {
    setTripsLoading(true);
    try {
      const savedTrips = await listSavedTrips();
      setTrips(savedTrips);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load saved trips."
      );
    } finally {
      setTripsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [categoryResponse, savedTrips] = await Promise.all([
          getInterestCategories(),
          listSavedTrips(),
        ]);

        setCategories(categoryResponse.categories);
        setDescriptions(categoryResponse.descriptions);
        setTrips(savedTrips);

        if (token) {
          const profile = await getMe(token);
          setSelectedInterests(profile.interests ?? []);
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load planner data."
        );
      }
    }

    void loadInitialData();
  }, [token]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest]
    );
  };

  const handleSaveInterests = async () => {
    if (!token) return;

    setMessage("");
    setErrorMessage("");
    setInterestLoading(true);
    try {
      const profile = await updateMyInterests(token, selectedInterests);
      setSelectedInterests(profile.interests ?? []);
      setMessage("Travel interests saved.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not save interests."
      );
    } finally {
      setInterestLoading(false);
    }
  };

  const handleGenerateItinerary = async () => {
    if (!token) return;

    const days = Number.parseInt(numDays, 10);
    if (!destination.trim() || Number.isNaN(days) || days < 1) {
      setErrorMessage("Enter a destination and a valid number of days.");
      return;
    }

    setMessage("");
    setErrorMessage("");
    setItineraryLoading(true);
    try {
      const result = await generateItinerary(token, destination.trim(), days);
      setItinerary(result);
      setSummary(
        `${result.days.length}-day trip to ${result.destination} with ${result.days[0]?.activities[0]?.title ?? "custom activities"}.`
      );
      setMessage("Itinerary generated.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not generate itinerary."
      );
    } finally {
      setItineraryLoading(false);
    }
  };

  const handleOptimizeBudget = async () => {
    const parsedBudget = Number.parseInt(budget, 10);
    const targetDestination = budgetDestination.trim() || destination.trim();

    if (!targetDestination || Number.isNaN(parsedBudget) || parsedBudget < 1) {
      setErrorMessage("Enter a destination and a valid budget.");
      return;
    }

    setMessage("");
    setErrorMessage("");
    setBudgetLoading(true);
    try {
      const result = await optimizeBudget(targetDestination, parsedBudget);
      setBudgetPlan(result);
      setMessage("Budget plan generated.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not optimize budget."
      );
    } finally {
      setBudgetLoading(false);
    }
  };

  const handleSaveTrip = async () => {
    if (!itinerary) {
      setErrorMessage("Generate an itinerary before saving a trip.");
      return;
    }

    if (!startDate || !endDate || !summary.trim()) {
      setErrorMessage("Enter start date, end date, and a short summary.");
      return;
    }

    setMessage("");
    setErrorMessage("");
    setSaveLoading(true);
    try {
      const trip = await saveTrip({
        destination: itinerary.destination,
        startDate,
        endDate,
        summary: summary.trim(),
        itinerary,
      });
      setSelectedTrip(trip);
      setMessage("Trip saved.");
      await refreshTrips();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not save trip."
      );
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSelectTrip = async (tripId: number) => {
    setMessage("");
    setErrorMessage("");
    setTripsLoading(true);
    try {
      const trip = await getSavedTrip(tripId);
      setSelectedTrip(trip);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load trip details."
      );
    } finally {
      setTripsLoading(false);
    }
  };

  const handleEditProfile = () => {
    setProfileName(user?.name ?? "");
    setProfileEmail(user?.email ?? "");
    setSelectedInterests(user?.interests ?? []);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    if (interestOptions.length > 0) {
      setProfileError(null);
    }
    setIsEditingProfile(true);
  };

  const handleCancelProfileEdit = () => {
    setProfileName(user?.name ?? "");
    setProfileEmail(user?.email ?? "");
    setSelectedInterests(user?.interests ?? []);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setProfileError(null);
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    const cleanedName = profileName.trim();
    const cleanedEmail = profileEmail.trim();
    const wantsPasswordChange =
      currentPassword.length > 0 ||
      newPassword.length > 0 ||
      confirmPassword.length > 0;

    if (!cleanedName) {
      const message = "Name cannot be empty.";
      setProfileError(message);
      Alert.alert("Check profile details", message);
      return;
    }

    if (!cleanedEmail || !cleanedEmail.includes("@")) {
      const message = "Enter a valid email address.";
      setProfileError(message);
      Alert.alert("Check profile details", message);
      return;
    }

    if (wantsPasswordChange) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        const message = "Fill all password fields to change your password.";
        setProfileError(message);
        Alert.alert("Check password details", message);
        return;
      }

      if (newPassword !== confirmPassword) {
        const message = "New password and confirmation do not match.";
        setProfileError(message);
        Alert.alert("Check password details", message);
        return;
      }

      if (!allRulesMet(checkPassword(newPassword))) {
        const message =
          "New password must have at least 8 characters, uppercase, lowercase, and a number.";
        setProfileError(message);
        Alert.alert("Check password details", message);
        return;
      }
    }

    try {
      setIsSavingProfile(true);
      setProfileError(null);
      await updateUserProfile(cleanedName, cleanedEmail);
      await updateUserInterests(selectedInterests);

      if (wantsPasswordChange) {
        await changeUserPassword(currentPassword, newPassword);
      }

      setIsEditingProfile(false);
      Alert.alert("Profile updated", "Your account details were saved.");
    } catch (error) {
      const message = getErrorMessage(error);
      setProfileError(message);
      Alert.alert("Could not update profile", message);
    } finally {
      setIsSavingProfile(false);
    }
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
      setSavedTripId(null);
      setTripError(null);

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

  const handleSaveGeneratedTrip = async () => {
    if (!token || !itineraryResult) {
      Alert.alert("Nothing to save", "Generate a trip before saving it.");
      return;
    }

    const destination = itineraryResult.destination || "Generated trip";

    try {
      setIsSavingTrip(true);
      const savedTrip = await saveGeneratedTrip(
        token,
        `${destination} trip`,
        itineraryResult
      );
      setSavedTripId(savedTrip.id);
      Alert.alert("Trip saved", "You can find it in your library.");
    } catch (error) {
      Alert.alert("Could not save trip", getErrorMessage(error));
    } finally {
      setIsSavingTrip(false);
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
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          <View style={s.iconBadge}>
            <Text style={s.iconText}>✈️</Text>
          </View>
          <View style={s.headerContent}>
            <Text style={s.greeting}>Welcome back,</Text>
            <Text style={s.userName}>{user?.name || "Traveler"}</Text>
            <Text style={s.userEmail}>{user?.email}</Text>
          </View>
          <TouchableOpacity style={s.signOutButton} onPress={logout}>
            <Text style={s.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {errorMessage ? (
          <View style={[s.banner, s.errorBanner]}>
            <Text style={s.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {message ? (
          <View style={[s.banner, s.successBanner]}>
            <Text style={s.successText}>{message}</Text>
          </View>
        ) : null}

        <Section title="Travel Interests">
          <Text style={s.helperText}>
            These personalize generated itineraries.
          </Text>
          <View style={s.chipGrid}>
            {categories.map((category) => {
              const active = selectedInterestSet.has(category);
              return (
                <TouchableOpacity
                  key={category}
                  style={[s.chip, active ? s.chipActive : null]}
                  onPress={() => toggleInterest(category)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.chipText, active ? s.chipTextActive : null]}>
                    {formatInterest(category)}
                  </Text>
                  {descriptions[category] ? (
                    <Text
                      style={[
                        s.chipDescription,
                        active ? s.chipDescriptionActive : null,
                      ]}
                      numberOfLines={2}
                    >
                      {descriptions[category]}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
          <ActionButton
            title="Save Interests"
            onPress={handleSaveInterests}
            loading={interestLoading}
            disabled={!token}
          />
        </Section>

        <Section title="Generate Itinerary">
          <Field
            label="Destination"
            value={destination}
            onChangeText={setDestination}
            placeholder="Paris"
          />
          <Field
            label="Number of days"
            value={numDays}
            onChangeText={setNumDays}
            placeholder="3"
            keyboardType="numeric"
          />
          <ActionButton
            title="Generate Itinerary"
            onPress={handleGenerateItinerary}
            loading={itineraryLoading}
            disabled={!token}
          />

          {itinerary ? (
            <View style={s.resultBlock}>
              <Text style={s.resultTitle}>{itinerary.destination}</Text>
              {itinerary.days.map((day) => (
                <View key={day.day_number} style={s.dayBlock}>
                  <Text style={s.dayTitle}>Day {day.day_number}</Text>
                  {day.activities.map((activity, index) => (
                    <View key={`${day.day_number}-${index}`} style={s.activity}>
                      <Text style={s.activityTime}>{activity.time_slot}</Text>
                      <Text style={s.activityTitle}>{activity.title}</Text>
                      <Text style={s.activityDescription}>
                        {activity.description}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}

              <View style={s.saveForm}>
                <Field
                  label="Start date"
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="2026-06-01"
                />
                <Field
                  label="End date"
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="2026-06-03"
                />
                <Field
                  label="Summary"
                  value={summary}
                  onChangeText={setSummary}
                  placeholder="Short description for saved trips"
                  multiline
                />
                <ActionButton
                  title="Save Trip"
                  onPress={handleSaveTrip}
                  loading={saveLoading}
                />
              </View>
            </View>
          ) : null}
        </Section>

        <Section title="Optimize Budget">
          <Field
            label="Destination"
            value={budgetDestination}
            onChangeText={setBudgetDestination}
            placeholder={destination || "Rome"}
          />
          <Field
            label="Total budget in USD"
            value={budget}
            onChangeText={setBudget}
            placeholder="800"
            keyboardType="numeric"
          />
          <ActionButton
            title="Create Budget Plan"
            onPress={handleOptimizeBudget}
            loading={budgetLoading}
          />

          {budgetPlan ? (
            <View style={s.resultBlock}>
              <Text style={s.resultTitle}>
                {budgetPlan.destination} - ${budgetPlan.total_budget}
              </Text>
              {budgetPlan.recommendations.map((item, index) => (
                <View key={`${item.category}-${index}`} style={s.recommendation}>
                  <Text style={s.activityTitle}>
                    {formatInterest(item.category)}
                  </Text>
                  <Text style={s.activityDescription}>
                    {item.recommendation}
                  </Text>
                  <Text style={s.activityTime}>{item.estimated_cost}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Section>

        <Section title="Saved Trips">
          <ActionButton
            title="Refresh Trips"
            onPress={refreshTrips}
            loading={tripsLoading}
            tone="secondary"
          />

          {trips.length === 0 ? (
            <Text style={s.emptyText}>No saved trips yet.</Text>
          ) : (
            <View style={s.tripList}>
              {trips.map((trip) => (
                <TouchableOpacity
                  key={trip.id}
                  style={s.tripItem}
                  onPress={() => handleSelectTrip(trip.id)}
                  activeOpacity={0.8}
                >
                  <View style={s.tripItemHeader}>
                    <Text style={s.tripDestination}>{trip.destination}</Text>
                    <Text style={s.statusPill}>{trip.status}</Text>
                  </View>
                  <Text style={s.tripMeta}>
                    {trip.startDate} to {trip.endDate} · {tripDays(trip)} days
                  </Text>
                  <Text style={s.tripSummary}>{trip.summary}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedTrip ? (
            <View style={s.resultBlock}>
              <Text style={s.resultTitle}>{selectedTrip.destination}</Text>
              <Text style={s.tripMeta}>
                {selectedTrip.startDate} to {selectedTrip.endDate}
              </Text>
              {selectedTrip.itinerary.days.map((day) => (
                <View key={day.day_number} style={s.dayBlock}>
                  <Text style={s.dayTitle}>Day {day.day_number}</Text>
                  {day.activities.map((activity, index) => (
                    <Text
                      key={`${day.day_number}-${index}`}
                      style={s.savedActivity}
                    >
                      {activity.time_slot} - {activity.title}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.teal700,
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    color: C.slate50,
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  iconBadge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 30,
  },
  headerContent: {
    flex: 1,
  },
  libraryButton: {
    minWidth: 82,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  libraryButtonText: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
  },
  greeting: {
    color: C.teal100,
    fontSize: 13,
    fontWeight: "600",
  },
  userName: {
    color: C.white,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },
  userEmail: {
    color: C.teal100,
    fontSize: 12,
    marginTop: 2,
  },
  signOutButton: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  signOutText: {
    color: C.white,
    fontSize: 12,
    fontWeight: "700",
  },
  banner: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorBanner: {
    backgroundColor: C.red50,
  },
  successBanner: {
    backgroundColor: C.teal50,
  },
  errorText: {
    color: C.red500,
    fontSize: 13,
    fontWeight: "600",
  },
  successText: {
    color: C.teal700,
    fontSize: 13,
    fontWeight: "600",
  },
  card: {
    backgroundColor: C.slate50,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    color: C.slate900,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12,
  },
  helperText: {
    color: C.slate500,
    fontSize: 13,
    marginBottom: 12,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    color: C.slate500,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: C.white,
    borderColor: C.slate200,
    borderWidth: 1,
    borderRadius: 10,
    color: C.slate900,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 82,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: C.teal600,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonSecondary: {
    backgroundColor: C.teal50,
    borderColor: C.teal600,
    borderWidth: 1,
  },
  buttonDanger: {
    backgroundColor: C.red500,
  },
  buttonDisabled: {
    backgroundColor: C.slate200,
    borderWidth: 0,
  },
  buttonText: {
    color: C.white,
    fontSize: 14,
    fontWeight: "800",
  },
  buttonTextSecondary: {
    color: C.teal600,
  },
  buttonTextDisabled: {
    color: C.slate400,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    width: "48%",
    backgroundColor: C.white,
    borderColor: C.slate200,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    minHeight: 74,
  },
  chipActive: {
    backgroundColor: C.teal600,
    borderColor: C.teal600,
  },
  chipText: {
    color: C.slate900,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  chipTextActive: {
    color: C.white,
  },
  chipDescription: {
    color: C.slate500,
    fontSize: 11,
    lineHeight: 15,
  },
  chipDescriptionActive: {
    color: C.teal100,
  },
  resultBlock: {
    marginTop: 14,
    borderTopColor: C.slate200,
    borderTopWidth: 1,
    paddingTop: 14,
  },
  resultTitle: {
    color: C.slate900,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  dayBlock: {
    marginBottom: 12,
  },
  dayTitle: {
    color: C.teal700,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
  },
  activity: {
    backgroundColor: C.white,
    borderColor: C.slate200,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  activityTime: {
    color: C.teal600,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 3,
  },
  activityTitle: {
    color: C.slate900,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  activityDescription: {
    color: C.slate700,
    fontSize: 13,
    lineHeight: 18,
  },
  saveForm: {
    marginTop: 8,
  },
  recommendation: {
    backgroundColor: C.white,
    borderColor: C.slate200,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  emptyText: {
    color: C.slate500,
    fontSize: 13,
    marginTop: 12,
  },
  tripList: {
    marginTop: 12,
    gap: 10,
  },
  tripItem: {
    backgroundColor: C.white,
    borderColor: C.slate200,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  tripItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  tripDestination: {
    color: C.slate900,
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  statusPill: {
    color: C.teal700,
    backgroundColor: C.teal50,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
    fontSize: 11,
    fontWeight: "800",
  },
  tripMeta: {
    color: C.slate500,
    fontSize: 12,
    marginBottom: 5,
  },
  tripSummary: {
    color: C.slate700,
    fontSize: 13,
    lineHeight: 18,
  },
  savedActivity: {
    color: C.slate700,
    fontSize: 13,
    lineHeight: 20,
  },
});
