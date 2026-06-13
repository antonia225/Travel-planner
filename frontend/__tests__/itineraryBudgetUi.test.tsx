import React from "react";
import { act, create } from "react-test-renderer";

import ItineraryBudgetSummary from "../src/components/ItineraryBudgetSummary";
import ItineraryTimeline from "../src/components/ItineraryTimeline";
import TripSearchForm from "../src/components/TripSearchForm";

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
      <ItineraryBudgetSummary totalCostEur={245} budgetEur={800} />
    );

    const visibleText = collectText(tree).join("");

    expect(visibleText).toContain("Activities total cost");
    expect(visibleText).toContain(`${EURO}245 of ${EURO}800 budget EUR`);
  });
});
