import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Trash2, Edit3, Eye, X, Check, ArrowLeft } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";

import { useAuth } from "../context/AuthContext";
import {
  deleteSavedTrip,
  listSavedTrips,
  renameSavedTrip,
  SavedTrip,
} from "../services/api";

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
    return `${destination} • ${days} ${days === 1 ? "day" : "days"}`;
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

        Alert.alert(
          "Could not load library",
          message
        );
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
    <SafeAreaView className="flex-1 bg-teal-700">
      <View className="flex-row items-center px-5 py-4">
        <TouchableOpacity
          className="h-11 w-11 items-center justify-center rounded-full bg-white/15"
          activeOpacity={0.75}
          onPress={navigation.goBack}
        >
          <ArrowLeft color="#ffffff" size={22} />
        </TouchableOpacity>
        <View className="ml-4 flex-1">
          <Text className="text-sm font-semibold text-teal-100">User library</Text>
          <Text className="text-2xl font-extrabold text-white">Saved trips</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadSavedTrips(true)}
            tintColor="#ffffff"
          />
        }
      >
        {isLoading ? (
          <View className="mt-10 rounded-2xl bg-slate-50 p-6">
            <ActivityIndicator color="#0d9488" />
            <Text className="mt-3 text-center text-sm font-semibold text-slate-600">
              Loading saved trips...
            </Text>
          </View>
        ) : null}

        {!isLoading && savedTrips.length === 0 ? (
          <View className="mt-6 rounded-2xl bg-slate-50 p-6">
            <Text className="text-base font-bold text-slate-900">No saved trips yet</Text>
            <Text className="mt-2 text-sm font-medium leading-5 text-slate-600">
              Generate an itinerary from Home and save it to see it here.
            </Text>
          </View>
        ) : null}

        {savedTrips.map((trip) => (
          <View key={trip.id} className="mb-3 rounded-2xl bg-slate-50 p-4">
            <View className="flex-row items-start">
              <View className="flex-1 pr-3">
                <Text className="text-base font-extrabold text-slate-900">{trip.name}</Text>
                <Text className="mt-1 text-sm font-semibold text-slate-500">
                  {getTripSummary(trip)}
                </Text>
                <Text className="mt-2 text-xs font-semibold text-slate-400">
                  Updated {formatDate(trip.updated_at)}
                </Text>
              </View>
            </View>

            <View className="mt-4 flex-row gap-2">
              <TouchableOpacity
                className="h-11 flex-1 flex-row items-center justify-center rounded-xl bg-teal-600"
                activeOpacity={0.75}
                onPress={() => setSelectedTrip(trip)}
              >
                <Eye color="#ffffff" size={18} />
                <Text className="ml-2 text-sm font-bold text-white">View</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="h-11 w-11 items-center justify-center rounded-xl bg-slate-200"
                activeOpacity={0.75}
                onPress={() => openRename(trip)}
              >
                <Edit3 color="#334155" size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                className="h-11 w-11 items-center justify-center rounded-xl bg-red-100"
                activeOpacity={0.75}
                onPress={() => confirmDelete(trip)}
              >
                <Trash2 color="#991b1b" size={18} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!selectedTrip} animationType="slide" onRequestClose={() => setSelectedTrip(null)}>
        <SafeAreaView className="flex-1 bg-slate-50">
          <View className="flex-row items-center border-b border-slate-200 px-5 py-4">
            <View className="flex-1 pr-3">
              <Text className="text-xs font-bold uppercase text-teal-700">Saved trip</Text>
              <Text className="text-xl font-extrabold text-slate-900">{selectedTrip?.name}</Text>
            </View>
            <TouchableOpacity
              className="h-10 w-10 items-center justify-center rounded-full bg-slate-200"
              activeOpacity={0.75}
              onPress={() => setSelectedTrip(null)}
            >
              <X color="#334155" size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerClassName="p-5 pb-10">
            {selectedTrip?.trip_data.days?.map((day, index) => (
              <View key={index} className="mb-3 rounded-2xl bg-white p-4">
                <Text className="mb-3 text-base font-extrabold text-teal-700">
                  Day {day.day_number || index + 1}
                </Text>
                {day.activities?.map((activity, activityIndex) => (
                  <View key={activityIndex} className="mb-2 rounded-xl bg-slate-50 p-3">
                    <Text className="text-sm font-extrabold text-slate-900">
                      {activity.time_slot ? `${activity.time_slot} - ` : ""}
                      {activity.title || "Activity"}
                    </Text>
                    {activity.description ? (
                      <Text className="mt-1 text-sm font-medium leading-5 text-slate-600">
                        {activity.description}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )) || (
              <Text className="rounded-2xl bg-white p-4 text-sm font-medium leading-5 text-slate-700">
                {JSON.stringify(selectedTrip?.trip_data, null, 2)}
              </Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal transparent visible={!!tripToRename} animationType="fade" onRequestClose={() => setTripToRename(null)}>
        <View className="flex-1 justify-center bg-black/40 px-5">
          <View className="rounded-2xl bg-white p-5">
            <Text className="text-lg font-extrabold text-slate-900">Rename trip</Text>
            <TextInput
              className="mt-4 rounded-xl border border-slate-200 px-4 py-3 text-base font-semibold text-slate-900"
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              placeholder="Trip name"
              placeholderTextColor="#94a3b8"
            />
            <View className="mt-5 flex-row gap-3">
              <TouchableOpacity
                className="h-12 flex-1 items-center justify-center rounded-xl bg-slate-200"
                activeOpacity={0.75}
                onPress={() => setTripToRename(null)}
              >
                <Text className="text-sm font-bold text-slate-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`h-12 flex-1 flex-row items-center justify-center rounded-xl ${
                  renameValue.trim() ? "bg-teal-600" : "bg-slate-200"
                }`}
                activeOpacity={0.75}
                disabled={!renameValue.trim() || isRenaming}
                onPress={submitRename}
              >
                {isRenaming ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Check color="#ffffff" size={18} />
                    <Text className="ml-2 text-sm font-bold text-white">Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
