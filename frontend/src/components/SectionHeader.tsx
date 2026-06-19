import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "../theme/designSystem";

type Props = {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
};

export default function SectionHeader({ title, eyebrow, action }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  copy: {
    flex: 1,
  },
  eyebrow: {
    color: colors.gold600,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  title: {
    color: colors.slate900,
    fontFamily: typography.displayFontFamily,
    fontSize: 21,
    fontWeight: "700",
    lineHeight: 27,
  },
});
