import type { BudgetRecommendation, SavedTrip } from "../services/api";
import { colors } from "../theme/designSystem";
import {
  inferActivityCategoryMeta,
  type ActivityCategoryKey,
} from "./activityMeta";
import {
  getVisibleBudgetOptimizationSavings,
  mapBudgetRecommendationsToActivityKeys,
} from "./budgetOptimization";

const EURO_HTML = "&#8364;";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = parseLocalDate(value);
  if (!parsed) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getTripDateRange(trip: SavedTrip) {
  const startDate = formatDate(
    typeof trip.trip_data.start_date === "string" ? trip.trip_data.start_date : null
  );
  const endDate = formatDate(
    typeof trip.trip_data.end_date === "string" ? trip.trip_data.end_date : null
  );

  if (startDate && endDate && startDate !== endDate) {
    return `${startDate} - ${endDate}`;
  }

  return startDate ?? endDate;
}

function getTripDestination(trip: SavedTrip) {
  return trip.trip_data.destination || "Generated trip";
}

function getTripDisplayTitle(trip: SavedTrip) {
  const dateRange = getTripDateRange(trip);
  return dateRange ? `${trip.name} - ${dateRange}` : trip.name;
}

function sumTripActivityCosts(trip: SavedTrip) {
  return (trip.trip_data.days ?? []).reduce(
    (total, day) =>
      total +
      (day.activities ?? []).reduce(
        (dayTotal, activity) => dayTotal + (activity.estimated_cost_eur ?? 0),
        0
      ),
    0
  );
}

function getTripTotalCost(trip: SavedTrip) {
  return typeof trip.trip_data.total_estimated_cost_eur === "number"
    ? trip.trip_data.total_estimated_cost_eur
    : sumTripActivityCosts(trip);
}

function getTripBudget(trip: SavedTrip) {
  return typeof trip.trip_data.budget_eur === "number"
    ? trip.trip_data.budget_eur
    : null;
}

function renderMoney(value?: number | null) {
  return typeof value === "number" ? `${EURO_HTML}${escapeHtml(value)}` : null;
}

function renderBudgetTip(recommendation?: BudgetRecommendation) {
  if (!recommendation) {
    return "";
  }

  const alternative =
    recommendation.suggested_alternative ?? recommendation.recommendation;
  const originalCost = renderMoney(recommendation.original_cost_eur);
  const alternativeCost = renderMoney(
    recommendation.estimated_alternative_cost_eur
  );
  const savings = renderMoney(recommendation.estimated_savings_eur);

  return `
    <section class="budget-tip">
      <div class="budget-tip__label">Alternative</div>
      ${
        alternative
          ? `<p class="budget-tip__text">${escapeHtml(alternative)}</p>`
          : ""
      }
      <div class="budget-tip__chips">
        ${originalCost ? `<span>Original ${originalCost}</span>` : ""}
        ${alternativeCost ? `<span>Alt cost ${alternativeCost}</span>` : ""}
        ${savings ? `<span>Save ${savings}</span>` : ""}
      </div>
      ${
        recommendation.reason
          ? `<p class="budget-tip__reason">${escapeHtml(
              recommendation.reason
            )}</p>`
          : ""
      }
    </section>
  `;
}

function renderActivityCost(value?: number | null) {
  const money = renderMoney(value);
  return money ? `<span class="cost">${money}</span>` : "";
}

