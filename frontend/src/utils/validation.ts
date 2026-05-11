/**
 * Password validation utilities shared between the UI and unit tests.
 */

export type PasswordRules = {
  /** Password is at least 8 characters long. */
  minLength: boolean;
  /** Password contains at least one uppercase letter (A–Z). */
  hasUppercase: boolean;
  /** Password contains at least one lowercase letter (a–z). */
  hasLowercase: boolean;
  /** Password contains at least one digit (0–9). */
  hasNumber: boolean;
};

/**
 * Evaluate a password against all strength rules and return a per-rule
 * boolean map.
 */
export function checkPassword(pw: string): PasswordRules {
  return {
    minLength:    pw.length >= 8,
    hasUppercase: /[A-Z]/.test(pw),
    hasLowercase: /[a-z]/.test(pw),
    hasNumber:    /[0-9]/.test(pw),
  };
}

/**
 * Returns `true` only when every rule in the map is satisfied.
 */
export function allRulesMet(rules: PasswordRules): boolean {
  return Object.values(rules).every(Boolean);
}
