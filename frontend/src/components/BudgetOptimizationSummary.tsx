import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { BudgetOptimizerResponse } from "../services/api";
import { colors, radius, spacing } from "../theme/designSystem";
import { getBudgetOptimizationSavings } from "../utils/budgetOptimization";

const EURO = "\u20ac";

type Props = {
  result: BudgetOptimizerResponse;
};

function hasActivitySavings(result: BudgetOptimizerResponse) {
  return result.recommendations.some(
    (item) => typeof item.estimated_savings_eur === "number"
  );
}

export default function BudgetOptimizationSummary({ result }: Props) {
  const activitySavings = hasActivitySavings(result);
  const savings = getBudgetOptimizationSavings(result);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>
            {activitySavings ? "Estimated savings" : "Optimized budget plan"}
          </Text>
          <Text style={styles.meta}>
            {result.destination} - {EURO}
            {result.total_budget} EUR budget
          </Text>
        </View>

        {activitySavings ? (
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeLabel}>Save</Text>
            <Text style={styles.totalBadgeValue}>
              {EURO}
              {savings}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.list}>
        {result.recommendations.map((item, index) => {
          const title =
            item.original_activity || item.category || `Suggestion ${index + 1}`;
          const alternative = item.suggested_alternative || item.recommendation;

          return (
            <View key={`${title}-${index}`} style={styles.item}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{title}</Text>
                {typeof item.original_cost_eur === "number" ? (
                  <Text style={styles.originalCost}>
                    {EURO}
                    {item.original_cost_eur}
                  </Text>
                ) : item.estimated_cost ? (
                  <Text style={styles.originalCost}>{item.estimated_cost}</Text>
                ) : null}
              </View>

              {typeof item.estimated_savings_eur === "number" ? (
                <View style={styles.savingsRow}>
                  <Text style={styles.alternativeLabel}>AI alternative</Text>
                  <Text style={styles.savingsValue}>
                    Save {EURO}
                    {item.estimated_savings_eur}
                  </Text>
                </View>
              ) : null}

              {alternative ? (
                <Text style={styles.alternativeText}>{alternative}</Text>
              ) : null}

              {typeof item.estimated_alternative_cost_eur === "number" ? (
                <Text style={styles.detailText}>
                  Estimated alternative cost: {EURO}
                  {item.estimated_alternative_cost_eur}
                </Text>
              ) : null}

              {item.reason ? <Text style={styles.reasonText}>{item.reason}</Text> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.sky50,
    borderColor: "#bae6fd",
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: colors.slate900,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  meta: {
    color: colors.slate500,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 2,
  },
  totalBadge: {
    alignItems: "center",
    backgroundColor: colors.teal600,
    borderRadius: radius.md,
    minWidth: 78,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  totalBadgeLabel: {
    color: colors.teal100,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 14,
    textTransform: "uppercase",
  },
  totalBadgeValue: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
  },
  list: {
    gap: spacing.sm,
  },
  item: {
    backgroundColor: colors.white,
    borderColor: colors.slate100,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  itemHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  itemTitle: {
    color: colors.slate900,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  originalCost: {
    color: colors.teal700,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "right",
  },
  savingsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  alternativeLabel: {
    color: colors.sky600,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
    textTransform: "uppercase",
  },
  savingsValue: {
    color: colors.teal700,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  alternativeText: {
    color: colors.slate600,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  detailText: {
    color: colors.slate500,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  reasonText: {
    color: colors.slate500,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: spacing.xs,
  },
});
