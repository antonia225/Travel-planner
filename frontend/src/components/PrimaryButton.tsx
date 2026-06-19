import React from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
} from "react-native";

import { colors, radius, shadows, typography } from "../theme/designSystem";

type Props = TouchableOpacityProps & {
  title: string;
  loading?: boolean;
  icon?: React.ReactNode;
  variant?: "primary" | "secondary" | "destructive";
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function PrimaryButton({
  title,
  loading = false,
  disabled,
  icon,
  variant = "primary",
  fullWidth = true,
  style,
  ...props
}: Props) {
  const isDisabled = disabled || loading;
  const buttonStyle = [
    styles.button,
    fullWidth ? styles.fullWidth : null,
    variant === "primary" ? styles.primary : null,
    variant === "secondary" ? styles.secondary : null,
    variant === "destructive" ? styles.destructive : null,
    disabled && !loading ? styles.disabled : null,
    style,
  ];
  const textStyle = [
    styles.text,
    variant === "secondary" ? styles.secondaryText : null,
    disabled && !loading ? styles.disabledText : null,
  ];
  const indicatorColor =
    disabled && !loading
      ? colors.slate400
      : variant === "secondary"
      ? colors.teal700
      : colors.white;

  return (
    <TouchableOpacity
      style={buttonStyle}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...props}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={indicatorColor} style={styles.icon} />
        ) : icon ? (
          <View style={styles.icon}>{icon}</View>
        ) : null}
        <Text style={textStyle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: radius.lg,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  fullWidth: {
    width: "100%",
  },
  primary: {
    backgroundColor: colors.teal600,
    borderColor: "rgba(255,255,255,0.24)",
    borderWidth: 1,
    ...shadows.glow,
  },
  secondary: {
    backgroundColor: colors.white,
    borderColor: colors.teal200,
    borderWidth: 1,
  },
  destructive: {
    backgroundColor: colors.coral600,
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
  },
  disabled: {
    backgroundColor: colors.slate200,
    borderColor: colors.slate200,
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: typography.buttonLetterSpacing,
  },
  secondaryText: {
    color: colors.teal700,
    fontWeight: "800",
  },
  disabledText: {
    color: colors.slate400,
  },
});
