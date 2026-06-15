import type { BudgetRecommendation, SavedTrip } from "../services/api";
import { colors } from "../theme/designSystem";
import { inferActivityCategoryMeta } from "./activityMeta";
import {
  getVisibleBudgetOptimizationSavings,
  mapBudgetRecommendationsToActivityKeys,
} from "./budgetOptimization";

const EURO_HTML = "&#8364;";
const KNOWN_TRIP_DATA_KEYS = new Set([
  "destination",
  "days",
  "currency",
  "total_estimated_cost_eur",
  "start_date",
  "end_date",
  "budget_eur",
  "budget_optimization",
]);

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

function countDaysFromDates(trip: SavedTrip) {
  const startDate =
    typeof trip.trip_data.start_date === "string"
      ? parseLocalDate(trip.trip_data.start_date)
      : null;
  const endDate =
    typeof trip.trip_data.end_date === "string"
      ? parseLocalDate(trip.trip_data.end_date)
      : null;

  if (!startDate || !endDate) {
    return null;
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return days > 0 ? days : null;
}

function getTripDurationLabel(trip: SavedTrip) {
  const days = Array.isArray(trip.trip_data.days)
    ? trip.trip_data.days.length
    : countDaysFromDates(trip);

  if (!days) {
    return "Unknown duration";
  }

  return `${days} ${days === 1 ? "day" : "days"}`;
}

function renderMoney(value?: number | null) {
  return typeof value === "number" ? `${EURO_HTML}${escapeHtml(value)}` : null;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFieldName(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderUnknownValue(value: unknown) {
  if (value === null || value === undefined) {
    return "Not set";
  }

  if (typeof value === "string" || typeof value === "number") {
    return escapeHtml(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}

function getAdditionalTripDataEntries(trip: SavedTrip) {
  return Object.entries(trip.trip_data).filter(
    ([key, value]) =>
      !KNOWN_TRIP_DATA_KEYS.has(key) &&
      value !== undefined &&
      value !== null &&
      value !== ""
  );
}

function renderInlineBudgetTip(recommendation?: BudgetRecommendation) {
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
    <section class="inline-tip">
      <div class="inline-tip__label">Budget optimization tip</div>
      ${
        alternative
          ? `<p class="inline-tip__text">${escapeHtml(alternative)}</p>`
          : ""
      }
      <div class="money-row">
        ${originalCost ? `<span class="money-chip original-cost">Original ${originalCost}</span>` : ""}
        ${
          alternativeCost
            ? `<span class="money-chip alt-cost">Alt cost ${alternativeCost}</span>`
            : ""
        }
        ${savings ? `<span class="money-chip savings">Save ${savings}</span>` : ""}
      </div>
      ${
        recommendation.reason
          ? `<p class="inline-tip__reason">${escapeHtml(
              recommendation.reason
            )}</p>`
          : ""
      }
    </section>
  `;
}

function renderActivityCost(value?: number | null) {
  const money = renderMoney(value);
  return money ? `<span class="activity-price">${money}</span>` : "";
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
        <article class="schedule-item">
          <div class="schedule-time">
            ${activity.time_slot ? escapeHtml(activity.time_slot) : "Time not set"}
          </div>
          <div class="schedule-main">
            <div class="activity-row">
              <span class="activity-category">${escapeHtml(category.label)}</span>
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
            ${renderInlineBudgetTip(recommendation)}
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
              <div class="eyebrow">Daily schedule</div>
              <h2>Day ${escapeHtml(day.day_number || dayIndex + 1)}</h2>
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

function renderOverview(trip: SavedTrip, exportedDate: string) {
  const hasCost =
    Array.isArray(trip.trip_data.days) &&
    trip.trip_data.days.length > 0 &&
    (trip.trip_data.total_estimated_cost_eur !== undefined ||
      trip.trip_data.budget_eur !== undefined);

  const totalCost = getTripTotalCost(trip);
  const budget = getTripBudget(trip);
  const savings = getVisibleBudgetOptimizationSavings(
    trip.trip_data.days,
    trip.trip_data.budget_optimization
  );
  const finalCostWithAlternatives =
    typeof savings === "number" && savings > 0
      ? Math.max(totalCost - savings, 0)
      : null;
  const dateRange = getTripDateRange(trip);
  const createdAt = formatDateTime(trip.created_at);
  const updatedAt = formatDateTime(trip.updated_at);

  return `
    <section class="overview">
      <div class="overview-grid">
        <div class="fact-card">
          <span>Destination</span>
          <strong>${escapeHtml(getTripDestination(trip))}</strong>
        </div>
        <div class="fact-card">
          <span>Dates</span>
          <strong>${escapeHtml(dateRange ?? "Dates not set")}</strong>
        </div>
        <div class="fact-card">
          <span>Duration</span>
          <strong>${escapeHtml(getTripDurationLabel(trip))}</strong>
        </div>
        <div class="fact-card">
          <span>Currency</span>
          <strong>${escapeHtml(trip.trip_data.currency ?? "EUR")}</strong>
        </div>
      </div>

      ${
        hasCost
          ? `<div class="budget-strip">
              <div>
                <span>Total activity cost</span>
                <strong class="price">${EURO_HTML}${escapeHtml(totalCost)}</strong>
                ${
                  finalCostWithAlternatives !== null
                    ? `<small class="final-cost">Final cost with alternatives <span>${EURO_HTML}${escapeHtml(
                        finalCostWithAlternatives
                      )}</span></small>`
                    : ""
                }
              </div>
              ${
                budget !== null
                  ? `<div>
                      <span>Trip budget</span>
                      <strong class="price">${EURO_HTML}${escapeHtml(budget)}</strong>
                    </div>`
                  : ""
              }
              ${
                typeof savings === "number" && savings > 0
                  ? `<div>
                      <span>Estimated savings with alternatives</span>
                      <strong class="saving-value">${EURO_HTML}${escapeHtml(savings)}</strong>
                    </div>`
                  : ""
              }
            </div>`
          : ""
      }

      <div class="metadata">
        ${createdAt ? `<span>Saved ${escapeHtml(createdAt)}</span>` : ""}
        ${updatedAt ? `<span>Updated ${escapeHtml(updatedAt)}</span>` : ""}
        <span>Exported ${escapeHtml(exportedDate)}</span>
      </div>
    </section>
  `;
}

function renderAdditionalTripDetails(trip: SavedTrip) {
  const entries = getAdditionalTripDataEntries(trip);

  if (!entries.length) {
    return "";
  }

  return `
    <section class="appendix">
      <div class="section-heading">
        <div class="eyebrow">Saved trip data</div>
        <h2>Additional saved trip details</h2>
      </div>
      <dl class="details-list">
        ${entries
          .map(
            ([key, value]) => `
              <div>
                <dt>${escapeHtml(formatFieldName(key))}</dt>
                <dd>${renderUnknownValue(value)}</dd>
              </div>
            `
          )
          .join("")}
      </dl>
    </section>
  `;
}

function renderFallbackDetails(trip: SavedTrip) {
  return `
    <section class="appendix fallback">
      <div class="section-heading">
        <div class="eyebrow">Saved trip data</div>
        <h2>Itinerary details</h2>
      </div>
      <p class="fallback-text">
        This saved trip does not include structured daily activities. The available saved details are shown below.
      </p>
      <dl class="details-list">
        ${Object.entries(trip.trip_data)
          .map(
            ([key, value]) => `
              <div>
                <dt>${escapeHtml(formatFieldName(key))}</dt>
                <dd>${renderUnknownValue(value)}</dd>
              </div>
            `
          )
          .join("")}
      </dl>
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
      @page { size: A4; margin: 32px; }
      body {
        background: ${colors.white};
        color: ${colors.slate900};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 0;
        padding: 0;
      }
      header {
        background: ${colors.slate900};
        border-radius: 18px;
        color: ${colors.white};
        margin-bottom: 24px;
        padding: 28px 30px;
      }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 32px; line-height: 1.15; margin-top: 6px; }
      h2 { color: ${colors.slate900}; font-size: 23px; line-height: 1.25; }
      h3 { color: ${colors.slate900}; font-size: 15px; line-height: 1.35; }
      .eyebrow {
        color: ${colors.teal700};
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1px;
        text-transform: uppercase;
      }
      header .eyebrow { color: ${colors.teal100}; }
      .meta {
        color: ${colors.slate300};
        font-size: 13px;
        font-weight: 600;
        line-height: 1.5;
        margin-top: 10px;
      }
      .overview {
        margin-bottom: 24px;
      }
      .overview-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(4, 1fr);
        margin-bottom: 14px;
      }
      .fact-card {
        background: ${colors.slate50};
        border: 1px solid ${colors.slate200};
        border-radius: 14px;
        padding: 13px;
      }
      .fact-card span,
      .budget-strip span,
      .metadata span,
      .recommendation__header span {
        color: ${colors.slate500};
        display: block;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.6px;
        text-transform: uppercase;
      }
      .fact-card strong {
        color: ${colors.slate900};
        display: block;
        font-size: 14px;
        line-height: 1.3;
        margin-top: 5px;
      }
      .budget-strip {
        background: ${colors.teal50};
        border: 1px solid ${colors.teal200};
        border-radius: 16px;
        display: flex;
        gap: 18px;
        justify-content: space-between;
        margin-bottom: 12px;
        padding: 15px 16px;
      }
      .budget-strip div { flex: 1; }
      .price,
      .activity-price {
        color: ${colors.amber600};
        font-weight: 800;
      }
      .saving-value,
      .savings {
        color: ${colors.teal700};
        font-weight: 800;
      }
      .budget-strip strong {
        display: block;
        font-size: 18px;
        margin-top: 4px;
      }
      .final-cost {
        color: ${colors.teal700};
        display: block;
        font-size: 12px;
        font-weight: 800;
        line-height: 1.35;
        margin-top: 5px;
      }
      .final-cost span {
        color: ${colors.amber600};
      }
      .metadata {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .day {
        break-before: page;
        page-break-before: always;
      }
      .day__header {
        border-bottom: 2px solid ${colors.teal600};
        display: flex;
        justify-content: space-between;
        margin-bottom: 18px;
        padding-bottom: 10px;
      }
      .day__header p {
        color: ${colors.slate500};
        font-size: 13px;
        font-weight: 700;
      }
      .schedule-item {
        border-bottom: 1px solid ${colors.slate200};
        display: flex;
        gap: 16px;
        padding: 14px 0;
      }
      .schedule-time {
        color: ${colors.teal700};
        font-size: 13px;
        font-weight: 800;
        line-height: 1.4;
        width: 104px;
      }
      .schedule-main { flex: 1; }
      .activity-row {
        color: ${colors.teal700};
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .activity-category {
        color: ${colors.sky600};
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .activity-price {
        background: ${colors.amber50};
        border: 1px solid #fde68a;
        border-radius: 999px;
        padding: 3px 8px;
      }
      .activity__description {
        color: ${colors.slate600};
        font-size: 14px;
        line-height: 1.5;
        margin-top: 6px;
      }
      .inline-tip {
        background: ${colors.sky50};
        border: 1px solid #bae6fd;
        border-radius: 12px;
        margin-top: 12px;
        padding: 12px;
      }
      .inline-tip__label {
        color: ${colors.sky600};
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .inline-tip__text,
      .recommendation__text {
        color: ${colors.slate700};
        font-size: 13px;
        font-weight: 700;
        line-height: 1.45;
        margin-top: 5px;
      }
      .money-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .money-chip {
        background: ${colors.white};
        border: 1px solid ${colors.slate300};
        border-radius: 10px;
        font-size: 12px;
        font-weight: 800;
        padding: 5px 8px;
      }
      .original-cost { color: ${colors.slate500}; }
      .alt-cost { color: ${colors.amber600}; }
      .inline-tip__reason,
      .fallback-text {
        color: ${colors.slate500};
        font-size: 12px;
        font-weight: 600;
        line-height: 1.45;
        margin-top: 8px;
      }
      .appendix {
        break-before: page;
        page-break-before: always;
      }
      .section-heading {
        border-bottom: 2px solid ${colors.slate200};
        margin-bottom: 14px;
        padding-bottom: 10px;
      }
      .details-list {
        display: grid;
        gap: 10px;
        grid-template-columns: 1fr 1fr;
        margin: 0;
      }
      .details-list div {
        background: ${colors.slate50};
        border: 1px solid ${colors.slate200};
        border-radius: 12px;
        padding: 12px;
      }
      .details-list dt {
        color: ${colors.teal700};
        font-size: 11px;
        font-weight: 800;
        margin-bottom: 5px;
        text-transform: uppercase;
      }
      .details-list dd {
        color: ${colors.slate700};
        font-size: 13px;
        line-height: 1.45;
        margin: 0;
      }
      .empty {
        background: ${colors.white};
        border: 1px solid ${colors.slate200};
        border-radius: 14px;
        color: ${colors.slate500};
        padding: 14px;
      }
      pre {
        background: ${colors.slate50};
        border-radius: 8px;
        color: ${colors.slate700};
        font-size: 11px;
        line-height: 1.45;
        margin: 0;
        padding: 8px;
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
    ${renderOverview(trip, exportedDate)}
    ${hasStructuredDays ? renderStructuredTrip(trip) : renderFallbackDetails(trip)}
    ${hasStructuredDays ? renderAdditionalTripDetails(trip) : ""}
  </body>
</html>`;
}
