import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ComponentType } from "react";
import {
  AlertCircle,
  Bed,
  Camera,
  Coffee,
  Landmark,
  MapPin,
  Music,
  Plane,
  RefreshCw,
  Route,
  ShoppingBag,
  TrainFront,
  Trees,
  Utensils,
  X,
} from "lucide-react-native";

import { colors, radius, shadows, spacing } from "../theme/designSystem";
import {
  inferActivityCategoryMeta,
  type ActivityCategoryKey,
} from "../utils/activityMeta";
import { mapBudgetRecommendationsToActivityKeys } from "../utils/budgetOptimization";

const EURO = "\u20ac";

export type TimelineActivity = {
  title?: string;
  description?: string;
  time_slot?: string;
  estimated_cost_eur?: number | null;
};

export type TimelineDay = {
  day_number?: number;
  date?: string | null;
  activities?: TimelineActivity[];
};

export type TimelineBudgetRecommendation = {
  original_activity?: string | null;
  original_cost_eur?: number | null;
  suggested_alternative?: string | null;
  recommendation?: string | null;
  estimated_alternative_cost_eur?: number | null;
  estimated_savings_eur?: number | null;
  reason?: string | null;
};

export type TimelineBudgetOptimization = {
  recommendations: TimelineBudgetRecommendation[];
};

type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

type ActivityMeta = {
  Icon: IconComponent;
  label: string;
};

type Props = {
  days?: TimelineDay[];
  budgetOptimization?: TimelineBudgetOptimization | null;
  onRegenerateActivity?: (
    dayIndex: number,
    activityIndex: number,
    activity: TimelineActivity
  ) => void;
  onCancelRegenerateActivity?: () => void;
  regeneratingActivityKey?: string | null;
  activityErrors?: Record<string, string | undefined>;
};

const iconByCategory: Record<ActivityCategoryKey, IconComponent> = {
  dining: Utensils,
  sightseeing: Landmark,
  transit: TrainFront,
  flight: Plane,
  stay: Bed,
  cafe: Coffee,
  outdoor: Trees,
  shopping: ShoppingBag,
  entertainment: Music,
  explore: Camera,
  activity: MapPin,
};

function inferActivityMeta(activity: TimelineActivity): ActivityMeta {
  const category = inferActivityCategoryMeta(activity);
  return { Icon: iconByCategory[category.key], label: category.label };
}

function formatTimelineDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function TimelineActivityCard({
  activity,
  activityIndex,
  dayIndex,
  isFirst,
  isLast,
  isRegenerating,
  isRegenerateDisabled,
  budgetRecommendation,
  errorMessage,
  onRegenerate,
  onCancelRegenerate,
}: {
  activity: TimelineActivity;
  activityIndex: number;
  dayIndex: number;
  isFirst: boolean;
  isLast: boolean;
  isRegenerating: boolean;
  isRegenerateDisabled: boolean;
  budgetRecommendation?: TimelineBudgetRecommendation;
  errorMessage?: string;
  onRegenerate?: (
    dayIndex: number,
    activityIndex: number,
    activity: TimelineActivity
  ) => void;
  onCancelRegenerate?: () => void;
}) {
  const { Icon, label } = inferActivityMeta(activity);
  const alternative =
    budgetRecommendation?.suggested_alternative ??
    budgetRecommendation?.recommendation;

  return (
    <View style={styles.timelineItem}>
      <View style={styles.rail}>
        <View style={[styles.railLine, isFirst ? styles.railLineMuted : null]} />
        <View style={styles.iconNode}>
          <Icon color={colors.teal700} size={18} strokeWidth={2.4} />
        </View>
        <View style={[styles.railLine, isLast ? styles.railLineMuted : null]} />
      </View>

      <View style={styles.activityCard}>
        <View style={styles.activityHeader}>
          <View style={styles.activityHeaderCopy}>
            {activity.time_slot ? (
              <Text style={styles.timeText}>{activity.time_slot}</Text>
            ) : null}
            <Text style={styles.activityType}>{label}</Text>
            {typeof activity.estimated_cost_eur === "number" ? (
              <View style={styles.costChip}>
                <Text style={styles.costText}>
                  {EURO}
                  {activity.estimated_cost_eur}
                </Text>
              </View>
            ) : null}
          </View>

          {onRegenerate ? (
            isRegenerating ? (
              <View style={styles.regenerateActive}>
                <ActivityIndicator size="small" color={colors.teal700} />
                <TouchableOpacity
                  style={styles.cancelRegenerateButton}
                  activeOpacity={0.8}
                  accessibilityLabel="Cancel activity refresh"
                  onPress={onCancelRegenerate}
                >
                  <X color={colors.white} size={15} strokeWidth={2.6} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.regenerateButton,
                  isRegenerateDisabled ? styles.regenerateButtonDisabled : null,
                ]}
                activeOpacity={0.8}
                disabled={isRegenerateDisabled}
                accessibilityLabel="Replace activity"
                onPress={() => onRegenerate(dayIndex, activityIndex, activity)}
              >
                <RefreshCw color={colors.teal700} size={16} strokeWidth={2.4} />
              </TouchableOpacity>
            )
          ) : null}
        </View>

        <Text style={styles.activityTitle}>{activity.title || "Activity"}</Text>
        {activity.description ? (
          <Text style={styles.activityDescription}>{activity.description}</Text>
        ) : null}
        {alternative ? (
          <View style={styles.alternativeCard}>
            <Text style={styles.alternativeLabel}>Alternative</Text>
            <Text style={styles.alternativeText}>{alternative}</Text>
            <View style={styles.alternativeCostRow}>
              {typeof budgetRecommendation?.original_cost_eur === "number" ? (
                <View style={styles.alternativeCostChip}>
                  <Text style={styles.alternativeCostLabel}>Original</Text>
                  <Text style={styles.alternativeCostValue}>
                    {EURO}
                    {budgetRecommendation.original_cost_eur}
                  </Text>
                </View>
              ) : null}
              {typeof budgetRecommendation?.estimated_alternative_cost_eur ===
              "number" ? (
                <View style={[styles.alternativeCostChip, styles.altCostChip]}>
                  <Text
                    style={[
                      styles.alternativeCostLabel,
                      styles.altCostChipLabel,
                    ]}
                  >
                    Alt cost
                  </Text>
                  <Text
                    style={[
                      styles.alternativeCostValue,
                      styles.altCostChipValue,
                    ]}
                  >
                    {EURO}
                    {budgetRecommendation.estimated_alternative_cost_eur}
                  </Text>
                </View>
              ) : null}
              {typeof budgetRecommendation?.estimated_savings_eur ===
              "number" ? (
                <View style={[styles.alternativeCostChip, styles.savingsChip]}>
                  <Text style={styles.savingsChipLabel}>Save</Text>
                  <Text style={styles.savingsChipValue}>
                    {EURO}
                    {budgetRecommendation.estimated_savings_eur}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
        {errorMessage ? (
          <View style={styles.activityError}>
            <AlertCircle color={colors.red700} size={14} strokeWidth={2.4} />
            <Text style={styles.activityErrorText}>{errorMessage}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function ItineraryTimeline({
  days,
  budgetOptimization,
  onRegenerateActivity,
  onCancelRegenerateActivity,
  regeneratingActivityKey,
  activityErrors,
}: Props) {
  if (!days?.length) {
    return null;
  }

  const recommendationByActivityKey = mapBudgetRecommendationsToActivityKeys(
    days,
    budgetOptimization
  );

  return (
    <View style={styles.container}>
      {days.map((day, dayIndex) => {
        const activities = day.activities ?? [];

        return (
          <View key={`day-${dayIndex}`} style={styles.dayBlock}>
            <View style={styles.dayHeader}>
              <View style={styles.dayBadge}>
                <Route color={colors.white} size={18} strokeWidth={2.4} />
              </View>
              <View>
                <Text style={styles.dayEyebrow}>Day</Text>
                <Text style={styles.dayTitle}>{day.day_number || dayIndex + 1}</Text>
                {formatTimelineDate(day.date) ? (
                  <Text style={styles.dayDate}>{formatTimelineDate(day.date)}</Text>
                ) : null}
              </View>
            </View>

            {activities.length > 0 ? (
              activities.map((activity, activityIndex) => {
                const activityKey = `${dayIndex}:${activityIndex}`;

                return (
                  <TimelineActivityCard
                    key={`activity-${dayIndex}-${activityIndex}`}
                    activity={activity}
                    activityIndex={activityIndex}
                    dayIndex={dayIndex}
                    isFirst={activityIndex === 0}
                    isLast={activityIndex === activities.length - 1}
                    isRegenerating={regeneratingActivityKey === activityKey}
                    isRegenerateDisabled={!!regeneratingActivityKey}
                    budgetRecommendation={
                      recommendationByActivityKey[activityKey]?.recommendation
                    }
                    errorMessage={activityErrors?.[activityKey]}
                    onRegenerate={onRegenerateActivity}
                    onCancelRegenerate={onCancelRegenerateActivity}
                  />
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No activities found.</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
  },
  dayBlock: {
    gap: spacing.md,
  },
  dayHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  dayBadge: {
    alignItems: "center",
    backgroundColor: colors.teal600,
    borderRadius: radius.lg,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  dayEyebrow: {
    color: colors.slate500,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  dayTitle: {
    color: colors.slate900,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
  },
  dayDate: {
    color: colors.slate500,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 2,
  },
  timelineItem: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 112,
  },
  rail: {
    alignItems: "center",
    width: 42,
  },
  railLine: {
    backgroundColor: colors.teal200,
    flex: 1,
    width: 2,
  },
  railLineMuted: {
    backgroundColor: "transparent",
  },
  iconNode: {
    alignItems: "center",
    backgroundColor: colors.teal50,
    borderColor: colors.tealBorder,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  activityCard: {
    backgroundColor: colors.white,
    borderColor: colors.slate100,
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    ...shadows.soft,
  },
  activityHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  activityHeaderCopy: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  regenerateButton: {
    alignItems: "center",
    backgroundColor: colors.teal50,
    borderColor: colors.teal200,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  regenerateButtonDisabled: {
    opacity: 0.45,
  },
  regenerateActive: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  cancelRegenerateButton: {
    alignItems: "center",
    backgroundColor: colors.red500,
    borderColor: colors.red500,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  timeText: {
    color: colors.teal700,
    fontSize: 12,
    fontWeight: "800",
  },
  activityType: {
    backgroundColor: colors.slate100,
    borderRadius: radius.pill,
    color: colors.slate600,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    textTransform: "uppercase",
  },
  costChip: {
    backgroundColor: colors.amber50,
    borderColor: "#fde68a",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  costText: {
    color: colors.amber600,
    fontSize: 11,
    fontWeight: "800",
  },
  activityTitle: {
    color: colors.slate900,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
  },
  activityDescription: {
    color: colors.slate600,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  alternativeCard: {
    backgroundColor: colors.sky50,
    borderColor: "#bae6fd",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  alternativeLabel: {
    color: colors.sky600,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
    textTransform: "uppercase",
  },
  alternativeText: {
    color: colors.slate700,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  alternativeCostRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  alternativeCostChip: {
    backgroundColor: colors.white,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  alternativeCostLabel: {
    color: colors.slate500,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
    textTransform: "uppercase",
  },
  alternativeCostValue: {
    color: colors.slate900,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  altCostChip: {
    backgroundColor: colors.amber50,
    borderColor: "#fde68a",
  },
  altCostChipLabel: {
    color: colors.amber600,
  },
  altCostChipValue: {
    color: colors.amber600,
  },
  savingsChip: {
    backgroundColor: colors.teal50,
    borderColor: colors.teal200,
  },
  savingsChipLabel: {
    color: colors.teal700,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
    textTransform: "uppercase",
  },
  savingsChipValue: {
    color: colors.teal700,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  activityError: {
    alignItems: "flex-start",
    backgroundColor: colors.red50,
    borderColor: colors.redBorder,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  activityErrorText: {
    color: colors.red700,
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderColor: colors.slate100,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginLeft: 54,
    padding: spacing.lg,
  },
  emptyText: {
    color: colors.slate500,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
});