function renderActivityIcon(category: ActivityCategoryKey) {
  const pathByCategory: Record<ActivityCategoryKey, string> = {
    dining:
      '<path d="M7 3v8"/><path d="M5 3v8"/><path d="M9 3v8"/><path d="M5 8h4"/><path d="M7 11v10"/><path d="M16 3v18"/><path d="M16 3c3 2 3 7 0 9"/>',
    sightseeing:
      '<path d="M4 20h16"/><path d="M6 20v-8"/><path d="M18 20v-8"/><path d="M3 10l9-6 9 6"/><path d="M8 10v10"/><path d="M12 10v10"/><path d="M16 10v10"/>',
    transit:
      '<path d="M6 3h12a2 2 0 0 1 2 2v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V5a2 2 0 0 1 2-2z"/><path d="M8 21l2-3"/><path d="M16 18l2 3"/><path d="M4 9h16"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/>',
    flight:
      '<path d="M2 16l20-8-20-8 5 8-5 8z"/><path d="M7 8h15"/><path d="M7 8l-3 8"/>',
    stay:
      '<path d="M3 21V9"/><path d="M21 21V11a3 3 0 0 0-3-3H9v13"/><path d="M3 13h18"/><path d="M7 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>',
    cafe:
      '<path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z"/><path d="M16 10h2a3 3 0 0 1 0 6h-2"/><path d="M6 2v3"/><path d="M10 2v3"/><path d="M14 2v3"/><path d="M4 21h14"/>',
    outdoor:
      '<path d="M12 22V12"/><path d="M8 16l4-4 4 4"/><path d="M4 12a8 8 0 0 1 16 0c0 4-3 7-8 7s-8-3-8-7z"/>',
    shopping:
      '<path d="M6 8h12l-1 13H7L6 8z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    entertainment:
      '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    explore:
      '<path d="M5 12h14"/><path d="M12 5v14"/><path d="M16 8l3-3"/><path d="M8 16l-3 3"/><circle cx="12" cy="12" r="9"/>',
    activity:
      '<path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  };

  return `<svg class="activity-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="${colors.teal700}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${pathByCategory[category]}</svg>`;
}

function renderDayActivities(
  trip: SavedTrip,
  dayIndex: number,
  activities: NonNullable<SavedTrip["trip_data"]["days"]>[number]["activities"]
) {
  const recommendationByActivityKey = mapBudgetRecommendationsToActivityKeys(
    trip.trip_data.days,
    trip.trip_data.budget_optimization
  );

  return (activities ?? [])
    .map((activity, activityIndex) => {
      const recommendation =
        recommendationByActivityKey[`${dayIndex}:${activityIndex}`]
          ?.recommendation;
      const category = inferActivityCategoryMeta(activity);

      return `
        <article class="timeline-item">
          <div class="rail">
            <div class="rail-line"></div>
            <div class="icon-node">${renderActivityIcon(category.key)}</div>
            <div class="rail-line"></div>
          </div>
          <div class="activity-card">
            <div class="activity__meta">
              ${
                activity.time_slot
                  ? `<span class="time">${escapeHtml(activity.time_slot)}</span>`
                  : ""
              }
              <span class="activity-type">${escapeHtml(category.label)}</span>
              ${renderActivityCost(activity.estimated_cost_eur)}
            </div>
            <h3>${escapeHtml(activity.title || "Activity")}</h3>
            ${
              activity.description
                ? `<p class="activity__description">${escapeHtml(
                    activity.description
                  )}</p>`
                : ""
            }
            ${renderBudgetTip(recommendation)}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderStructuredTrip(trip: SavedTrip) {
  return (trip.trip_data.days ?? [])
    .map((day, dayIndex) => {
      const dayDate = formatDate(day.date);
      const activities = day.activities ?? [];

      return `
        <section class="day">
          <div class="day__header">
            <div>
              <div class="eyebrow">Day</div>
              <h2>${escapeHtml(day.day_number || dayIndex + 1)}</h2>
            </div>
            ${dayDate ? `<p>${escapeHtml(dayDate)}</p>` : ""}
          </div>
          ${
            activities.length
              ? renderDayActivities(trip, dayIndex, activities)
              : `<p class="empty">No activities found.</p>`
          }
        </section>
      `;
    })
    .join("");
}

function renderRawFallback(trip: SavedTrip) {
  return `
    <section class="raw">
      <h2>Saved trip data</h2>
      <pre>${escapeHtml(JSON.stringify(trip.trip_data, null, 2))}</pre>
    </section>
  `;
}

function renderBudgetSummary(trip: SavedTrip) {
  const hasCost =
    Array.isArray(trip.trip_data.days) &&
    trip.trip_data.days.length > 0 &&
    (trip.trip_data.total_estimated_cost_eur !== undefined ||
      trip.trip_data.budget_eur !== undefined);

  if (!hasCost) {
    return "";
  }

  const totalCost = getTripTotalCost(trip);
  const budget = getTripBudget(trip);
  const savings = getVisibleBudgetOptimizationSavings(
    trip.trip_data.days,
    trip.trip_data.budget_optimization
  );

  return `
    <section class="summary">
      <div>
        <div class="eyebrow">Activities total cost</div>
        <p class="summary__value">
          ${EURO_HTML}${escapeHtml(totalCost)}
          ${budget !== null ? ` of ${EURO_HTML}${escapeHtml(budget)} budget` : ""}
        </p>
      </div>
      ${
        typeof savings === "number" && savings > 0
          ? `<div class="summary__savings"><span>Save</span><strong>${EURO_HTML}${escapeHtml(
              savings
            )}</strong><small>with alternatives</small></div>`
          : ""
      }
    </section>
  `;
}

export function getSavedTripPdfFileName(trip: SavedTrip) {
  const slug = (trip.name || getTripDestination(trip))
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "saved-trip"}-itinerary.pdf`;
}

export function buildSavedTripPdfHtml(trip: SavedTrip, exportedAt = new Date()) {
  const hasStructuredDays =
    Array.isArray(trip.trip_data.days) && trip.trip_data.days.length > 0;
  const exportedDate = exportedAt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        background: ${colors.slate50};
        color: ${colors.slate900};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 0;
        padding: 36px;
      }
      header {
        background: ${colors.white};
        border: 1px solid ${colors.slate200};
        border-bottom: 3px solid ${colors.teal600};
        border-radius: 14px;
        margin-bottom: 24px;
        padding: 18px 20px;
      }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 28px; line-height: 1.2; margin-top: 4px; }
      h2 { font-size: 22px; line-height: 1.25; }
      h3 { font-size: 16px; line-height: 1.35; margin-top: 8px; }
      .eyebrow {
        color: ${colors.teal700};
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1px;
        text-transform: uppercase;
      }
      .meta {
        color: ${colors.slate600};
        font-size: 13px;
        font-weight: 600;
        line-height: 1.5;
        margin-top: 8px;
      }
      .summary {
        align-items: center;
        background: ${colors.teal50};
        border: 1px solid ${colors.teal200};
        border-radius: 14px;
        display: flex;
        justify-content: space-between;
        margin-bottom: 26px;
        padding: 14px 16px;
      }
      .summary__value {
        font-size: 17px;
        font-weight: 800;
        margin-top: 3px;
      }
      .summary__savings {
        align-items: center;
        background: ${colors.teal600};
        border-radius: 12px;
        color: ${colors.white};
        display: flex;
        flex-direction: column;
        min-width: 92px;
        padding: 8px 12px;
      }
      .summary__savings span, .summary__savings small {
        color: ${colors.teal100};
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .summary__savings strong { font-size: 19px; line-height: 1.2; }
      .day {
        break-before: page;
        margin-bottom: 26px;
        page-break-before: always;
      }
      .day__header {
        align-items: flex-end;
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      .day__header p {
        color: ${colors.slate500};
        font-size: 13px;
        font-weight: 700;
      }
      .timeline-item {
        align-items: stretch;
        display: flex;
        gap: 12px;
        margin-bottom: 10px;
        min-height: 112px;
      }
      .rail {
        align-items: center;
        display: flex;
        flex-direction: column;
        width: 42px;
      }
      .rail-line {
        background: ${colors.teal200};
        flex: 1;
        width: 2px;
      }
      .icon-node {
        align-items: center;
        background: ${colors.teal50};
        border: 1px solid ${colors.tealBorder};
        border-radius: 14px;
        display: flex;
        height: 40px;
        justify-content: center;
        width: 40px;
      }
      .activity-icon {
        height: 18px;
        width: 18px;
      }
      .activity-card {
        background: ${colors.white};
        border: 1px solid ${colors.slate100};
        border-radius: 14px;
        flex: 1;
        padding: 16px;
      }
      .activity__meta {
        align-items: center;
        color: ${colors.teal700};
        display: flex;
        flex-wrap: wrap;
        font-size: 12px;
        font-weight: 800;
        gap: 8px;
      }
      .activity-type {
        background: ${colors.slate100};
        border-radius: 999px;
        color: ${colors.slate600};
        font-size: 11px;
        font-weight: 800;
        padding: 3px 8px;
        text-transform: uppercase;
      }
      .cost {
        background: ${colors.amber50};
        border: 1px solid #fde68a;
        border-radius: 999px;
        color: ${colors.amber600};
        padding: 3px 8px;
      }
      .activity__description {
        color: ${colors.slate600};
        font-size: 14px;
        line-height: 1.5;
        margin-top: 6px;
      }
      .budget-tip {
        background: ${colors.sky50};
        border: 1px solid #bae6fd;
        border-radius: 12px;
        margin-top: 12px;
        padding: 12px;
      }
      .budget-tip__label {
        color: ${colors.sky600};
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .budget-tip__text {
        color: ${colors.slate700};
        font-size: 13px;
        font-weight: 700;
        line-height: 1.45;
        margin-top: 5px;
      }
      .budget-tip__chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .budget-tip__chips span {
        background: ${colors.white};
        border: 1px solid ${colors.slate300};
        border-radius: 10px;
        font-size: 12px;
        font-weight: 800;
        padding: 5px 8px;
      }
      .budget-tip__reason {
        color: ${colors.slate500};
        font-size: 12px;
        font-weight: 600;
        line-height: 1.45;
        margin-top: 8px;
      }
      .empty {
        background: ${colors.white};
        border: 1px solid ${colors.slate200};
        border-radius: 14px;
        color: ${colors.slate500};
        padding: 14px;
      }
      .raw pre {
        background: ${colors.slate50};
        border: 1px solid ${colors.slate200};
        border-radius: 14px;
        color: ${colors.slate700};
        font-size: 12px;
        line-height: 1.45;
        padding: 14px;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <header>
      <div class="eyebrow">Saved trip itinerary</div>
      <h1>${escapeHtml(getTripDisplayTitle(trip))}</h1>
      <p class="meta">
        ${escapeHtml(getTripDestination(trip))}
        ${getTripDateRange(trip) ? ` | ${escapeHtml(getTripDateRange(trip))}` : ""}
        | Exported ${escapeHtml(exportedDate)}
      </p>
    </header>
    ${renderBudgetSummary(trip)}
    ${hasStructuredDays ? renderStructuredTrip(trip) : renderRawFallback(trip)}
  </body>
</html>`;
}
