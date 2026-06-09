import React, { useMemo, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type TripSearchData = {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budget: number;
};

type Props = {
  onSubmit?: (data: TripSearchData) => void;
};

type DateField = "startDate" | "endDate";

const C = {
  teal700: "#0f766e",
  teal600: "#0d9488",
  teal50: "#f0fdfa",
  slate900: "#0f172a",
  slate700: "#334155",
  slate500: "#64748b",
  slate400: "#94a3b8",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
  white: "#ffffff",
  red400: "#f87171",
  red500: "#ef4444",
  blackTransparent: "rgba(0, 0, 0, 0.4)",
};

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date();
  }

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function areSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function isAfter(firstDate: string, secondDate: string) {
  return parseDate(firstDate).getTime() > parseDate(secondDate).getTime();
}

function getCalendarDays(displayedMonth: Date) {
  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const leadingEmptyDays = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const days: Array<number | null> = [];

  for (let i = 0; i < leadingEmptyDays; i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(day);
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

export default function TripSearchForm({ onSubmit }: Props) {
  const today = useMemo(() => new Date(), []);
  const defaultStartDate = useMemo(() => addDays(today, 1), [today]);

  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState(formatDate(defaultStartDate));
  const [endDate, setEndDate] = useState(formatDate(addDays(defaultStartDate, 3)));
  const [travelers, setTravelers] = useState("1");
  const [budget, setBudget] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeDateField, setActiveDateField] = useState<DateField | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [displayedMonth, setDisplayedMonth] = useState(new Date());

  const calendarDays = getCalendarDays(displayedMonth);

  const openCalendar = (field: DateField) => {
    const currentDate = parseDate(field === "startDate" ? startDate : endDate);

    setActiveDateField(field);
    setSelectedDate(currentDate);
    setDisplayedMonth(
      new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    );
  };

  const closeCalendar = () => {
    setActiveDateField(null);
  };

  const goToPreviousMonth = () => {
    setDisplayedMonth(
      new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    setDisplayedMonth(
      new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1)
    );
  };

  const chooseDay = (day: number) => {
    setSelectedDate(
      new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), day)
    );
  };

  const confirmDate = () => {
    const chosenDate = formatDate(selectedDate);

    if (activeDateField === "startDate") {
      setStartDate(chosenDate);

      if (isAfter(chosenDate, endDate)) {
        setEndDate(chosenDate);
      }
    }

    if (activeDateField === "endDate") {
      setEndDate(chosenDate);
    }

    closeCalendar();
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const parsedTravelers = Number(travelers);
    const parsedBudget = Number(budget);

    if (!destination.trim()) {
      nextErrors.destination = "Please enter a destination.";
    }

    if (parseDate(startDate) < today) {
      nextErrors.startDate = "Start date cannot be in the past.";
    }

    if (isAfter(startDate, endDate)) {
      nextErrors.endDate = "End date must be after start date.";
    }

    if (!Number.isInteger(parsedTravelers) || parsedTravelers < 1) {
      nextErrors.travelers = "Enter at least 1 traveler.";
    }

    if (!budget.trim() || Number.isNaN(parsedBudget) || parsedBudget <= 0) {
      nextErrors.budget = "Enter a valid budget.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    const tripData: TripSearchData = {
      destination: destination.trim(),
      startDate,
      endDate,
      travelers: Number(travelers),
      budget: Number(budget),
    };

    console.log("Trip search data:", tripData);
    onSubmit?.(tripData);
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>Plan a new trip</Text>

      <Text style={s.subtitle}>
        Fill in your travel details so the AI planner can generate a personalized
        itinerary.
      </Text>

      <View style={s.field}>
        <Text style={s.label}>Destination</Text>
        <TextInput
          style={[s.input, errors.destination ? s.inputError : null]}
          placeholder="e.g. Paris, Rome, Tokyo"
          placeholderTextColor={C.slate400}
          value={destination}
          onChangeText={setDestination}
          autoCapitalize="words"
        />
        {errors.destination ? (
          <Text style={s.errorText}>{errors.destination}</Text>
        ) : null}
      </View>

      <View style={s.field}>
        <Text style={s.label}>Start Date</Text>
        <TouchableOpacity
          style={s.dateButton}
          activeOpacity={0.75}
          onPress={() => openCalendar("startDate")}
        >
          <Text style={s.dateButtonText}>{startDate}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.field}>
        <Text style={s.label}>End Date</Text>
        <TouchableOpacity
          style={[s.dateButton, errors.endDate ? s.inputError : null]}
          activeOpacity={0.75}
          onPress={() => openCalendar("endDate")}
        >
          <Text style={s.dateButtonText}>{endDate}</Text>
        </TouchableOpacity>
        {errors.endDate ? <Text style={s.errorText}>{errors.endDate}</Text> : null}
      </View>

      <View style={s.field}>
        <Text style={s.label}>Travelers</Text>
        <TextInput
          style={[s.input, errors.travelers ? s.inputError : null]}
          placeholder="e.g. 2"
          placeholderTextColor={C.slate400}
          value={travelers}
          onChangeText={setTravelers}
          keyboardType="number-pad"
        />
        {errors.travelers ? (
          <Text style={s.errorText}>{errors.travelers}</Text>
        ) : null}
      </View>

      <View style={s.field}>
        <Text style={s.label}>Budget</Text>
        <TextInput
          style={[s.input, errors.budget ? s.inputError : null]}
          placeholder="e.g. 800"
          placeholderTextColor={C.slate400}
          value={budget}
          onChangeText={setBudget}
          keyboardType="numeric"
        />
        {errors.budget ? <Text style={s.errorText}>{errors.budget}</Text> : null}
      </View>

      <TouchableOpacity
        style={s.submitButton}
        activeOpacity={0.8}
        onPress={handleSubmit}
      >
        <Text style={s.submitButtonText}>Search AI trip ideas</Text>
      </TouchableOpacity>

      <Modal
        visible={activeDateField !== null}
        transparent
        animationType="fade"
        onRequestClose={closeCalendar}
      >
        <View style={s.modalOverlay}>
          <View style={s.calendarCard}>
            <View style={s.calendarHeader}>
              <TouchableOpacity style={s.arrowButton} onPress={goToPreviousMonth}>
                <Text style={s.arrowText}>‹</Text>
              </TouchableOpacity>

              <Text style={s.monthTitle}>
                {MONTH_NAMES[displayedMonth.getMonth()]}{" "}
                {displayedMonth.getFullYear()}
              </Text>

              <TouchableOpacity style={s.arrowButton} onPress={goToNextMonth}>
                <Text style={s.arrowText}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={s.weekRow}>
              {WEEK_DAYS.map((day) => (
                <Text key={day} style={s.weekDay}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={s.daysGrid}>
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={s.dayCell} />;
                }

                const currentDate = new Date(
                  displayedMonth.getFullYear(),
                  displayedMonth.getMonth(),
                  day
                );

                const isSelected = areSameDay(currentDate, selectedDate);
                const isToday = areSameDay(currentDate, today);

                return (
                  <TouchableOpacity
                    key={`${displayedMonth.getMonth()}-${day}`}
                    style={[
                      s.dayCell,
                      isSelected ? s.selectedDayCell : null,
                      isToday && !isSelected ? s.todayDayCell : null,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => chooseDay(day)}
                  >
                    <Text
                      style={[
                        s.dayText,
                        isSelected ? s.selectedDayText : null,
                        isToday && !isSelected ? s.todayDayText : null,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.selectedDateText}>
              Selected date: {formatDate(selectedDate)}
            </Text>

            <View style={s.modalButtons}>
              <TouchableOpacity style={s.cancelButton} onPress={closeCalendar}>
                <Text style={s.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.confirmButton} onPress={confirmDate}>
                <Text style={s.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.slate50,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  title: {
    color: C.slate900,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    color: C.slate500,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    marginBottom: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: C.slate400,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: C.slate900,
    fontSize: 16,
    fontWeight: "500",
  },
  dateButton: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dateButtonText: {
    color: C.slate900,
    fontSize: 16,
    fontWeight: "600",
  },
  inputError: {
    borderColor: C.red400,
  },
  errorText: {
    color: C.red500,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 6,
  },
  submitButton: {
    backgroundColor: C.teal600,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  submitButtonText: {
    color: C.white,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: C.blackTransparent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  calendarCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: C.white,
    borderRadius: 24,
    padding: 20,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  arrowButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.slate100,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: {
    color: C.slate900,
    fontSize: 32,
    fontWeight: "600",
    marginTop: -2,
  },
  monthTitle: {
    color: C.slate900,
    fontSize: 18,
    fontWeight: "800",
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekDay: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: C.slate400,
    fontSize: 12,
    fontWeight: "800",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    marginBottom: 6,
  },
  selectedDayCell: {
    backgroundColor: C.teal600,
  },
  todayDayCell: {
    backgroundColor: C.teal50,
  },
  dayText: {
    color: C.slate700,
    fontSize: 15,
    fontWeight: "700",
  },
  selectedDayText: {
    color: C.white,
  },
  todayDayText: {
    color: C.teal700,
  },
  selectedDateText: {
    color: C.slate500,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: C.slate100,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginRight: 6,
  },
  cancelButtonText: {
    color: C.slate500,
    fontSize: 14,
    fontWeight: "800",
  },
  confirmButton: {
    flex: 1,
    backgroundColor: C.teal600,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginLeft: 6,
  },
  confirmButtonText: {
    color: C.white,
    fontSize: 14,
    fontWeight: "800",
  },
});
