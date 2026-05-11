import React, { useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { deleteSavedTrip, SavedTrip } from "../services/api";

type RootStackParamList = {
  TripDetails: { trip: SavedTrip };
};

type TripDetailsRouteProp = RouteProp<RootStackParamList, "TripDetails">;

type TripDetailsNavigationProp = NativeStackNavigationProp<RootStackParamList, "TripDetails">;

export default function TripDetailsScreen() {
  const route = useRoute<TripDetailsRouteProp>();
  const navigation = useNavigation<TripDetailsNavigationProp>();
  const { token } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const trip = route.params.trip;

  const handleDelete = async () => {
    Alert.alert(
      "Șterge călătoria",
      "Ești sigur că vrei să ștergi această călătorie?",
      [
        { text: "Anulează", style: "cancel" },
        {
          text: "Șterge",
          style: "destructive",
          onPress: async () => {
            if (!token) {
              Alert.alert("Autentificare necesară", "Trebuie să te autentifici pentru a șterge o călătorie.");
              return;
            }

            setIsDeleting(true);
            try {
              await deleteSavedTrip(token, trip.id);
              Alert.alert("Șters", "Călătoria a fost eliminată cu succes.");
              navigation.goBack();
            } catch (error) {
              Alert.alert(
                "Eroare",
                "Ștergerea nu a reușit. Te rog încearcă din nou mai târziu.",
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  const handleEdit = () => {
    Alert.alert("Editare", "Modificarea itinerariului este disponibilă în următoarea versiune.");
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-100">
      <ScrollView className="px-6 py-5">
        <View className="mb-6">
          <Text className="text-3xl font-bold text-slate-900">{trip.title}</Text>
          <Text className="text-slate-500 mt-2">{trip.destination}</Text>
        </View>

        <View className="rounded-[28px] bg-white p-5 shadow-sm border border-slate-200 mb-6">
          <Text className="text-slate-700 text-sm uppercase tracking-[0.2em] mb-3">Detalii călătorie</Text>
          <View className="space-y-3">
            <View className="flex-row justify-between">
              <Text className="text-slate-500">Start</Text>
              <Text className="text-slate-900">{trip.start_date}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-slate-500">Durată</Text>
              <Text className="text-slate-900">{trip.duration_days} zile</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-slate-500">Salvat la</Text>
              <Text className="text-slate-900">{new Date(trip.created_at).toLocaleDateString()}</Text>
            </View>
          </View>
        </View>

        <View className="rounded-[28px] bg-white p-5 shadow-sm border border-slate-200 mb-6">
          <Text className="text-slate-700 text-base font-semibold mb-3">Itinerariu</Text>
          <Text className="text-slate-600 leading-7">
            {trip.itinerary_data?.summary ??
              "Detaliile itinerariului vor fi afișate aici după ce vor fi încărcate din backend."}
          </Text>
        </View>

        <View className="flex-row gap-3 mb-16">
          <TouchableOpacity
            className="flex-1 rounded-3xl bg-slate-900 px-5 py-4"
            activeOpacity={0.8}
            onPress={handleEdit}
          >
            <Text className="text-center text-sm font-semibold text-white">Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 rounded-3xl bg-rose-600 px-5 py-4"
            activeOpacity={0.8}
            onPress={handleDelete}
            disabled={isDeleting}
          >
            <Text className="text-center text-sm font-semibold text-white">
              {isDeleting ? "Ștergere..." : "Delete"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
