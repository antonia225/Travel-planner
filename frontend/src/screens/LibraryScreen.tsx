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
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Edit3,
  Eye,
  FolderOpen,
  MapPin,
  Trash2,
  X,
} from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";

import AppCard from "../components/AppCard";
import CustomInput from "../components/CustomInput";
import ItineraryTimeline from "../components/ItineraryTimeline";
import PrimaryButton from "../components/PrimaryButton";
import SectionHeader from "../components/SectionHeader";
import { useAuth } from "../context/AuthContext";
import {
  deleteSavedTrip,
  listSavedTrips,
  renameSavedTrip,
  SavedTrip,
} from "../services/api";
import { colors, radius, shadows, spacing } from "../theme/designSystem";

type Props = {
  navigation: {
    goBack: () => void;
  };
};

function getTripSummary(trip: SavedTrip) {
  const destination = trip.trip_data.destination || "Generated trip";
  const days = Array.isArray(trip.trip_data.days)
    ? trip.trip_data.days.length
    : 0;

  if (days > 0) {
    return `${destination} - ${days} ${days === 1 ? "day" : "days"}`;
  }

  return destination;
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
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<SavedTrip | null>(null);
  const [tripToRename, setTripToRename] = useState<SavedTrip | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

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
    Alert.alert("Delete saved trip?", `"${trip.name}" will be removed from your library.`, [
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
            setSavedTrips((trips) => trips.filter((item) => item.id !== trip.id));
            setSelectedTrip((selected) => (selected?.id === trip.id ? null : selected));
          } catch (error) {
            Alert.alert(
              "Could not delete trip",
              error instanceof Error ? error.message : "Something went wrong."
            );
          }
        },
      },
    ]);
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
                <Text style={styles.tripName}>{trip.name}</Text>
                <Text style={styles.tripSummary}>{getTripSummary(trip)}</Text>
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
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleWrap}>
              <Text style={styles.modalKicker}>Saved trip</Text>
              <Text style={styles.modalTitle}>{selectedTrip?.name}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              activeOpacity={0.8}
              onPress={() => setSelectedTrip(null)}
            >
              <X color={colors.slate700} size={20} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {selectedTrip?.trip_data.days?.length ? (
              <ItineraryTimeline days={selectedTrip.trip_data.days} />
            ) : (
              <AppCard>
                <Text style={styles.rawTripText}>
                  {JSON.stringify(selectedTrip?.trip_data, null, 2)}
                </Text>
              </AppCard>
            )}
          </ScrollView>
        </SafeAreaView>
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
  countBadge: {
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
  countText: {
    color: colors.white,
    fontSize: 15,
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
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 23,
  },
  tripSummary: {
    color: colors.slate600,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: 4,
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
    alignItems: "center",
    backgroundColor: colors.white,
    borderBottomColor: colors.slate200,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: 20,
    paddingVertical: spacing.lg,
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
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.slate100,
    borderRadius: radius.lg,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  modalContent: {
    padding: 20,
    paddingBottom: 42,
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
