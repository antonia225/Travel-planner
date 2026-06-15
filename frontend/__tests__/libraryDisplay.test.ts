jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import {
  getTripDateRange,
  getTripDestination,
  getTripDisplayTitle,
  getTripDurationLabel,
} from "../src/screens/LibraryScreen";
import type { SavedTrip } from "../src/services/api";

function buildSavedTrip(overrides: Partial<SavedTrip> = {}): SavedTrip {
  return {
    id: 1,
    user_id: 1,
    name: "Paris spring",
    trip_data: {
      destination: "Paris",
      start_date: "2026-09-17",
      end_date: "2026-09-20",
      days: [{ day_number: 1 }, { day_number: 2 }, { day_number: 3 }, { day_number: 4 }],
    },
    created_at: "2026-06-14T12:00:00",
    updated_at: "2026-06-14T12:00:00",
    ...overrides,
  };
}

describe("library trip display helpers", () => {
  it("shows only the saved trip name as the displayed title", () => {
    const trip = buildSavedTrip();

    expect(getTripDisplayTitle(trip)).toBe("Paris spring");
    expect(getTripDateRange(trip)).toBe("Sep 17, 2026 - Sep 20, 2026");
  });

  it("shows duration clearly from saved itinerary days", () => {
    const trip = buildSavedTrip();

    expect(getTripDurationLabel(trip)).toBe("4 days");
  });

  it("falls back to dates for duration when itinerary days are missing", () => {
    const trip = buildSavedTrip({
      trip_data: {
        destination: "Paris",
        start_date: "2026-09-17",
        end_date: "2026-09-18",
      },
    });

    expect(getTripDurationLabel(trip)).toBe("2 days");
  });

  it("falls back gracefully when dates are missing", () => {
    const trip = buildSavedTrip({
      name: "Weekend idea",
      trip_data: {
        destination: "Generated trip",
      },
    });

    expect(getTripDateRange(trip)).toBeNull();
    expect(getTripDisplayTitle(trip)).toBe("Weekend idea");
    expect(getTripDestination(trip)).toBe("Generated trip");
    expect(getTripDurationLabel(trip)).toBe("Unknown duration");
  });
});
