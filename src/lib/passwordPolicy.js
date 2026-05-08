const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 128;
const SPECIAL_CHAR_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

/**
 * Validates a candidate password against SPORA's signup policy.
 * Returns an error message string when the password is too weak,
 * or `null` when it satisfies every rule.
 */
function validatePassword(password) {
  if (typeof password !== "string") {
    return "Password is required.";
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/\d/.test(password)) {
    return "Password must include at least one number.";
  }
  if (!SPECIAL_CHAR_PATTERN.test(password)) {
    return "Password must include at least one special character (e.g. ! @ # $ %).";
  }
  if (/\s/.test(password)) {
    return "Password must not contain spaces.";
  }
  return null;
}

module.exports = {
  validatePassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
};
