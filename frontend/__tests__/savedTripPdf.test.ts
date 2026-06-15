import type { SavedTrip } from "../src/services/api";
import { colors } from "../src/theme/designSystem";
import {
  buildSavedTripPdfHtml,
  getSavedTripPdfFileName,
} from "../src/utils/savedTripPdf";

function buildSavedTrip(overrides: Partial<SavedTrip> = {}): SavedTrip {
  return {
    id: 1,
    user_id: 1,
    name: "Paris spring",
    trip_data: {
      destination: "Paris",
      start_date: "2026-09-17",
      end_date: "2026-09-18",
      budget_eur: 800,
      total_estimated_cost_eur: 245,
      travel_style: "Relaxed",
      days: [
        {
          day_number: 1,
          date: "2026-09-17",
          activities: [
            {
              title: "Louvre visit",
              description: "Explore the galleries with an AI-generated plan.",
              time_slot: "09:00 - 11:00",
              estimated_cost_eur: 17,
            },
            {
              title: "Rooftop dinner",
              description: "Dinner with a view.",
              time_slot: "19:00 - 21:00",
              estimated_cost_eur: 70,
            },
          ],
        },
        {
          day_number: 2,
          date: "2026-09-18",
          activities: [
            {
              title: "Seine walk",
              description: "Walk the riverside.",
              time_slot: "10:00 - 12:00",
              estimated_cost_eur: 0,
            },
          ],
        },
      ],
      budget_optimization: {
        destination: "Paris",
        total_budget: 800,
        total_estimated_savings_eur: 40,
        recommendations: [
          {
            original_activity: "Rooftop dinner",
            original_cost_eur: 70,
            suggested_alternative: "Choose a neighborhood bistro.",
            estimated_alternative_cost_eur: 30,
            estimated_savings_eur: 40,
            reason: "Lower menu prices with a local meal.",
          },
          {
            original_activity: "Unshown activity",
            original_cost_eur: 99,
            suggested_alternative: "This should not be visible.",
            estimated_savings_eur: 50,
          },
        ],
      },
    },
    created_at: "2026-06-14T12:00:00",
    updated_at: "2026-06-14T12:00:00",
    ...overrides,
  };
}

describe("saved trip PDF HTML", () => {
  it("includes the saved-trip title, destination, dates, and all activities", () => {
    const html = buildSavedTripPdfHtml(buildSavedTrip(), new Date(2026, 5, 14));

    expect(html).toContain("Paris spring");
    expect(html).toContain("Paris");
    expect(html).toContain("Sep 17, 2026 - Sep 18, 2026");
    expect(html).toContain("Louvre visit");
    expect(html).toContain("Explore the galleries with an AI-generated plan.");
    expect(html).toContain("09:00 - 11:00");
    expect(html).toContain("Rooftop dinner");
    expect(html).toContain("Seine walk");
    expect(html).toContain("Exported Jun 14, 2026");
  });

  it("renders activity categories, document colors, and day page breaks without timeline UI markup", () => {
    const html = buildSavedTripPdfHtml(buildSavedTrip());

    expect(html).toContain("Sightseeing");
    expect(html).toContain("Dining");
    expect(html).toContain("Explore");
    expect(html).toContain("class=\"schedule-item\"");
    expect(html).not.toContain("class=\"rail\"");
    expect(html).not.toContain("class=\"icon-node\"");
    expect(html).not.toContain("class=\"activity-icon\"");
    expect(html).toContain(`background: ${colors.teal50}`);
    expect(html).toContain(`color: ${colors.sky600}`);
    expect(html).toContain(`background: ${colors.amber50}`);
    expect(html).toContain(`background: ${colors.sky50}`);
    expect(html).toContain(`color: ${colors.amber600}`);
    expect(html).toContain(`color: ${colors.teal700}`);
    expect(html).toContain("@page { size: A4; margin: 32px; }");
    expect(html).toContain("page-break-before: always");
    expect(html).toContain("break-before: page");
  });

  it("includes the budget overview and only matched inline budget tips", () => {
    const html = buildSavedTripPdfHtml(buildSavedTrip());

    expect(html).toContain("Total activity cost");
    expect(html).toContain("&#8364;245");
    expect(html).toContain("Final cost with alternatives <span>&#8364;205</span>");
    expect(html).toContain(`.final-cost {\n        color: ${colors.teal700};`);
    expect(html).toContain(`.final-cost span {\n        color: ${colors.amber600};`);
    expect(html).toContain("Trip budget");
    expect(html).toContain("Estimated savings with alternatives");
    expect(html).toContain("Choose a neighborhood bistro.");
    expect(html).toContain("Original &#8364;70");
    expect(html).toContain("Alt cost &#8364;30");
    expect(html).toContain("Save &#8364;40");
    expect(html).toContain("Lower menu prices with a local meal.");
    expect(html).toContain(`.original-cost { color: ${colors.slate500}; }`);
    expect(html).toContain(`.alt-cost { color: ${colors.amber600}; }`);
    expect(html).toContain(`.savings {\n        color: ${colors.teal700};`);
    expect(html).not.toContain("All optimization tips");
    expect(html).not.toContain("Unshown activity");
    expect(html).not.toContain("This should not be visible.");
    expect(html).not.toContain("Save &#8364;50");
  });

  it("includes saved, updated, exported, and additional trip metadata", () => {
    const html = buildSavedTripPdfHtml(buildSavedTrip(), new Date(2026, 5, 14));

    expect(html).toContain("Saved ");
    expect(html).toContain("Updated ");
    expect(html).toContain("Exported Jun 14, 2026");
    expect(html).toContain("Additional saved trip details");
    expect(html).toContain("Travel Style");
    expect(html).toContain("Relaxed");
  });

  it("escapes saved and generated text before putting it into HTML", () => {
    const html = buildSavedTripPdfHtml(
      buildSavedTrip({
        name: "Trip <script>",
        trip_data: {
          destination: "Paris & Lyon",
          days: [
            {
              day_number: 1,
              activities: [
                {
                  title: "Museum \"special\"",
                  description: "See <paintings> & sculpture.",
                  time_slot: "10:00",
                },
              ],
            },
          ],
        },
      })
    );

    expect(html).toContain("Trip &lt;script&gt;");
    expect(html).toContain("Paris &amp; Lyon");
    expect(html).toContain("Museum &quot;special&quot;");
    expect(html).toContain("See &lt;paintings&gt; &amp; sculpture.");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<paintings>");
  });

  it("renders a raw fallback when structured days are missing", () => {
    const html = buildSavedTripPdfHtml(
      buildSavedTrip({
        name: "Draft trip",
        trip_data: {
          destination: "Draft",
          note: "No structured itinerary yet",
        },
      })
    );

    expect(html).toContain("Itinerary details");
    expect(html).toContain("Destination");
    expect(html).toContain("Draft");
    expect(html).toContain("Note");
    expect(html).toContain("No structured itinerary yet");
  });

  it("generates a stable PDF filename", () => {
    expect(getSavedTripPdfFileName(buildSavedTrip())).toBe(
      "paris-spring-itinerary.pdf"
    );
  });
});
