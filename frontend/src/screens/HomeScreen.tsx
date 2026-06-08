import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import TripSearchForm from "../components/TripSearchForm";
import {
  BASE_URL,
  listInterestCategories,
  saveGeneratedTrip,
} from "../services/api";
import { allRulesMet, checkPassword } from "../utils/validation";

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

type InterestCategoryOption = {
  value: string;
  description: string;
};

type Props = {
  navigation: {
    navigate: (screen: string) => void;
  };
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

function formatInterestLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

export default function HomeScreen({ navigation }: Props) {
  const {
    user,
    token,
    logout,
    isLoading,
    changeUserPassword,
    updateUserInterests,
    updateUserProfile,
  } = useAuth();

  const [isGeneratingTrip, setIsGeneratingTrip] = useState(false);
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isLoadingInterests, setIsLoadingInterests] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [savedTripId, setSavedTripId] = useState<number | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [interestOptions, setInterestOptions] = useState<
    InterestCategoryOption[]
  >([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [itineraryResult, setItineraryResult] = useState<ItineraryResult | null>(
    null
  );
  const [tripError, setTripError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditingProfile) {
      setProfileName(user?.name ?? "");
      setProfileEmail(user?.email ?? "");
      setSelectedInterests(user?.interests ?? []);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [isEditingProfile, user]);

  useEffect(() => {
    let isMounted = true;

    const loadInterestOptions = async () => {
      try {
        setIsLoadingInterests(true);
        setProfileError(null);

        const data = await listInterestCategories();
        if (!isMounted) {
          return;
        }

        setInterestOptions(
          data.categories.map((category) => ({
            value: category,
            description:
              data.descriptions[category] ?? formatInterestLabel(category),
          }))
        );
      } catch (error) {
        if (isMounted) {
          setProfileError(getErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoadingInterests(false);
        }
      }
    };

    loadInterestOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
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

  const toggleInterest = (interest: string) => {
    setSelectedInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest]
    );
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
          <TouchableOpacity
            style={s.libraryButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Library")}
          >
            <Text style={s.libraryButtonText}>Library</Text>
          </TouchableOpacity>
        </View>

        {/* ── User Info Card ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={[s.cardTitle, s.cardTitleInline]}>
              Account Details
            </Text>
            {isEditingProfile ? (
              <TouchableOpacity
                style={s.editProfileButton}
                activeOpacity={0.8}
                onPress={handleCancelProfileEdit}
              >
                <Text style={s.editProfileButtonText}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={s.editProfileButton}
                activeOpacity={0.8}
                onPress={handleEditProfile}
              >
                <Text style={s.editProfileButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditingProfile ? (
            <View style={s.profileForm}>
              <View style={s.profileField}>
                <Text style={s.infoLabel}>Name</Text>
                <TextInput
                  style={s.profileInput}
                  value={profileName}
                  onChangeText={setProfileName}
                  placeholder="Your name"
                  placeholderTextColor={C.slate400}
                  autoCapitalize="words"
                />
              </View>

              <View style={s.profileField}>
                <Text style={s.infoLabel}>Email</Text>
                <TextInput
                  style={s.profileInput}
                  value={profileEmail}
                  onChangeText={setProfileEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={C.slate400}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={s.passwordSection}>
                <Text style={s.infoLabel}>Change Password</Text>
                <Text style={s.passwordHint}>
                  Leave these fields empty to keep your current password.
                </Text>

                <TextInput
                  style={s.profileInput}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Current password"
                  placeholderTextColor={C.slate400}
                  secureTextEntry
                  autoCapitalize="none"
                />

                <TextInput
                  style={s.profileInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="New password"
                  placeholderTextColor={C.slate400}
                  secureTextEntry
                  autoCapitalize="none"
                />

                <TextInput
                  style={s.profileInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={C.slate400}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </View>
          ) : (
            <>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Name</Text>
                <Text style={s.infoValue}>{user?.name}</Text>
              </View>

              <View style={s.divider} />

              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Email</Text>
                <Text style={s.infoValue}>{user?.email}</Text>
              </View>
            </>
          )}

          <View style={s.divider} />

          <View style={s.infoRow}>
            <Text style={s.infoLabel}>User ID</Text>
            <Text style={[s.infoValue, s.infoValueMuted]}>{user?.id}</Text>
          </View>

          <View style={s.divider} />

          <View style={s.profileSection}>
            <View style={s.profileSectionHeader}>
              <Text style={s.infoLabel}>Travel Interests</Text>
              {isLoadingInterests ? (
                <ActivityIndicator size="small" color={C.teal600} />
              ) : null}
            </View>

            {profileError ? (
              <Text style={s.profileErrorText}>{profileError}</Text>
            ) : null}

            {isEditingProfile ? (
              <>
                <View style={s.interestsGrid}>
                  {interestOptions.length > 0 ? (
                    interestOptions.map((interest) => {
                      const isSelected = selectedInterests.includes(
                        interest.value
                      );

                      return (
                        <TouchableOpacity
                          key={interest.value}
                          style={[
                            s.interestChip,
                            isSelected ? s.interestChipSelected : null,
                          ]}
                          accessibilityLabel={interest.description}
                          activeOpacity={0.8}
                          disabled={isSavingProfile}
                          onPress={() => toggleInterest(interest.value)}
                        >
                          <Text
                            style={[
                              s.interestChipText,
                              isSelected ? s.interestChipTextSelected : null,
                            ]}
                          >
                            {formatInterestLabel(interest.value)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={s.emptyInterestsText}>
                      No interest categories available.
                    </Text>
                  )}
                </View>

                <View style={s.profileActions}>
                  <TouchableOpacity
                    style={s.profileSecondaryButton}
                    activeOpacity={0.8}
                    disabled={isSavingProfile}
                    onPress={handleCancelProfileEdit}
                  >
                    <Text style={s.profileSecondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      s.profileSaveButton,
                      isSavingProfile ? s.profileButtonDisabled : null,
                    ]}
                    activeOpacity={0.8}
                    disabled={isSavingProfile}
                    onPress={handleSaveProfile}
                  >
                    <Text style={s.profileSaveButtonText}>
                      {isSavingProfile ? "Saving..." : "Save"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={s.interestsGrid}>
                {user?.interests.length ? (
                  user.interests.map((interest) => (
                    <View
                      key={interest}
                      style={[s.interestChip, s.interestChipSelected]}
                    >
                      <Text style={s.interestChipTextSelected}>
                        {formatInterestLabel(interest)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={s.emptyInterestsText}>
                    No interests selected.
                  </Text>
                )}
              </View>
            )}
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
          </View>
        ) : null}

        {/* ── AI Result ── */}
        {itineraryResult ? (
          <View style={s.resultCard}>
            <View style={s.resultHeader}>
              <Text style={[s.cardTitle, s.resultTitle]}>
                AI Itinerary for {itineraryResult.destination || "your trip"}
              </Text>
              <TouchableOpacity
                style={[
                  s.saveTripButton,
                  (isSavingTrip || !!savedTripId) && s.saveTripButtonDisabled,
                ]}
                activeOpacity={0.8}
                disabled={isSavingTrip || !!savedTripId}
                onPress={handleSaveGeneratedTrip}
              >
                <Text
                  style={[
                    s.saveTripButtonText,
                    (isSavingTrip || !!savedTripId) &&
                      s.saveTripButtonTextDisabled,
                  ]}
                >
                  {savedTripId ? "Saved" : isSavingTrip ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>

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
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cardTitleInline: {
    flex: 1,
    marginBottom: 0,
  },
  editProfileButton: {
    minWidth: 104,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.teal50,
    borderWidth: 1,
    borderColor: C.teal200,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  editProfileButtonText: {
    color: C.teal700,
    fontSize: 13,
    fontWeight: "800",
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
  profileForm: {
    gap: 14,
    paddingBottom: 16,
  },
  profileField: {
    gap: 8,
  },
  profileInput: {
    width: "100%",
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.slate200,
    backgroundColor: C.white,
    color: C.slate900,
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  passwordSection: {
    gap: 8,
    borderRadius: 14,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.slate200,
    padding: 14,
  },
  passwordHint: {
    color: C.slate500,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  profileSection: {
    paddingTop: 16,
  },
  profileSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  profileErrorText: {
    color: C.red500,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 12,
  },
  interestsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  interestChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.slate200,
    backgroundColor: C.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  interestChipSelected: {
    borderColor: C.teal600,
    backgroundColor: C.teal50,
  },
  interestChipText: {
    color: C.slate700,
    fontSize: 12,
    fontWeight: "700",
  },
  interestChipTextSelected: {
    color: C.teal700,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyInterestsText: {
    color: C.slate500,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  profileActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  profileSecondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.slate100,
    alignItems: "center",
    justifyContent: "center",
  },
  profileSecondaryButtonText: {
    color: C.slate500,
    fontSize: 13,
    fontWeight: "800",
  },
  profileSaveButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.teal600,
    alignItems: "center",
    justifyContent: "center",
  },
  profileButtonDisabled: {
    backgroundColor: C.slate200,
  },
  profileSaveButtonText: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
  },

  // Result Card
  resultCard: {
    backgroundColor: C.slate50,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  resultTitle: {
    flex: 1,
    marginBottom: 0,
  },
  saveTripButton: {
    minWidth: 74,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.teal600,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  saveTripButtonDisabled: {
    backgroundColor: C.slate200,
  },
  saveTripButtonText: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
  },
  saveTripButtonTextDisabled: {
    color: C.slate500,
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
