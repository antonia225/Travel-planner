import React, { useMemo, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react-native";

import AppCard from "./AppCard";
import CustomInput from "./CustomInput";
import PrimaryButton from "./PrimaryButton";
import SectionHeader from "./SectionHeader";
import { colors, radius, shadows, spacing } from "../theme/designSystem";

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

  const renderDateField = (label: string, value: string, field: DateField) => {
    const error = errors[field];

    return (
      <View style={styles.dateField}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity
          style={[styles.dateButton, error ? styles.inputError : null]}
          activeOpacity={0.8}
          onPress={() => openCalendar(field)}
        >
          <CalendarDays color={colors.teal700} size={18} strokeWidth={2.3} />
          <Text style={styles.dateButtonText}>{value}</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  };

  return (
    <AppCard elevated style={styles.card}>
      <SectionHeader eyebrow="AI planner" title="Plan a new trip" />

      <CustomInput
        label="Destination"
        error={errors.destination}
        placeholder="e.g. Paris, Rome, Tokyo"
        value={destination}
        onChangeText={setDestination}
        autoCapitalize="words"
        containerStyle={styles.field}
      />

      <View style={styles.fieldRow}>
        {renderDateField("Start Date", startDate, "startDate")}
        {renderDateField("End Date", endDate, "endDate")}
      </View>

      <View style={styles.fieldRow}>
        <CustomInput
          label="Travelers"
          error={errors.travelers}
          placeholder="2"
          value={travelers}
          onChangeText={setTravelers}
          keyboardType="number-pad"
          containerStyle={styles.splitField}
        />
        <CustomInput
          label="Budget"
          error={errors.budget}
          placeholder="800"
          value={budget}
          onChangeText={setBudget}
          keyboardType="numeric"
          containerStyle={styles.splitField}
        />
      </View>

      <PrimaryButton
        title="Generate Trip"
        icon={<Sparkles color={colors.white} size={18} strokeWidth={2.4} />}
        onPress={handleSubmit}
        style={styles.submitButton}
      />

      <Modal
        visible={activeDateField !== null}
        transparent
        animationType="fade"
        onRequestClose={closeCalendar}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                style={styles.arrowButton}
                activeOpacity={0.8}
                onPress={goToPreviousMonth}
              >
                <ChevronLeft color={colors.slate700} size={22} strokeWidth={2.6} />
              </TouchableOpacity>

              <Text style={styles.monthTitle}>
                {MONTH_NAMES[displayedMonth.getMonth()]}{" "}
                {displayedMonth.getFullYear()}
              </Text>

              <TouchableOpacity
                style={styles.arrowButton}
                activeOpacity={0.8}
                onPress={goToNextMonth}
              >
                <ChevronRight color={colors.slate700} size={22} strokeWidth={2.6} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEK_DAYS.map((day) => (
                <Text key={day} style={styles.weekDay}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
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
                      styles.dayCell,
                      isSelected ? styles.selectedDayCell : null,
                      isToday && !isSelected ? styles.todayDayCell : null,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => chooseDay(day)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isSelected ? styles.selectedDayText : null,
                        isToday && !isSelected ? styles.todayDayText : null,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.selectedDateText}>
              Selected date: {formatDate(selectedDate)}
            </Text>

            <View style={styles.modalButtons}>
              <PrimaryButton
                title="Cancel"
                variant="secondary"
                onPress={closeCalendar}
                style={styles.modalButton}
              />
              <PrimaryButton
                title="Confirm"
                onPress={confirmDate}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
  },
  field: {
    marginBottom: spacing.lg,
  },
  fieldRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  splitField: {
    flex: 1,
  },
  dateField: {
    flex: 1,
  },
  label: {
    color: colors.slate500,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  dateButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dateButtonText: {
    color: colors.slate900,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  inputError: {
    borderColor: colors.redBorder,
  },
  errorText: {
    color: colors.red500,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 6,
  },
  submitButton: {
    marginTop: spacing.xs,
    minHeight: 56,
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  calendarCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    maxWidth: 420,
    padding: spacing.xl,
    width: "100%",
    ...shadows.card,
  },
  calendarHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  arrowButton: {
    alignItems: "center",
    backgroundColor: colors.slate100,
    borderRadius: radius.lg,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  monthTitle: {
    color: colors.slate900,
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  weekDay: {
    color: colors.slate400,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    width: `${100 / 7}%`,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    alignItems: "center",
    borderRadius: radius.lg,
    height: 42,
    justifyContent: "center",
    marginBottom: spacing.xs,
    width: `${100 / 7}%`,
  },
  selectedDayCell: {
    backgroundColor: colors.teal600,
  },
  todayDayCell: {
    backgroundColor: colors.teal50,
  },
  dayText: {
    color: colors.slate700,
    fontSize: 15,
    fontWeight: "700",
  },
  selectedDayText: {
    color: colors.white,
  },
  todayDayText: {
    color: colors.teal700,
  },
  selectedDateText: {
    color: colors.slate500,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
  },
});
