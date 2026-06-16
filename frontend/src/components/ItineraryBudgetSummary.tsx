import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PiggyBank, UsersRound, WalletCards } from "lucide-react-native";

import { colors, radius, shadows, spacing } from "../theme/designSystem";

const EURO = "\u20ac";

type Props = {
  totalCostEur: number;
  budgetEur?: number | null;
  travelers?: number | null;
  currency?: "EUR";
  estimatedSavingsEur?: number | null;
};

export default function ItineraryBudgetSummary({
  totalCostEur,
  budgetEur,
  travelers,
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
  const travelerText =
    typeof travelers === "number" && travelers > 0
      ? `${travelers} ${travelers === 1 ? "traveler" : "travelers"}`
      : null;

  return (
    <View style={styles.budgetSummary}>
      <View style={styles.summaryHeader}>
        <View style={styles.iconBadge}>
          <WalletCards color={colors.white} size={20} strokeWidth={2.3} />
        </View>
        <View style={styles.budgetSummaryCopy}>
          <Text style={styles.budgetSummaryLabel}>Activities total cost</Text>
          <Text style={styles.budgetSummaryValue}>
            {EURO}
            {totalCostEur}
            {budgetText}
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        {travelerText ? (
          <View style={styles.metricCard}>
            <UsersRound color={colors.teal700} size={16} strokeWidth={2.3} />
            <Text style={styles.metricLabel}>Travelers</Text>
            <Text style={styles.metricValue}>For {travelerText}</Text>
          </View>
        ) : null}
        {finalCostWithAlternatives !== null ? (
          <View style={styles.metricCard}>
            <PiggyBank color={colors.amber600} size={16} strokeWidth={2.3} />
            <Text style={styles.finalCostText}>
              Final cost with alternatives{" "}
              <Text style={styles.finalCostAmount}>
                {EURO}
                {finalCostWithAlternatives}
              </Text>
            </Text>
          </View>
        ) : null}
        {hasSavings ? (
          <View style={[styles.metricCard, styles.savingsBadge]}>
            <Text style={styles.savingsLabel}>Save</Text>
            <Text style={styles.savingsValue}>
              {EURO}
              {estimatedSavingsEur}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  budgetSummary: {
    backgroundColor: colors.white,
    borderColor: "rgba(255,255,255,0.86)",
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    ...shadows.soft,
  },
  summaryHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  iconBadge: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  budgetSummaryCopy: {
    flex: 1,
  },
  budgetSummaryLabel: {
    color: colors.gold600,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  budgetSummaryValue: {
    color: colors.slate900,
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 22,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  metricCard: {
    backgroundColor: colors.cream,
    borderColor: colors.slate100,
    borderRadius: radius.md,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 118,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  metricLabel: {
    color: colors.slate500,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
    marginTop: 3,
    textTransform: "uppercase",
  },
  metricValue: {
    color: colors.slate900,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 2,
  },
  finalCostText: {
    color: colors.slate500,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 15,
    textTransform: "uppercase",
  },
  finalCostAmount: {
    color: colors.amber600,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 2,
  },
  savingsBadge: {
    backgroundColor: colors.teal600,
    borderColor: colors.teal600,
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
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
  },
});
