import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ComponentType } from "react";
import {
  Bed,
  Camera,
  Car,
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
} from "lucide-react-native";

import { colors, radius, shadows, spacing } from "../theme/designSystem";

export type TimelineActivity = {
  title?: string;
  description?: string;
  time_slot?: string;
};

export type TimelineDay = {
  day_number?: number;
  activities?: TimelineActivity[];
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
  onRegenerateActivity?: (
    dayIndex: number,
    activityIndex: number,
    activity: TimelineActivity
  ) => void;
  regeneratingActivityKey?: string | null;
};

function inferActivityMeta(activity: TimelineActivity): ActivityMeta {
  const text = `${activity.title ?? ""} ${activity.description ?? ""}`.toLowerCase();

  if (/restaurant|dinner|lunch|breakfast|food|dining|meal|bistro|cafe|bar/.test(text)) {
    return { Icon: Utensils, label: "Dining" };
  }

  if (/museum|monument|landmark|temple|cathedral|castle|palace|gallery|historic/.test(text)) {
    return { Icon: Landmark, label: "Sightseeing" };
  }

  if (/train|metro|subway|rail|station/.test(text)) {
    return { Icon: TrainFront, label: "Transit" };
  }

  if (/car|taxi|drive|transfer|bus|transport|arrival|depart/.test(text)) {
    return { Icon: Car, label: "Transit" };
  }

  if (/flight|airport|plane/.test(text)) {
    return { Icon: Plane, label: "Flight" };
  }

  if (/hotel|check-in|check in|stay|accommodation/.test(text)) {
    return { Icon: Bed, label: "Stay" };
  }

  if (/coffee|tea|bakery|brunch/.test(text)) {
    return { Icon: Coffee, label: "Cafe" };
  }

  if (/park|garden|hike|nature|beach|trail/.test(text)) {
    return { Icon: Trees, label: "Outdoor" };
  }

  if (/shop|market|souvenir|mall/.test(text)) {
    return { Icon: ShoppingBag, label: "Shopping" };
  }

  if (/show|concert|music|theater|nightlife/.test(text)) {
    return { Icon: Music, label: "Entertainment" };
  }

  if (/photo|view|scenic|walk|tour/.test(text)) {
    return { Icon: Camera, label: "Explore" };
  }

  return { Icon: MapPin, label: "Activity" };
}

function TimelineActivityCard({
  activity,
  activityIndex,
  dayIndex,
  isFirst,
  isLast,
  isRegenerating,
  onRegenerate,
}: {
  activity: TimelineActivity;
  activityIndex: number;
  dayIndex: number;
  isFirst: boolean;
  isLast: boolean;
  isRegenerating: boolean;
  onRegenerate?: (
    dayIndex: number,
    activityIndex: number,
    activity: TimelineActivity
  ) => void;
}) {
  const { Icon, label } = inferActivityMeta(activity);

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
          </View>

          {onRegenerate ? (
            <TouchableOpacity
              style={styles.regenerateButton}
              activeOpacity={0.8}
              disabled={isRegenerating}
              accessibilityLabel="Replace activity"
              onPress={() => onRegenerate(dayIndex, activityIndex, activity)}
            >
              {isRegenerating ? (
                <ActivityIndicator size="small" color={colors.teal700} />
              ) : (
                <RefreshCw color={colors.teal700} size={16} strokeWidth={2.4} />
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.activityTitle}>{activity.title || "Activity"}</Text>
        {activity.description ? (
          <Text style={styles.activityDescription}>{activity.description}</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function ItineraryTimeline({
  days,
  onRegenerateActivity,
  regeneratingActivityKey,
}: Props) {
  if (!days?.length) {
    return null;
  }

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
              </View>
            </View>

            {activities.length > 0 ? (
              activities.map((activity, activityIndex) => (
                <TimelineActivityCard
                  key={`activity-${dayIndex}-${activityIndex}`}
                  activity={activity}
                  activityIndex={activityIndex}
                  dayIndex={dayIndex}
                  isFirst={activityIndex === 0}
                  isLast={activityIndex === activities.length - 1}
                  isRegenerating={
                    regeneratingActivityKey === `${dayIndex}:${activityIndex}`
                  }
                  onRegenerate={onRegenerateActivity}
                />
              ))
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
