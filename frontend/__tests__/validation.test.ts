import { checkPassword, allRulesMet, type PasswordRules } from "../src/utils/validation";

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
