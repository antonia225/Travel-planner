import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { fetchSavedTrips, SavedTrip } from "../services/api";

const mockSavedTrips: SavedTrip[] = [
  {
    id: 1,
    user_id: 1,
    title: "Weekend în Provence",
    destination: "Aix-en-Provence, Franța",
    start_date: "2025-09-06",
    duration_days: 5,
    itinerary_data: {
      summary: "Explorați piețele locale, vinării și sate pitorești.",
    },
    created_at: "2025-04-01T10:15:00Z",
  },
  {
    id: 2,
    user_id: 1,
    title: "Aventura în Islanda",
    destination: "Reykjavík, Islanda",
    start_date: "2025-11-12",
    duration_days: 7,
    itinerary_data: {
      summary: "Cascade, ghețari și peisaje nordice spectaculoase.",
    },
    created_at: "2025-04-24T09:00:00Z",
  },
];

type RootStackParamList = {
  TripDetails: { trip: SavedTrip };
};

export default function LibraryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token } = useAuth();
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>(mockSavedTrips);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadTrips = async () => {
      setLoading(true);
      try {
        const response = await fetchSavedTrips(token);
        setSavedTrips(response.trips);
      } catch (error) {
        console.warn("Could not load saved trips:", error);
        Alert.alert(
          "Încărcare eșuată",
          "Nu am putut încărca călătoriile salvate. Folosim date mock în acest moment.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadTrips();
  }, [token]);

  const renderTrip = ({ item }: { item: SavedTrip }) => (
    <TouchableOpacity
      className="bg-white rounded-3xl border border-slate-200 p-4 mb-4 shadow-sm"
      activeOpacity={0.85}
      onPress={() => navigation.navigate("TripDetails", { trip: item })}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View>
          <Text className="text-slate-900 text-lg font-semibold">{item.title}</Text>
          <Text className="text-slate-500 text-sm">{item.destination}</Text>
        </View>
        <View className="bg-emerald-100 rounded-full px-3 py-1">
          <Text className="text-emerald-700 text-xs font-semibold">Saved</Text>
        </View>
      </View>
      <View className="flex-row justify-between gap-2">
        <View className="rounded-2xl bg-slate-100 px-3 py-2">
          <Text className="text-slate-700 text-xs">Start</Text>
          <Text className="text-slate-900 text-sm">{item.start_date}</Text>
        </View>
        <View className="rounded-2xl bg-slate-100 px-3 py-2">
          <Text className="text-slate-700 text-xs">Durată</Text>
          <Text className="text-slate-900 text-sm">{item.duration_days} zile</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-100">
      <View className="px-6 py-5">
        <Text className="text-2xl font-bold text-slate-900 mb-2">Saved Trips</Text>
        <Text className="text-slate-500 mb-4">Galeria ta de itinerarii salvate.</Text>

        {loading ? (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color="#0f766e" />
          </View>
        ) : (
          <FlatList
            data={savedTrips}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderTrip}
            contentContainerStyle={{ paddingBottom: 36 }}
            ListEmptyComponent={() => (
              <View className="items-center py-20">
                <Text className="text-slate-500">Nu există călătorii salvate.</Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
