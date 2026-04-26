import React from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
} from "react-native";

type Props = TouchableOpacityProps & {
  title: string;
  loading?: boolean;
};

export default function PrimaryButton({
  title,
  loading = false,
  disabled,
  // Extract className so it doesn't overwrite the component's own className
  // when callers spread extra utility classes (e.g. className="mt-8").
  className: extraClassName = "",
  ...props
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      className={`items-center rounded-2xl py-4 ${
        isDisabled ? "bg-slate-200" : "bg-teal-600"
      } ${extraClassName}`.trim()}
      disabled={isDisabled}
      activeOpacity={0.75}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={isDisabled ? "#94a3b8" : "#ffffff"} />
      ) : (
        <Text
          className={`text-base font-bold tracking-wide ${
            isDisabled ? "text-slate-400" : "text-white"
          }`}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
