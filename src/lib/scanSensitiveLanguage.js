const fs = require("fs");
const path = require("path");

let cachedTerms = null;
let cachedMtime = null;

function defaultTermsPath() {
  return path.join(__dirname, "..", "..", "config", "sensitive-terms.json");
}

function loadTermsFromFile(filePath = defaultTermsPath()) {
  try {
    const stat = fs.statSync(filePath);
    if (cachedTerms !== null && cachedMtime === stat.mtimeMs) {
      return cachedTerms;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    const list = Array.isArray(data.terms) ? data.terms.map((t) => String(t).trim()).filter(Boolean) : [];
    cachedTerms = list;
    cachedMtime = stat.mtimeMs;
    return list;
  } catch {
    return [];
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** @param {string} str */
function tokenize(str) {
  if (!str || typeof str !== "string") return [];
  return str.toLowerCase().match(/[\p{L}\p{M}]+/gu) || [];
}

/**
 * @param {string} phrase space-separated, lowercased
 * @param {string} field
 */
function phraseMatchesField(phrase, field) {
  if (!field) return false;
  const parts = phrase.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return false;
  const re = new RegExp(`(?:^|\\s)${parts.map(escapeRegex).join("\\s+")}(?:\\s|$)`, "iu");
  return re.test(field);
}

/**
 * @param {string} word single token, lowercased
 * @param {string[]} tokens
 */
function wordInTokens(word, tokens) {
  const set = new Set(tokens);
  return set.has(word);
}

/**
 * Scan title and text for whole-word / whole-phrase matches against a term list.
 * @param {{ title?: string, text?: string, terms?: string[], termsPath?: string }} opts
 * @returns {{ matchedTerms: string[], locations: { title: number, text: number } }}
 */
function scanSensitiveLanguage(opts = {}) {
  const title = opts.title ?? "";
  const text = opts.text ?? "";
  let terms;
  if (Array.isArray(opts.terms) && opts.terms.length > 0) {
    terms = opts.terms.map((t) => String(t).trim()).filter(Boolean);
  } else if (opts.termsPath) {
    terms = loadTermsFromFile(opts.termsPath);
  } else {
    terms = loadTermsFromFile();
  }

  const titleLower = title.toLowerCase();
  const textLower = text.toLowerCase();
  const titleTokens = tokenize(title);
  const textTokens = tokenize(text);

  const matched = new Set();
  let titleHits = 0;
  let textHits = 0;

  for (const raw of terms) {
    const t = raw.toLowerCase();
    const parts = t.split(/\s+/).filter(Boolean);
    if (parts.length === 0) continue;

    let inTitle = false;
    let inText = false;

    if (parts.length === 1) {
      const w = parts[0];
      inTitle = wordInTokens(w, titleTokens);
      inText = wordInTokens(w, textTokens);
    } else {
      const phrase = parts.join(" ");
      inTitle = phraseMatchesField(phrase, titleLower);
      inText = phraseMatchesField(phrase, textLower);
    }

    if (inTitle || inText) {
      matched.add(raw);
      if (inTitle) titleHits += 1;
      if (inText) textHits += 1;
    }
  }

  return {
    matchedTerms: [...matched].sort(),
    locations: { title: titleHits, text: textHits },
  };
}

function clearTermsCache() {
  cachedTerms = null;
  cachedMtime = null;
}

module.exports = {
  scanSensitiveLanguage,
  loadTermsFromFile,
  tokenize,
  clearTermsCache,
};
