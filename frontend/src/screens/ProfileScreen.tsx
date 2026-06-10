import React, { useEffect, useState } from "react";
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
  ArrowLeft,
  Hash,
  Heart,
  LogOut,
  Mail,
  PenLine,
  Save,
  Shield,
  Sparkles,
  UserRound,
  X,
} from "lucide-react-native";

import AppCard from "../components/AppCard";
import CustomInput from "../components/CustomInput";
import PrimaryButton from "../components/PrimaryButton";
import SectionHeader from "../components/SectionHeader";
import { useAuth } from "../context/AuthContext";
import { listInterestCategories } from "../services/api";
import { allRulesMet, checkPassword } from "../utils/validation";
import { colors, radius, shadows, spacing } from "../theme/designSystem";

type InterestCategoryOption = {
  value: string;
  description: string;
};

type Props = {
  navigation: {
    goBack: () => void;
  };
};

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

function getInitials(name?: string) {
  const words = (name || "Traveler")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export default function ProfileScreen({ navigation }: Props) {
  const {
    user,
    logout,
    changeUserPassword,
    updateUserInterests,
    updateUserProfile,
  } = useAuth();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isLoadingInterests, setIsLoadingInterests] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [interestOptions, setInterestOptions] = useState<
    InterestCategoryOption[]
  >([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
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

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.8}
          onPress={navigation.goBack}
        >
          <ArrowLeft color={colors.white} size={22} strokeWidth={2.4} />
        </TouchableOpacity>

        <View style={styles.headerCopy}>
          <Text style={styles.headerKicker}>Traveler profile</Text>
          <Text style={styles.headerTitle}>Account</Text>
        </View>

        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{getInitials(user?.name)}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryName}>{user?.name || "Traveler"}</Text>
            <Text style={styles.summaryEmail}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.profileStats}>
          <View style={[styles.profileStat, styles.profileStatTeal]}>
            <Heart color={colors.teal700} size={18} strokeWidth={2.4} />
            <Text style={styles.profileStatValue}>
              {user?.interests.length || 0}
            </Text>
            <Text style={styles.profileStatLabel}>Interests</Text>
          </View>
          <View style={[styles.profileStat, styles.profileStatSky]}>
            <Sparkles color={colors.sky600} size={18} strokeWidth={2.4} />
            <Text style={styles.profileStatValue}>AI</Text>
            <Text style={styles.profileStatLabel}>Ready</Text>
          </View>
          <View style={[styles.profileStat, styles.profileStatAmber]}>
            <Shield color={colors.amber600} size={18} strokeWidth={2.4} />
            <Text style={styles.profileStatValue}>Secure</Text>
            <Text style={styles.profileStatLabel}>Account</Text>
          </View>
        </View>

        <AppCard elevated>
          <SectionHeader
            eyebrow="Profile"
            title="Account details"
            action={
              isEditingProfile ? (
                <TouchableOpacity
                  style={styles.smallActionButton}
                  activeOpacity={0.8}
                  onPress={handleCancelProfileEdit}
                >
                  <X color={colors.teal700} size={16} strokeWidth={2.4} />
                  <Text style={styles.smallActionButtonText}>Cancel</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.smallActionButton}
                  activeOpacity={0.8}
                  onPress={handleEditProfile}
                >
                  <PenLine color={colors.teal700} size={16} strokeWidth={2.4} />
                  <Text style={styles.smallActionButtonText}>Edit</Text>
                </TouchableOpacity>
              )
            }
          />

          {isEditingProfile ? (
            <View style={styles.profileForm}>
              <CustomInput
                label="Name"
                value={profileName}
                onChangeText={setProfileName}
                placeholder="Your name"
                autoCapitalize="words"
              />

              <CustomInput
                label="Email"
                value={profileEmail}
                onChangeText={setProfileEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.passwordPanel}>
                <View style={styles.passwordPanelHeader}>
                  <Shield color={colors.teal700} size={18} strokeWidth={2.3} />
                  <Text style={styles.passwordPanelTitle}>Change Password</Text>
                </View>
                <Text style={styles.passwordHint}>
                  Leave these fields empty to keep your current password.
                </Text>

                <CustomInput
                  label="Current Password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Current password"
                  secureTextEntry
                  autoCapitalize="none"
                />

                <CustomInput
                  label="New Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="New password"
                  secureTextEntry
                  autoCapitalize="none"
                />

                <CustomInput
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.infoRow}>
                <View style={styles.infoLabelWrap}>
                  <UserRound color={colors.slate500} size={17} strokeWidth={2.3} />
                  <Text style={styles.infoLabel}>Name</Text>
                </View>
                <Text style={styles.infoValue}>{user?.name}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <View style={styles.infoLabelWrap}>
                  <Mail color={colors.slate500} size={17} strokeWidth={2.3} />
                  <Text style={styles.infoLabel}>Email</Text>
                </View>
                <Text style={styles.infoValue}>{user?.email}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <View style={styles.infoLabelWrap}>
                  <Hash color={colors.slate500} size={17} strokeWidth={2.3} />
                  <Text style={styles.infoLabel}>User ID</Text>
                </View>
                <Text style={[styles.infoValue, styles.infoValueMuted]}>
                  {user?.id}
                </Text>
              </View>
            </>
          )}
        </AppCard>

        <AppCard elevated>
          <SectionHeader
            eyebrow="Personalization"
            title="Travel interests"
            action={
              isLoadingInterests ? (
                <ActivityIndicator size="small" color={colors.teal600} />
              ) : null
            }
          />

          {profileError ? (
            <View style={styles.inlineError}>
              <AlertCircle color={colors.red500} size={16} strokeWidth={2.4} />
              <Text style={styles.profileErrorText}>{profileError}</Text>
            </View>
          ) : null}

          {isEditingProfile ? (
            <View style={styles.interestsGrid}>
              {interestOptions.length > 0 ? (
                interestOptions.map((interest) => {
                  const isSelected = selectedInterests.includes(interest.value);

                  return (
                    <TouchableOpacity
                      key={interest.value}
                      style={[
                        styles.interestChip,
                        isSelected ? styles.interestChipSelected : null,
                      ]}
                      accessibilityLabel={interest.description}
                      activeOpacity={0.8}
                      disabled={isSavingProfile}
                      onPress={() => toggleInterest(interest.value)}
                    >
                      <Text
                        style={[
                          styles.interestChipText,
                          isSelected ? styles.interestChipTextSelected : null,
                        ]}
                      >
                        {formatInterestLabel(interest.value)}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.emptyInterestsText}>
                  No interest categories available.
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.interestsGrid}>
              {user?.interests.length ? (
                user.interests.map((interest) => (
                  <View
                    key={interest}
                    style={[styles.interestChip, styles.interestChipSelected]}
                  >
                    <Text style={styles.interestChipTextSelected}>
                      {formatInterestLabel(interest)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyInterestsText}>
                  No interests selected.
                </Text>
              )}
            </View>
          )}
        </AppCard>

        {isEditingProfile ? (
          <View style={styles.profileActions}>
            <PrimaryButton
              title="Cancel"
              variant="secondary"
              disabled={isSavingProfile}
              onPress={handleCancelProfileEdit}
              style={styles.profileActionButton}
            />

            <PrimaryButton
              title="Save"
              loading={isSavingProfile}
              disabled={isSavingProfile}
              icon={<Save color={colors.white} size={17} strokeWidth={2.4} />}
              onPress={handleSaveProfile}
              style={styles.profileActionButton}
            />
          </View>
        ) : null}

        <PrimaryButton
          title="Sign Out"
          variant="destructive"
          icon={<LogOut color={colors.white} size={18} strokeWidth={2.4} />}
          onPress={handleLogout}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.teal700,
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: 20,
    paddingTop: spacing.lg,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  headerCopy: {
    flex: 1,
  },
  headerKicker: {
    color: colors.teal100,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 3,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34,
  },
  headerBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    minWidth: 44,
    paddingHorizontal: spacing.md,
  },
  headerBadgeText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  scroll: {
    backgroundColor: colors.slate50,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    flex: 1,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: 42,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  summaryCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.slate100,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.xl,
    ...shadows.soft,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.teal600,
    borderRadius: 22,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  avatarText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800",
  },
  summaryCopy: {
    flex: 1,
  },
  summaryName: {
    color: colors.slate900,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  summaryEmail: {
    color: colors.slate500,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: 3,
  },
  profileStats: {
    flexDirection: "row",
    gap: spacing.md,
  },
  profileStat: {
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    minHeight: 96,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  profileStatTeal: {
    backgroundColor: colors.teal50,
    borderColor: colors.teal200,
  },
  profileStatSky: {
    backgroundColor: colors.sky50,
    borderColor: "#bae6fd",
  },
  profileStatAmber: {
    backgroundColor: colors.amber50,
    borderColor: "#fde68a",
  },
  profileStatValue: {
    color: colors.slate900,
    fontSize: 16,
    fontWeight: "800",
    marginTop: spacing.sm,
    textAlign: "center",
  },
  profileStatLabel: {
    color: colors.slate500,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
    textAlign: "center",
    textTransform: "uppercase",
  },
  smallActionButton: {
    alignItems: "center",
    backgroundColor: colors.teal50,
    borderColor: colors.teal200,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  smallActionButtonText: {
    color: colors.teal700,
    fontSize: 13,
    fontWeight: "800",
  },
  profileForm: {
    gap: spacing.lg,
  },
  passwordPanel: {
    backgroundColor: colors.slate50,
    borderColor: colors.slate100,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  passwordPanelHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  passwordPanelTitle: {
    color: colors.slate900,
    fontSize: 15,
    fontWeight: "800",
  },
  passwordHint: {
    color: colors.slate500,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  infoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  infoLabelWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  infoLabel: {
    color: colors.slate500,
    fontSize: 13,
    fontWeight: "700",
  },
  infoValue: {
    color: colors.slate900,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  infoValueMuted: {
    color: colors.slate400,
    fontFamily: "monospace",
    fontSize: 12,
  },
  divider: {
    backgroundColor: colors.slate200,
    height: 1,
  },
  inlineError: {
    alignItems: "flex-start",
    backgroundColor: colors.red50,
    borderColor: colors.redBorder,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  profileErrorText: {
    color: colors.red700,
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  interestsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  interestChip: {
    backgroundColor: colors.white,
    borderColor: colors.slate200,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  interestChipSelected: {
    backgroundColor: colors.teal50,
    borderColor: colors.teal600,
  },
  interestChipText: {
    color: colors.slate700,
    fontSize: 12,
    fontWeight: "700",
  },
  interestChipTextSelected: {
    color: colors.teal700,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyInterestsText: {
    color: colors.slate500,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  profileActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  profileActionButton: {
    flex: 1,
  },
});
