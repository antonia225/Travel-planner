import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  BASE_URL,
  changeMyPassword,
  updateMyInterests,
  updateMyProfile,
} from "../services/api";

export interface User {
  id: number;
  email: string;
  name: string;
  interests: string[];
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (name: string, email: string) => Promise<void>;
  updateUserInterests: (interests: string[]) => Promise<void>;
  changeUserPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";
const REQUEST_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out. Please check your connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timerId);
  }
}

type RawUserProfile = {
  id: unknown;
  email: unknown;
  name: unknown;
  interests?: unknown;
};

function normalizeUserProfile(profile: RawUserProfile): User {
  const interests = Array.isArray(profile.interests)
    ? profile.interests.filter(
        (interest): interest is string => typeof interest === "string"
      )
    : [];

  return {
    id: Number(profile.id),
    email: String(profile.email ?? ""),
    name: String(profile.name ?? ""),
    interests,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved session on app startup
  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
      const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const savedUser = await AsyncStorage.getItem(USER_KEY);

      if (savedToken && savedUser) {
        const meResponse = await fetchWithTimeout(`${BASE_URL}/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });

        if (!meResponse.ok) {
          await AsyncStorage.removeItem(TOKEN_KEY);
          await AsyncStorage.removeItem(USER_KEY);
          return;
        }

        const meData = (await meResponse.json()) as RawUserProfile;
        const restoredUser = normalizeUserProfile(meData);

        setToken(savedToken);
        setUser(restoredUser);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(restoredUser));
      }
    } catch (e) {
      console.error("Failed to restore session:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.status === 200) {
        const data = await response.json();
        const newToken: string = data.access_token;

        const meResponse = await fetchWithTimeout(`${BASE_URL}/me`, {
          headers: { Authorization: `Bearer ${newToken}` },
        });
        if (!meResponse.ok) {
          throw new Error("Failed to fetch user profile after login");
        }
        const meData = await meResponse.json();
        const newUser: User = {
          id: meData.id as number,
          email: meData.email as string,
          name: meData.name as string,
          interests: Array.isArray(meData.interests) ? meData.interests : [],
        };

        setToken(newToken);
        setUser(newUser);

        await AsyncStorage.setItem(TOKEN_KEY, newToken);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
      } else if (response.status === 401) {
        throw new Error("Invalid email or password");
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { detail?: string }).detail || "Login failed"
        );
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (response.status === 201) {
        // Auto-login after successful registration
        await login(email, password);
      } else if (response.status === 409) {
        throw new Error("An account with this email already exists");
      } else {
        const errorData = await response.json().catch(() => ({}));
        const detail = (errorData as { detail?: unknown }).detail;
        // Pydantic 422 returns detail as an array of validation error objects
        const message =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
            ? detail.map((e: { msg?: string }) => e.msg ?? "").join("; ")
            : "Registration failed";
        throw new Error(message);
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      setToken(null);
      setUser(null);
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
    } catch (error) {
      console.error("Failed to logout:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserInterests = async (interests: string[]) => {
    if (!token) {
      throw new Error("Please log in again before updating your profile.");
    }

    const updatedProfile = await updateMyInterests(token, interests);
    const updatedUser = normalizeUserProfile(updatedProfile);

    setUser(updatedUser);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
  };

  const updateUserProfile = async (name: string, email: string) => {
    if (!token) {
      throw new Error("Please log in again before updating your profile.");
    }

    const updatedProfile = await updateMyProfile(token, name, email);
    const updatedUser = normalizeUserProfile(updatedProfile);

    setUser(updatedUser);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
  };

  const changeUserPassword = async (
    currentPassword: string,
    newPassword: string
  ) => {
    if (!token) {
      throw new Error("Please log in again before changing your password.");
    }

    await changeMyPassword(token, currentPassword, newPassword);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        updateUserProfile,
        updateUserInterests,
        changeUserPassword,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
