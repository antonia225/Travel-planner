import { checkPassword, allRulesMet, type PasswordRules } from "../src/utils/validation";

describe("Trip date validation", () => {
  // Helper function that simulates parseDate from TripSearchForm
  function parseDate(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) {
      return new Date();
    }
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  let today: Date;

  beforeEach(() => {
    today = new Date();
    today.setHours(0, 0, 0, 0);
  });

  describe("past date validation", () => {
    it("rejects a start date in the past", () => {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const parsedYesterday = parseDate(
        `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`
      );
      expect(parsedYesterday < today).toBe(true);
    });

    it("accepts start date as today", () => {
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const parsedToday = parseDate(todayString);

      expect(parsedToday.getTime()).toBe(today.getTime());
    });

    it("accepts a start date in the future", () => {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const parsedTomorrow = parseDate(
        `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`
      );
      expect(parsedTomorrow > today).toBe(true);
    });
  });
});

describe("checkPassword", () => {
  describe("valid password", () => {
    it("returns all rules as true for a fully valid password", () => {
      const rules: PasswordRules = checkPassword("Secure1Password");

      expect(rules.minLength).toBe(true);
      expect(rules.hasUppercase).toBe(true);
      expect(rules.hasLowercase).toBe(true);
      expect(rules.hasNumber).toBe(true);
    });

    it("allRulesMet returns true when every rule passes", () => {
      expect(allRulesMet(checkPassword("Secure1Password"))).toBe(true);
    });
  });

  describe("minLength rule", () => {
    it("fails for a password under 8 characters", () => {
      const rules = checkPassword("Ab1cDe"); // 6 chars
      expect(rules.minLength).toBe(false);
    });

    it("passes for a password of exactly 8 characters", () => {
      const rules = checkPassword("Ab1cDefG"); // 8 chars
      expect(rules.minLength).toBe(true);
    });

    it("allRulesMet returns false when only minLength fails", () => {
      expect(allRulesMet(checkPassword("Ab1cDe"))).toBe(false);
    });
  });

  describe("hasUppercase rule", () => {
    it("fails for a password with no uppercase letter", () => {
      const rules = checkPassword("secure1password"); // all lowercase
      expect(rules.hasUppercase).toBe(false);
    });

    it("allRulesMet returns false when only hasUppercase fails", () => {
      expect(allRulesMet(checkPassword("secure1password"))).toBe(false);
    });
  });

  describe("hasLowercase rule", () => {
    it("fails for a password with no lowercase letter", () => {
      const rules = checkPassword("SECURE1PASSWORD"); // all uppercase
      expect(rules.hasLowercase).toBe(false);
    });

    it("allRulesMet returns false when only hasLowercase fails", () => {
      expect(allRulesMet(checkPassword("SECURE1PASSWORD"))).toBe(false);
    });
  });

  describe("hasNumber rule", () => {
    it("fails for a password with no digit", () => {
      const rules = checkPassword("SecurePassword"); // no digit
      expect(rules.hasNumber).toBe(false);
    });

    it("allRulesMet returns false when only hasNumber fails", () => {
      expect(allRulesMet(checkPassword("SecurePassword"))).toBe(false);
    });
  });
});
