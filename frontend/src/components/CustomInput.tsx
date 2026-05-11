import React, { useState } from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";

type Props = TextInputProps & {
  label: string;
  error?: string;
};

export default function CustomInput({ label, error, ...props }: Props) {
  const [isFocused, setIsFocused] = useState(false);

  const borderClass = error
    ? "border-red-400"
    : isFocused
    ? "border-teal-500"
    : "border-slate-200";

  return (
    <View>
      <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </Text>
      <TextInput
        className={`rounded-2xl border bg-white px-4 py-4 text-base text-slate-900 ${borderClass}`}
        placeholderTextColor="#94a3b8"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
      {error ? (
        <Text className="mt-1.5 text-xs font-medium text-red-500">{error}</Text>
      ) : null}
    </View>
  );
}
