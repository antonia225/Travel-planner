import React, { useCallback, useEffect, useState } from "react";
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
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ShieldCheck,
  ShieldOff,
  UsersRound,
} from "lucide-react-native";

import AppCard from "../components/AppCard";
import PrimaryButton from "../components/PrimaryButton";
import SectionHeader from "../components/SectionHeader";
import { useAuth } from "../context/AuthContext";
import {
  canAccessAdmin,
  listAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "../services/api";
import type { AdminUser, UserRole } from "../services/api";
import { colors, radius, shadows, spacing } from "../theme/designSystem";

type Props = {
  navigation: {
    goBack: () => void;
    navigate: (screen: string) => void;
  };
};

const ROLE_OPTIONS: UserRole[] = ["user", "admin", "super_admin"];

function formatRole(role: UserRole) {
  return role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function AdminDashboardScreen({ navigation }: Props) {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    if (!token || !canAccessAdmin(user)) {
      setUsers([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      setUsers(await listAdminUsers(token));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleToggleStatus = async (targetUser: AdminUser) => {
    if (!token) {
      return;
    }

    try {
      setUpdatingUserId(targetUser.id);
      const updatedUser = await updateAdminUserStatus(
        token,
        targetUser.id,
        !targetUser.is_active
      );
      setUsers((current) =>
        current.map((item) => (item.id === updatedUser.id ? updatedUser : item))
      );
    } catch (error) {
      Alert.alert("Could not update account", getErrorMessage(error));
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRoleChange = async (targetUser: AdminUser, role: UserRole) => {
    if (!token || targetUser.role === role) {
      return;
    }

    try {
      setUpdatingUserId(targetUser.id);
      const updatedUser = await updateAdminUserRole(token, targetUser.id, role);
      setUsers((current) =>
        current.map((item) => (item.id === updatedUser.id ? updatedUser : item))
      );
    } catch (error) {
      Alert.alert("Could not update role", getErrorMessage(error));
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (!canAccessAdmin(user)) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.root}>
        <View style={styles.centeredState}>
          <ShieldOff color={colors.white} size={34} strokeWidth={2.3} />
          <Text style={styles.centeredTitle}>Access restricted</Text>
          <Text style={styles.centeredText}>
            Your account does not have admin permissions.
          </Text>
          <PrimaryButton
            title="Back"
            variant="secondary"
            onPress={navigation.goBack}
            style={styles.centeredButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.8}
          onPress={navigation.goBack}
        >
          <ArrowLeft color={colors.white} size={22} strokeWidth={2.4} />
        </TouchableOpacity>

        <View style={styles.headerCopy}>
          <Text style={styles.headerKicker}>Admin dashboard</Text>
          <Text style={styles.headerTitle}>Users</Text>
        </View>

        <View style={styles.headerBadge}>
          <UsersRound color={colors.white} size={22} strokeWidth={2.3} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{users.length}</Text>
            <Text style={styles.summaryLabel}>Accounts</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {users.filter((item) => item.is_active).length}
            </Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {users.filter((item) => item.role !== "user").length}
            </Text>
            <Text style={styles.summaryLabel}>Admins</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.statsLink}
          activeOpacity={0.82}
          onPress={() => navigation.navigate("AdminStats")}
        >
          <View style={styles.statsLinkIcon}>
            <BarChart3 color={colors.teal700} size={22} strokeWidth={2.4} />
          </View>
          <View style={styles.statsLinkCopy}>
            <Text style={styles.statsLinkTitle}>AI Agent Performance</Text>
            <Text style={styles.statsLinkText}>
              Model timing, failed generations, and backend health
            </Text>
          </View>
        </TouchableOpacity>

        <AppCard elevated>
          <SectionHeader
            eyebrow="Permissions"
            title="User accounts"
            action={
              isLoading ? (
                <ActivityIndicator size="small" color={colors.teal600} />
              ) : (
                <TouchableOpacity
                  style={styles.refreshButton}
                  activeOpacity={0.8}
                  onPress={loadUsers}
                >
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </TouchableOpacity>
              )
            }
          />

          {errorMessage ? (
            <View style={styles.errorPanel}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {users.map((account) => {
            const isUpdating = updatingUserId === account.id;
            const isCurrentUser = account.id === user?.id;
            const canChangeRole = user?.role === "super_admin";

            return (
              <View key={account.id} style={styles.userRow}>
                <View style={styles.userHeader}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>
                      {account.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userCopy}>
                    <Text style={styles.userName}>{account.name}</Text>
                    <Text style={styles.userEmail}>{account.email}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      account.is_active
                        ? styles.statusBadgeActive
                        : styles.statusBadgeInactive,
                    ]}
                  >
                    {account.is_active ? (
                      <CheckCircle2
                        color={colors.teal700}
                        size={14}
                        strokeWidth={2.4}
                      />
                    ) : (
                      <ShieldOff
                        color={colors.red700}
                        size={14}
                        strokeWidth={2.4}
                      />
                    )}
                    <Text
                      style={[
                        styles.statusBadgeText,
                        account.is_active
                          ? styles.statusBadgeTextActive
                          : styles.statusBadgeTextInactive,
                      ]}
                    >
                      {account.is_active ? "Active" : "Disabled"}
                    </Text>
                  </View>
                </View>

                <View style={styles.roleRow}>
                  {ROLE_OPTIONS.map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleChip,
                        account.role === role ? styles.roleChipSelected : null,
                        !canChangeRole ? styles.roleChipDisabled : null,
                      ]}
                      activeOpacity={0.8}
                      disabled={!canChangeRole || isUpdating}
                      onPress={() => handleRoleChange(account, role)}
                    >
                      <Text
                        style={[
                          styles.roleChipText,
                          account.role === role
                            ? styles.roleChipTextSelected
                            : null,
                        ]}
                      >
                        {formatRole(role)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <PrimaryButton
                  title={account.is_active ? "Deactivate" : "Activate"}
                  variant={account.is_active ? "destructive" : "secondary"}
                  loading={isUpdating}
                  disabled={isUpdating || isCurrentUser}
                  icon={
                    account.is_active ? (
                      <ShieldOff
                        color={colors.white}
                        size={17}
                        strokeWidth={2.4}
                      />
                    ) : (
                      <ShieldCheck
                        color={colors.teal700}
                        size={17}
                        strokeWidth={2.4}
                      />
                    )
                  }
                  onPress={() => handleToggleStatus(account)}
                />
              </View>
            );
          })}

          {!isLoading && users.length === 0 ? (
            <Text style={styles.emptyText}>No users found.</Text>
          ) : null}
        </AppCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.slate900,
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
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.22)",
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
    color: colors.slate300,
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
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
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
  summaryGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
  summaryCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.slate100,
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    minHeight: 82,
    justifyContent: "center",
    ...shadows.soft,
  },
  summaryValue: {
    color: colors.slate900,
    fontSize: 22,
    fontWeight: "800",
  },
  summaryLabel: {
    color: colors.slate500,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
    textTransform: "uppercase",
  },
  statsLink: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.teal200,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    ...shadows.soft,
  },
  statsLinkIcon: {
    alignItems: "center",
    backgroundColor: colors.teal50,
    borderRadius: radius.lg,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  statsLinkCopy: {
    flex: 1,
  },
  statsLinkTitle: {
    color: colors.slate900,
    fontSize: 15,
    fontWeight: "800",
  },
  statsLinkText: {
    color: colors.slate500,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 2,
  },
  refreshButton: {
    backgroundColor: colors.teal50,
    borderColor: colors.teal200,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  refreshButtonText: {
    color: colors.teal700,
    fontSize: 13,
    fontWeight: "800",
  },
  errorPanel: {
    backgroundColor: colors.red50,
    borderColor: colors.redBorder,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  errorText: {
    color: colors.red700,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  userRow: {
    borderColor: colors.slate100,
    borderTopWidth: 1,
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  userHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  userAvatar: {
    alignItems: "center",
    backgroundColor: colors.slate900,
    borderRadius: 18,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  userAvatarText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  userCopy: {
    flex: 1,
  },
  userName: {
    color: colors.slate900,
    fontSize: 15,
    fontWeight: "800",
  },
  userEmail: {
    color: colors.slate500,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 2,
  },
  statusBadge: {
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusBadgeActive: {
    backgroundColor: colors.teal50,
    borderColor: colors.teal200,
  },
  statusBadgeInactive: {
    backgroundColor: colors.red50,
    borderColor: colors.redBorder,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  statusBadgeTextActive: {
    color: colors.teal700,
  },
  statusBadgeTextInactive: {
    color: colors.red700,
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  roleChip: {
    backgroundColor: colors.white,
    borderColor: colors.slate200,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  roleChipSelected: {
    backgroundColor: colors.teal50,
    borderColor: colors.teal600,
  },
  roleChipDisabled: {
    opacity: 0.7,
  },
  roleChipText: {
    color: colors.slate600,
    fontSize: 12,
    fontWeight: "800",
  },
  roleChipTextSelected: {
    color: colors.teal700,
  },
  emptyText: {
    color: colors.slate500,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  centeredState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: spacing.xxl,
  },
  centeredTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "800",
    marginTop: spacing.lg,
    textAlign: "center",
  },
  centeredText: {
    color: colors.slate300,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  centeredButton: {
    marginTop: spacing.xl,
  },
});
