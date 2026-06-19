import { Platform } from "react-native";

export const colors = {
  teal700: "#174e55",
  teal600: "#1f8f8a",
  teal200: "#a8d8d1",
  teal100: "#d7efea",
  teal50: "#f0faf7",
  tealBorder: "#8ccfc7",
  sky600: "#5475b8",
  sky50: "#f1f5ff",
  amber600: "#a26f2a",
  amber50: "#fff8e8",
  violet600: "#7956bf",
  violet50: "#f5f1ff",
  coral600: "#c65b4c",
  coral50: "#fff2ee",
  gold600: "#9b7432",
  gold100: "#ecd99f",
  ink: "#18313a",
  slate900: "#24343a",
  slate700: "#445860",
  slate600: "#607179",
  slate500: "#7b898e",
  slate400: "#a4adb1",
  slate300: "#cfd7d8",
  slate200: "#e2e7e5",
  slate100: "#f0f2ef",
  slate50: "#faf9f4",
  cream: "#fffaf0",
  linen: "#f6efe3",
  white: "#ffffff",
  red500: "#ef4444",
  red700: "#b91c1c",
  red50: "#fef2f2",
  redBorder: "#fca5a5",
  overlay: "rgba(8, 26, 36, 0.58)",
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  card: 18,
  sheet: 28,
  pill: 999,
};

export const spacing = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const shadows = {
  card: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.09,
    shadowRadius: 26,
    elevation: 5,
  },
  soft: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  glow: {
    shadowColor: colors.teal600,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4,
  },
};

export const typography = {
  displayFontFamily: Platform.select({
    ios: "Georgia",
    android: "serif",
    default: undefined,
  }),
  labelLetterSpacing: 1.2,
  buttonLetterSpacing: 0.4,
};
