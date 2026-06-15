import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import ItineraryBudgetSummary from "../src/components/ItineraryBudgetSummary";
import ItineraryTimeline from "../src/components/ItineraryTimeline";
import TripSearchForm from "../src/components/TripSearchForm";
import {
  buildTripDataToSave,
  selectMostExpensiveBudgetActivities,
} from "../src/screens/HomeScreen";
import { optimizeBudget, saveGeneratedTrip } from "../src/services/api";
import {
  getBudgetOptimizationSavings,
  removeBudgetRecommendationForActivity,
} from "../src/utils/budgetOptimization";

const EURO = "\u20ac";

function collectText(node: unknown): string[] {
  if (node === null || node === undefined || typeof node === "boolean") {
    return [];
  }

  if (typeof node === "string" || typeof node === "number") {
    return [String(node)];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectText);
  }

  if (typeof node === "object" && "children" in node) {
    return collectText((node as { children?: unknown }).children);
  }

  return [];
}

function renderToJson(element: React.ReactElement) {
  let tree: { toJSON(): unknown } | undefined;
  act(() => {
    tree = create(element);
  });
  return tree?.toJSON();
}

describe("itinerary budget UI", () => {
  it("shows the budget input currency", () => {
    const tree = renderToJson(<TripSearchForm />);

    expect(collectText(tree)).toContain(`Budget (${EURO})`);
  });

  it("shows day dates and per-activity euro cost chips", () => {
    const tree = renderToJson(
      <ItineraryTimeline
        days={[
          {
            day_number: 1,
            date: "2026-09-17",
            activities: [
              {
                title: "Louvre visit",
                description: "Explore the galleries.",
                time_slot: "09:00 - 11:00",
                estimated_cost_eur: 17,
              },
              {
                title: "Seine walk",
                description: "Walk the riverside.",
                time_slot: "13:00 - 15:00",
                estimated_cost_eur: 0,
              },
              {
                title: "Bistro dinner",
                description: "Choose a casual dinner.",
                time_slot: "18:00 - 20:00",
                estimated_cost_eur: 24,
              },
            ],
          },
        ]}
      />
    );

    const visibleText = collectText(tree).join("");

    expect(visibleText).toContain("Sep 17, 2026");
    expect(visibleText).toContain(`${EURO}17`);
    expect(visibleText).toContain(`${EURO}0`);
    expect(visibleText).toContain(`${EURO}24`);
  });

  it("shows the total euro budget summary", () => {
    const tree = renderToJson(
      <ItineraryBudgetSummary
        totalCostEur={245}
        budgetEur={800}
        estimatedSavingsEur={40}
      />
    );

    const visibleText = collectText(tree).join("");

    expect(visibleText).toContain("Activities total cost");
    expect(visibleText).toContain(`${EURO}245 of ${EURO}800 budget`);
    expect(visibleText).toContain(`Final cost with alternatives ${EURO}205`);
    expect(visibleText).not.toContain("budget EUR");
    expect(visibleText).toContain(`Save${EURO}40`);
    expect(visibleText).toContain("with alternatives");
  });

  it("sums per-activity savings instead of trusting the backend total", () => {
    const savings = getBudgetOptimizationSavings({
      destination: "Rome",
      total_budget: 1000,
      total_estimated_savings_eur: 999,
      recommendations: [
        {
          original_activity: "Museum",
          estimated_savings_eur: 12,
        },
        {
          original_activity: "Dinner",
          estimated_savings_eur: 28,
        },
      ],
    });

    expect(savings).toBe(40);
  });

  it("shows a cancel option while itinerary generation is loading", () => {
    const tree = renderToJson(<TripSearchForm isSubmitting onCancel={jest.fn()} />);

    const visibleText = collectText(tree).join("");

    expect(visibleText).toContain("Generating itinerary");
    expect(visibleText).toContain("Cancel");
  });

  it("selects the three most expensive paid activities", () => {
    const activities = selectMostExpensiveBudgetActivities([
      {
        day_number: 1,
        activities: [
          {
            title: "Museum",
            description: "Paid entry",
            time_slot: "09:00 - 11:00",
            estimated_cost_eur: 20,
          },
          {
            title: "Free walk",
            description: "Self-guided walk",
            time_slot: "12:00 - 13:00",
            estimated_cost_eur: 0,
          },
          {
            title: "Dinner",
            description: "Restaurant dinner",
            time_slot: "19:00 - 21:00",
            estimated_cost_eur: 55,
          },
        ],
      },
      {
        day_number: 2,
        activities: [
          {
            title: "Boat tour",
            description: "Harbor tour",
            time_slot: "10:00 - 12:00",
            estimated_cost_eur: 70,
          },
          {
            title: "Cooking class",
            description: "Local class",
            time_slot: "15:00 - 17:00",
            estimated_cost_eur: 85,
          },
          {
            title: "Park",
            description: "Relax outside",
            time_slot: "18:00 - 19:00",
          },
        ],
      },
    ]);

    expect(activities.map((activity) => activity.title)).toEqual([
      "Cooking class",
      "Boat tour",
      "Dinner",
    ]);
  });

  it("returns no optimizable activities when every activity is free", () => {
    const activities = selectMostExpensiveBudgetActivities([
      {
        day_number: 1,
        activities: [
          {
            title: "Park walk",
            description: "Walk through the park",
            time_slot: "09:00 - 10:00",
            estimated_cost_eur: 0,
          },
        ],
      },
    ]);

    expect(activities).toEqual([]);
  });

  it("sends expensive activities to the budget optimizer endpoint", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        destination: "Rome",
        total_budget: 1000,
        total_estimated_savings_eur: 40,
        recommendations: [
          {
            original_activity: "Rooftop dinner",
            original_cost_eur: 70,
            suggested_alternative: "Choose a neighborhood trattoria.",
            estimated_alternative_cost_eur: 30,
            estimated_savings_eur: 40,
            reason: "Lower menu prices with a local meal.",
          },
        ],
      }),
    });
    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      await optimizeBudget("token", "Rome", 1000, [
        {
          title: "Rooftop dinner",
          description: "Dinner with a view.",
          time_slot: "19:00 - 21:00",
          day_number: 1,
          estimated_cost_eur: 70,
        },
      ]);
    } finally {
      global.fetch = originalFetch;
    }

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/optimize-budget"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          destination: "Rome",
          budget: 1000,
          expensive_activities: [
            {
              title: "Rooftop dinner",
              description: "Dinner with a view.",
              time_slot: "19:00 - 21:00",
              day_number: 1,
              estimated_cost_eur: 70,
            },
          ],
        }),
      })
    );
  });

  it("adds budget optimization to the trip data before saving", async () => {
    const budgetOptimization = {
      destination: "Rome",
      total_budget: 1000,
      total_estimated_savings_eur: 40,
      recommendations: [
        {
          original_activity: "Rooftop dinner",
          original_cost_eur: 70,
          suggested_alternative: "Choose a neighborhood trattoria.",
          estimated_alternative_cost_eur: 30,
          estimated_savings_eur: 40,
          reason: "Lower menu prices with a local meal.",
        },
      ],
    };
    const tripData = buildTripDataToSave(
      {
        destination: "Rome",
        budget_eur: 1000,
        days: [],
      },
      budgetOptimization
    );
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 1,
        user_id: 1,
        name: "Rome trip",
        trip_data: tripData,
        created_at: "2026-06-14T12:00:00",
        updated_at: "2026-06-14T12:00:00",
      }),
    });
    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      await saveGeneratedTrip("token", "Rome trip", tripData);
    } finally {
      global.fetch = originalFetch;
    }

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tripData.budget_optimization.total_estimated_savings_eur).toBe(40);
    expect(body.tripData.budget_optimization.recommendations[0].original_activity).toBe(
      "Rooftop dinner"
    );
  });

  it("renders budget alternatives inside the itinerary", () => {
    const tree = renderToJson(
      <ItineraryTimeline
        days={[
          {
            day_number: 1,
            date: "2026-09-17",
            activities: [
              {
                title: "Rooftop dinner",
                description: "Dinner with a view.",
                time_slot: "19:00 - 21:00",
                estimated_cost_eur: 70,
              },
            ],
          },
        ]}
        budgetOptimization={{
          recommendations: [
            {
              original_activity: "Rooftop dinner",
              original_cost_eur: 70,
              suggested_alternative: "Choose a neighborhood trattoria.",
              estimated_alternative_cost_eur: 30,
              estimated_savings_eur: 40,
              reason: "Lower menu prices with a local meal.",
            },
          ],
        }}
      />
    );

    const visibleText = collectText(tree).join("");

    expect(visibleText).toContain("Rooftop dinner");
    expect(visibleText).toContain("Alternative");
    expect(visibleText).toContain("Choose a neighborhood trattoria.");
    expect(visibleText).toContain(`Original${EURO}70`);
    expect(visibleText).toContain(`Alt cost${EURO}30`);
    expect(visibleText).toContain(`Save${EURO}40`);
    expect(visibleText).not.toContain("Budget suggestions saved with this trip.");
  });

  it("removes only the refreshed activity's budget alternative", () => {
    const optimization = {
      destination: "Rome",
      total_budget: 1000,
      total_estimated_savings_eur: 70,
      recommendations: [
        {
          original_activity: "Rooftop dinner",
          original_cost_eur: 70,
          suggested_alternative: "Choose a neighborhood trattoria.",
          estimated_alternative_cost_eur: 30,
          estimated_savings_eur: 40,
        },
        {
          original_activity: "Boat tour",
          original_cost_eur: 50,
          suggested_alternative: "Take a self-guided river walk.",
          estimated_alternative_cost_eur: 20,
          estimated_savings_eur: 30,
        },
      ],
    };

    const filtered = removeBudgetRecommendationForActivity(
      [
        {
          activities: [
            {
              title: "Rooftop dinner",
              estimated_cost_eur: 70,
            },
            {
              title: "Boat tour",
              estimated_cost_eur: 50,
            },
          ],
        },
      ],
      optimization,
      0,
      0
    );

    expect(filtered?.recommendations).toHaveLength(1);
    expect(filtered?.recommendations[0].original_activity).toBe("Boat tour");
    expect(getBudgetOptimizationSavings(filtered)).toBe(30);

    const tree = renderToJson(
      <ItineraryTimeline
        days={[
          {
            day_number: 1,
            activities: [
              {
                title: "Fresh dinner",
                description: "New activity.",
                time_slot: "19:00 - 21:00",
                estimated_cost_eur: 65,
              },
              {
                title: "Boat tour",
                description: "Harbor tour.",
                time_slot: "10:00 - 12:00",
                estimated_cost_eur: 50,
              },
            ],
          },
        ]}
        budgetOptimization={filtered}
      />
    );

    const visibleText = collectText(tree).join("");

    expect(visibleText).not.toContain("Choose a neighborhood trattoria.");
    expect(visibleText).toContain("Take a self-guided river walk.");
  });
});
