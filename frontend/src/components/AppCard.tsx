import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";

import { colors, radius, shadows, spacing } from "../theme/designSystem";

type Props = ViewProps & {
  children: React.ReactNode;
  elevated?: boolean;
};

export default function AppCard({
  children,
  elevated = false,
  style,
  ...props
}: Props) {
  return (
    <View
      style={[styles.card, elevated ? shadows.soft : null, style]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.slate100,
    padding: spacing.xl,
  },
});
