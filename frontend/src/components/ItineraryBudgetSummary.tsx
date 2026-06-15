import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { WalletCards } from "lucide-react-native";

import { colors, radius, spacing } from "../theme/designSystem";

const EURO = "\u20ac";

type Props = {
  totalCostEur: number;
  budgetEur?: number | null;
  currency?: "EUR";
  estimatedSavingsEur?: number | null;
};

export default function ItineraryBudgetSummary({
  totalCostEur,
  budgetEur,
  estimatedSavingsEur,
}: Props) {
  const budgetText =
    budgetEur !== null && budgetEur !== undefined
      ? ` of ${EURO}${budgetEur} budget`
      : "";

  const hasSavings =
    typeof estimatedSavingsEur === "number" && estimatedSavingsEur > 0;
  const finalCostWithAlternatives = hasSavings
    ? Math.max(totalCostEur - estimatedSavingsEur, 0)
    : null;

  return (
    <View style={styles.budgetSummary}>
      <WalletCards color={colors.teal700} size={18} strokeWidth={2.3} />
      <View style={styles.budgetSummaryCopy}>
        <Text style={styles.budgetSummaryLabel}>Activities total cost</Text>
        <Text style={styles.budgetSummaryValue}>
          {EURO}
          {totalCostEur}
          {budgetText}
        </Text>
        {finalCostWithAlternatives !== null ? (
          <Text style={styles.finalCostText}>
            Final cost with alternatives{" "}
            <Text style={styles.finalCostAmount}>
              {EURO}
              {finalCostWithAlternatives}
            </Text>
          </Text>
        ) : null}
      </View>
      {hasSavings ? (
        <View style={styles.savingsBadge}>
          <Text style={styles.savingsLabel}>Save</Text>
          <Text style={styles.savingsValue}>
            {EURO}
            {estimatedSavingsEur}
          </Text>
          <Text style={styles.savingsSubtext}>with alternatives</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  budgetSummary: {
    alignItems: "center",
    backgroundColor: colors.teal50,
    borderColor: colors.teal200,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  budgetSummaryCopy: {
    flex: 1,
  },
  budgetSummaryLabel: {
    color: colors.teal700,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  budgetSummaryValue: {
    color: colors.slate900,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
    marginTop: 2,
  },
  finalCostText: {
    color: colors.teal700,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  finalCostAmount: {
    color: colors.amber600,
  },
  savingsBadge: {
    alignItems: "center",
    backgroundColor: colors.teal600,
    borderRadius: radius.md,
    minWidth: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  savingsLabel: {
    color: colors.teal100,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 14,
    textTransform: "uppercase",
  },
  savingsValue: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 21,
  },
  savingsSubtext: {
    color: colors.teal100,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
  },
});
