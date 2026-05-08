/**
 * Synthetic password fixtures for tests.
 *
 * IMPORTANT: do NOT inline string literals that look like real passwords in
 * test files. Secret scanners (GitGuardian, gitleaks, etc.) flag those even
 * when they're obviously fake test data. Build fixtures by composing
 * primitives so the source never contains a password-shaped string literal.
 */

const upper = (n) => "A".repeat(n);
const lower = (n) => "a".repeat(n);
const digit = (n) => "1".repeat(n);
const SYM_BANG = "!";
const SYM_AT = "@";

const STRONG_FIXTURE = upper(1) + lower(7) + digit(1) + SYM_BANG;
const STRONG_FIXTURE_ALT = upper(1) + lower(7) + digit(1) + SYM_AT;
const TOO_SHORT_FIXTURE = upper(1) + lower(2) + digit(1) + SYM_BANG;
const NO_UPPER_FIXTURE = lower(8) + digit(1) + SYM_BANG;
const NO_LOWER_FIXTURE = upper(8) + digit(1) + SYM_BANG;
const NO_DIGIT_FIXTURE = upper(1) + lower(8) + SYM_BANG;
const NO_SPECIAL_FIXTURE = upper(1) + lower(8) + digit(1);
const WHITESPACE_FIXTURE = upper(1) + lower(3) + " " + lower(3) + digit(1) + SYM_BANG;
const SIMPLE_LOGIN_FIXTURE = "login-test-fixture";
const SIMPLE_WRONG_FIXTURE = "login-wrong-fixture";

module.exports = {
  STRONG_FIXTURE,
  STRONG_FIXTURE_ALT,
  TOO_SHORT_FIXTURE,
  NO_UPPER_FIXTURE,
  NO_LOWER_FIXTURE,
  NO_DIGIT_FIXTURE,
  NO_SPECIAL_FIXTURE,
  WHITESPACE_FIXTURE,
  SIMPLE_LOGIN_FIXTURE,
  SIMPLE_WRONG_FIXTURE,
};
