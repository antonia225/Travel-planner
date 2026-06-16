import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Download,
  Edit3,
  Eye,
  FolderOpen,
  MapPin,
  Trash2,
  X,
} from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import AppCard from "../components/AppCard";
import CustomInput from "../components/CustomInput";
import ItineraryBudgetSummary from "../components/ItineraryBudgetSummary";
import ItineraryTimeline from "../components/ItineraryTimeline";
import PrimaryButton from "../components/PrimaryButton";
import SectionHeader from "../components/SectionHeader";
import { useAuth } from "../context/AuthContext";
import {
  deleteSavedTrip,
  listSavedTrips,
  renameSavedTrip,
} from "../services/api";
import type { BudgetOptimizerResponse, SavedTrip } from "../services/api";
import { colors, radius, shadows, spacing, typography } from "../theme/designSystem";
import { getVisibleBudgetOptimizationSavings } from "../utils/budgetOptimization";
import {
  buildSavedTripPdfHtml,
  getSavedTripPdfFileName,
} from "../utils/savedTripPdf";

type Props = {
  navigation: {
    goBack: () => void;
  };
};

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatTripDate(value?: string | null) {
  if (!value) {
    return null;
  }

  return parseLocalDate(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getTripDestination(trip: SavedTrip) {
  return trip.trip_data.destination || "Generated trip";
}

export function getTripDateRange(trip: SavedTrip) {
  const startDate = formatTripDate(
    typeof trip.trip_data.start_date === "string" ? trip.trip_data.start_date : null
  );
  const endDate = formatTripDate(
    typeof trip.trip_data.end_date === "string" ? trip.trip_data.end_date : null
  );

  if (startDate && endDate && startDate !== endDate) {
    return `${startDate} - ${endDate}`;
  }

  return startDate ?? endDate;
}

function countDaysFromDates(trip: SavedTrip) {
  const startDate =
    typeof trip.trip_data.start_date === "string"
      ? parseLocalDate(trip.trip_data.start_date)
      : null;
  const endDate =
    typeof trip.trip_data.end_date === "string"
      ? parseLocalDate(trip.trip_data.end_date)
      : null;

  if (!startDate || !endDate) {
    return null;
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return days > 0 ? days : null;
}

export function getTripDurationLabel(trip: SavedTrip) {
  const days = Array.isArray(trip.trip_data.days)
    ? trip.trip_data.days.length
    : countDaysFromDates(trip);

  if (!days) {
    return "Unknown duration";
  }

  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function getTripDisplayTitle(trip: SavedTrip) {
  return trip.name;
}

function sumTripActivityCosts(trip: SavedTrip | null) {
  return (trip?.trip_data.days ?? []).reduce(
    (total, day) =>
      total +
      (day.activities ?? []).reduce(
        (dayTotal, activity) => dayTotal + (activity.estimated_cost_eur ?? 0),
        0
      ),
    0
  );
}

function getTripTotalCost(trip: SavedTrip | null) {
  return typeof trip?.trip_data.total_estimated_cost_eur === "number"
    ? trip.trip_data.total_estimated_cost_eur
    : sumTripActivityCosts(trip);
}

function getTripBudget(trip: SavedTrip | null) {
  return typeof trip?.trip_data.budget_eur === "number"
    ? trip.trip_data.budget_eur
    : null;
}

function getTripBudgetOptimization(
  trip: SavedTrip | null
): BudgetOptimizerResponse | null {
  return trip?.trip_data.budget_optimization ?? null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LibraryScreen({ navigation }: Props) {
  const { token, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<SavedTrip | null>(null);
  const [tripToRename, setTripToRename] = useState<SavedTrip | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const loadSavedTrips = useCallback(
    async (refreshing = false) => {
      if (!token) {
        return;
      }

      try {
        refreshing ? setIsRefreshing(true) : setIsLoading(true);
        const trips = await listSavedTrips(token);
        setSavedTrips(trips);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Something went wrong.";
        if (message.toLowerCase().includes("token")) {
          await logout();
          return;
        }

        Alert.alert("Could not load library", message);
      } finally {
        refreshing ? setIsRefreshing(false) : setIsLoading(false);
      }
    },
    [logout, token]
  );

  useEffect(() => {
    loadSavedTrips();
  }, [loadSavedTrips]);

  useFocusEffect(
    useCallback(() => {
      loadSavedTrips();
    }, [loadSavedTrips])
  );

  const openRename = (trip: SavedTrip) => {
    setTripToRename(trip);
    setRenameValue(trip.name);
  };

  const submitRename = async () => {
    if (!token || !tripToRename) {
      return;
    }

    const cleanedName = renameValue.trim();
    if (!cleanedName) {
      Alert.alert("Trip name required", "Enter a name before saving.");
      return;
    }

    try {
      setIsRenaming(true);
      const renamed = await renameSavedTrip(token, tripToRename.id, cleanedName);
      setSavedTrips((trips) =>
        trips.map((trip) => (trip.id === renamed.id ? renamed : trip))
      );
      setSelectedTrip((trip) => (trip?.id === renamed.id ? renamed : trip));
      setTripToRename(null);
      setRenameValue("");
    } catch (error) {
      Alert.alert(
        "Could not rename trip",
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setIsRenaming(false);
    }
  };

  const confirmDelete = (trip: SavedTrip) => {
    Alert.alert(
      "Delete saved trip?",
      `"${getTripDisplayTitle(trip)}" will be removed from your library.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!token) {
              return;
            }

            try {
              await deleteSavedTrip(token, trip.id);
              setSavedTrips((trips) =>
                trips.filter((item) => item.id !== trip.id)
              );
              setSelectedTrip((selected) =>
                selected?.id === trip.id ? null : selected
              );
            } catch (error) {
              Alert.alert(
                "Could not delete trip",
                error instanceof Error ? error.message : "Something went wrong."
              );
            }
          },
        },
      ]
    );
  };

  const savePdfToDevice = async (uri: string, fileName: string) => {
    const storageAccess = FileSystem.StorageAccessFramework;
    if (!storageAccess) {
      return false;
    }

    try {
      const permissions = await storageAccess.requestDirectoryPermissionsAsync();
      if (!permissions.granted) {
        return false;
      }

      const pdfBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const savedUri = await storageAccess.createFileAsync(
        permissions.directoryUri,
        fileName,
        "application/pdf"
      );

      await FileSystem.writeAsStringAsync(savedUri, pdfBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return true;
    } catch {
      return false;
    }
  };

  const downloadSelectedTripPdf = async () => {
    if (!selectedTrip || isExportingPdf) {
      return;
    }

    try {
      setIsExportingPdf(true);
      const html = buildSavedTripPdfHtml(selectedTrip);
      const fileName = getSavedTripPdfFileName(selectedTrip);
      const { uri } = await Print.printToFileAsync({ html });

      if (await savePdfToDevice(uri, fileName)) {
        Alert.alert("PDF downloaded", "Your itinerary PDF was saved.");
        return;
      }

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "PDF created",
          `Your itinerary PDF was created, but direct saving and sharing are not available on this device. File: ${fileName}`
        );
        return;
      }

      await Sharing.shareAsync(uri, {
        dialogTitle: fileName,
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
      });
    } catch (error) {
      Alert.alert(
        "Could not export PDF",
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.8}
          onPress={navigation.goBack}
        >
          <ArrowLeft color={colors.slate700} size={22} strokeWidth={2.4} />
        </TouchableOpacity>

        <View style={styles.headerCopy}>
          <Text style={styles.headerKicker}>User library</Text>
          <Text style={styles.headerTitle}>Saved trips</Text>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countText}>{savedTrips.length}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadSavedTrips(true)}
            tintColor={colors.white}
          />
        }
      >
        {isLoading ? (
          <AppCard elevated style={styles.feedbackCard}>
            <ActivityIndicator color={colors.teal600} />
            <Text style={styles.feedbackText}>Loading saved trips...</Text>
          </AppCard>
        ) : null}

        {!isLoading && savedTrips.length === 0 ? (
          <AppCard elevated style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <FolderOpen color={colors.teal700} size={24} strokeWidth={2.2} />
            </View>
            <Text style={styles.emptyTitle}>No saved trips yet</Text>
            <Text style={styles.emptyText}>
              Generate an itinerary from Home and save it to see it here.
            </Text>
          </AppCard>
        ) : null}

        {savedTrips.map((trip) => (
          <AppCard key={trip.id} elevated style={styles.tripCard}>
            <View style={styles.tripHeader}>
              <View style={styles.tripIcon}>
                <MapPin color={colors.teal700} size={20} strokeWidth={2.4} />
              </View>
              <View style={styles.tripCopy}>
                <Text style={styles.tripName}>{getTripDisplayTitle(trip)}</Text>
                <Text style={styles.tripDestination}>
                  {getTripDestination(trip)}
                </Text>
                <View style={styles.tripMetaRow}>
                  <View style={styles.tripMetaChip}>
                    <CalendarDays
                      color={colors.teal700}
                      size={14}
                      strokeWidth={2.4}
                    />
                    <Text style={styles.tripMetaText}>
                      {getTripDateRange(trip) || "Dates not set"}
                    </Text>
                  </View>
                  <View style={styles.tripMetaChip}>
                    <Clock3
                      color={colors.teal700}
                      size={14}
                      strokeWidth={2.4}
                    />
                    <Text style={styles.tripMetaText}>
                      {getTripDurationLabel(trip)}
                    </Text>
                  </View>
                </View>
                <View style={styles.updatedRow}>
                  <CalendarDays
                    color={colors.slate400}
                    size={14}
                    strokeWidth={2.3}
                  />
                  <Text style={styles.updatedText}>
                    Updated {formatDate(trip.updated_at)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.actionRow}>
              <PrimaryButton
                title="View"
                icon={<Eye color={colors.white} size={18} strokeWidth={2.4} />}
                onPress={() => setSelectedTrip(trip)}
                style={styles.viewButton}
              />
              <TouchableOpacity
                style={styles.iconButton}
                activeOpacity={0.8}
                onPress={() => openRename(trip)}
              >
                <Edit3 color={colors.slate700} size={18} strokeWidth={2.4} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, styles.deleteButton]}
                activeOpacity={0.8}
                onPress={() => confirmDelete(trip)}
              >
                <Trash2 color={colors.red700} size={18} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          </AppCard>
        ))}
      </ScrollView>

      <Modal
        visible={!!selectedTrip}
        animationType="slide"
        onRequestClose={() => setSelectedTrip(null)}
      >
        <View style={styles.modalRoot}>
          <View
            style={[
              styles.modalHeader,
              { paddingTop: Math.max(spacing.lg, insets.top + spacing.sm) },
            ]}
          >
            <View style={styles.modalTitleRow}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalKicker}>Saved trip</Text>
                <Text style={styles.modalTitle}>
                  {selectedTrip ? getTripDisplayTitle(selectedTrip) : ""}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                activeOpacity={0.8}
                onPress={() => setSelectedTrip(null)}
              >
                <X color={colors.slate700} size={20} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[
                styles.downloadPdfButton,
                isExportingPdf ? styles.downloadPdfButtonDisabled : null,
              ]}
              activeOpacity={0.8}
              disabled={!selectedTrip || isExportingPdf}
              onPress={downloadSelectedTripPdf}
            >
              {isExportingPdf ? (
                <ActivityIndicator color={colors.amber600} size="small" />
              ) : (
                <>
                  <Download color={colors.amber600} size={16} strokeWidth={2.5} />
                  <Text style={styles.downloadPdfText}>Download PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.modalContent,
              { paddingBottom: Math.max(42, insets.bottom + 28) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {selectedTrip?.trip_data.days?.length ? (
              <>
                {selectedTrip.trip_data.total_estimated_cost_eur !== undefined ||
                selectedTrip.trip_data.budget_eur !== undefined ? (
                  <ItineraryBudgetSummary
                    totalCostEur={getTripTotalCost(selectedTrip)}
                    budgetEur={getTripBudget(selectedTrip)}
                    travelers={
                      typeof selectedTrip.trip_data.travelers === "number"
                        ? selectedTrip.trip_data.travelers
                        : null
                    }
                    currency={selectedTrip.trip_data.currency ?? "EUR"}
                    estimatedSavingsEur={getVisibleBudgetOptimizationSavings(
                      selectedTrip.trip_data.days,
                      getTripBudgetOptimization(selectedTrip)
                    )}
                  />
                ) : null}

                <ItineraryTimeline
                  days={selectedTrip.trip_data.days}
                  budgetOptimization={getTripBudgetOptimization(selectedTrip)}
                />
              </>
            ) : (
              <AppCard>
                <Text style={styles.rawTripText}>
                  {JSON.stringify(selectedTrip?.trip_data, null, 2)}
                </Text>
              </AppCard>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        transparent
        visible={!!tripToRename}
        animationType="fade"
        onRequestClose={() => setTripToRename(null)}
      >
        <View style={styles.renameOverlay}>
          <AppCard elevated style={styles.renameCard}>
            <SectionHeader eyebrow="Library" title="Rename trip" />
            <CustomInput
              label="Trip name"
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              placeholder="Trip name"
            />
            <View style={styles.renameActions}>
              <PrimaryButton
                title="Cancel"
                variant="secondary"
                onPress={() => setTripToRename(null)}
                style={styles.renameButton}
              />
              <PrimaryButton
                title="Save"
                loading={isRenaming}
                disabled={!renameValue.trim() || isRenaming}
                icon={<Check color={colors.white} size={18} strokeWidth={2.4} />}
                onPress={submitRename}
                style={styles.renameButton}
              />
            </View>
          </AppCard>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.slate50,
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: 18,
    paddingTop: spacing.sm,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.slate200,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  headerCopy: {
    flex: 1,
  },
  headerKicker: {
    color: colors.gold600,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 3,
  },
  headerTitle: {
    color: colors.slate900,
    fontFamily: typography.displayFontFamily,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 35,
  },
  countBadge: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.slate200,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    minWidth: 44,
    paddingHorizontal: spacing.md,
  },
  countText: {
    color: colors.teal700,
    fontSize: 15,
    fontWeight: "800",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: 36,
    paddingHorizontal: 18,
    paddingTop: spacing.sm,
  },
  feedbackCard: {
    alignItems: "center",
    gap: spacing.md,
  },
  feedbackText: {
    color: colors.slate600,
    fontSize: 14,
    fontWeight: "600",
  },
  emptyCard: {
    alignItems: "center",
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: colors.teal50,
    borderRadius: radius.lg,
    height: 52,
    justifyContent: "center",
    marginBottom: spacing.md,
    width: 52,
  },
  emptyTitle: {
    color: colors.slate900,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  emptyText: {
    color: colors.slate500,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
  },
  tripCard: {
    gap: spacing.lg,
    borderRadius: 24,
  },
  tripHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
  },
  tripIcon: {
    alignItems: "center",
    backgroundColor: colors.teal50,
    borderRadius: radius.lg,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  tripCopy: {
    flex: 1,
  },
  tripName: {
    color: colors.slate900,
    fontFamily: typography.displayFontFamily,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 25,
  },
  tripDestination: {
    color: colors.slate600,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: 4,
  },
  tripMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tripMetaChip: {
    alignItems: "center",
    backgroundColor: colors.teal50,
    borderColor: colors.teal200,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tripMetaText: {
    color: colors.teal700,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  updatedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  updatedText: {
    color: colors.slate400,
    fontSize: 12,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  viewButton: {
    flex: 1,
    minHeight: 46,
    paddingVertical: 12,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.slate100,
    borderRadius: radius.lg,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  deleteButton: {
    backgroundColor: colors.red50,
    borderColor: colors.redBorder,
    borderWidth: 1,
  },
  modalRoot: {
    backgroundColor: colors.slate50,
    flex: 1,
  },
  modalHeader: {
    alignItems: "stretch",
    backgroundColor: colors.white,
    borderBottomColor: colors.slate200,
    borderBottomWidth: 1,
    gap: spacing.md,
    paddingHorizontal: 20,
    paddingBottom: spacing.lg,
  },
  modalTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  modalTitleWrap: {
    flex: 1,
  },
  modalKicker: {
    color: colors.teal700,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  modalTitle: {
    color: colors.slate900,
    fontFamily: typography.displayFontFamily,
    fontSize: 23,
    fontWeight: "700",
    lineHeight: 29,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.slate100,
    borderRadius: radius.lg,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  downloadPdfButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderColor: colors.amber600,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    maxWidth: "100%",
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  downloadPdfButtonDisabled: {
    opacity: 0.7,
  },
  downloadPdfText: {
    color: colors.amber600,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  modalContent: {
    padding: 20,
  },
  rawTripText: {
    color: colors.slate700,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19,
  },
  renameOverlay: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  renameCard: {
    ...shadows.card,
  },
  renameActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  renameButton: {
    flex: 1,
  },
});
