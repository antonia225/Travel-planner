import type { BudgetOptimizerResponse, BudgetRecommendation } from "../services/api";

type ActivityLike = {
  title?: string;
  estimated_cost_eur?: number | null;
};

type DayLike = {
  activities?: ActivityLike[];
};

type RecommendationMatch = {
  recommendation: BudgetRecommendation;
  recommendationIndex: number;
};

function normalizeTitle(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function matchesBudgetRecommendation(
  recommendation: BudgetRecommendation,
  activity: ActivityLike
) {
  if (
    normalizeTitle(recommendation.original_activity) !==
    normalizeTitle(activity.title)
  ) {
    return false;
  }

  if (
    typeof recommendation.original_cost_eur === "number" &&
    typeof activity.estimated_cost_eur === "number"
  ) {
    return recommendation.original_cost_eur === activity.estimated_cost_eur;
  }

  return true;
}

export function getBudgetOptimizationSavings(
  result?: BudgetOptimizerResponse | null
) {
  if (!result) {
    return null;
  }

  return result.recommendations.reduce(
    (total, item) => total + (item.estimated_savings_eur ?? 0),
    0
  );
}

export function getVisibleBudgetOptimizationSavings(
  days: DayLike[] | undefined,
  budgetOptimization?: BudgetOptimizerResponse | null
) {
  if (!budgetOptimization) {
    return null;
  }

  return Object.values(
    mapBudgetRecommendationsToActivityKeys(days, budgetOptimization)
  ).reduce(
    (total, match) =>
      total + (match?.recommendation.estimated_savings_eur ?? 0),
    0
  );
}

export function mapBudgetRecommendationsToActivityKeys(
  days: DayLike[] | undefined,
  budgetOptimization?: Pick<BudgetOptimizerResponse, "recommendations"> | null
) {
  const matches: Record<string, RecommendationMatch | undefined> = {};
  const usedRecommendationIndexes = new Set<number>();
  const recommendations = budgetOptimization?.recommendations ?? [];

  (days ?? []).forEach((day, dayIndex) => {
    (day.activities ?? []).forEach((activity, activityIndex) => {
      const recommendationIndex = recommendations.findIndex(
        (recommendation, index) =>
          !usedRecommendationIndexes.has(index) &&
          matchesBudgetRecommendation(recommendation, activity)
      );

      if (recommendationIndex >= 0) {
        matches[`${dayIndex}:${activityIndex}`] = {
          recommendation: recommendations[recommendationIndex],
          recommendationIndex,
        };
        usedRecommendationIndexes.add(recommendationIndex);
      }
    });
  });

  return matches;
}

export function removeBudgetRecommendationForActivity(
  days: DayLike[] | undefined,
  budgetOptimization: BudgetOptimizerResponse | null | undefined,
  dayIndex: number,
  activityIndex: number
): BudgetOptimizerResponse | null {
  if (!budgetOptimization) {
    return null;
  }

  const match = mapBudgetRecommendationsToActivityKeys(
    days,
    budgetOptimization
  )[`${dayIndex}:${activityIndex}`];

  if (!match) {
    return budgetOptimization;
  }

  const recommendations = budgetOptimization.recommendations.filter(
    (_, index) => index !== match.recommendationIndex
  );

  if (recommendations.length === 0) {
    return null;
  }

  return {
    ...budgetOptimization,
    recommendations,
    total_estimated_savings_eur: recommendations.reduce(
      (total, item) => total + (item.estimated_savings_eur ?? 0),
      0
    ),
  };
}
