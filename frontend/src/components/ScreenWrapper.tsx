import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cssInterop } from "nativewind";

// Teach NativeWind to map className → style on this third-party component.
cssInterop(SafeAreaView, { className: "style" });

type Props = {
  children: React.ReactNode;
  /** Full Tailwind bg class for the safe-area background, e.g. "bg-teal-700" */
  bgClassName?: string;
};

export default function ScreenWrapper({
  children,
  bgClassName = "bg-slate-50",
}: Props) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} className={`flex-1 ${bgClassName}`}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
