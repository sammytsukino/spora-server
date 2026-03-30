const { scanSensitiveLanguage } = require("../lib/scanSensitiveLanguage");

const SOURCE = "language_screen";
const CATEGORY = "language_review";

function buildDescription(scan) {
  const payload = {
    matchedTerms: scan.matchedTerms,
    locations: scan.locations,
    scannedAt: new Date().toISOString(),
  };
  let description = JSON.stringify(payload);
  const maxLen = 1900;
  if (description.length > maxLen) {
    description = JSON.stringify({
      matchedTerms: scan.matchedTerms.slice(0, 40),
      locations: scan.locations,
      scannedAt: payload.scannedAt,
      truncated: true,
    });
  }
  return description;
}

/**
 * @param {import("mongoose").Model} Report
 * @param {"reportedFloraId"|"reportedFlora"} floraField
 * @param {import("mongoose").Types.ObjectId|string} floraId
 * @param {string} title
 * @param {string} text
 */
async function syncLanguageScreenReportWithModel(Report, floraField, floraId, title, text) {
  const scan = scanSensitiveLanguage({ title, text });
  const hasMatches = scan.matchedTerms.length > 0;
  const isLegacy = floraField === "reportedFlora";

  const pendingFilter = { [floraField]: floraId, source: SOURCE, status: "pending" };

  if (!hasMatches) {
    if (isLegacy) {
      await Report.updateMany(pendingFilter, {
        $set: {
          status: "dismissed",
          reviewedAt: new Date(),
          action: "none",
        },
      });
    } else {
      await Report.updateMany(pendingFilter, {
        $set: {
          status: "dismissed",
          resolution: {
            resolvedAt: new Date(),
            action: "auto_cleared_no_match",
          },
        },
      });
    }
    return {
      contentScreening: {
        flagged: false,
        matchCount: 0,
        titleHits: 0,
        textHits: 0,
      },
    };
  }

  const description = buildDescription(scan);
  const reason = `Lexical screening: ${scan.matchedTerms.length} term(s) matched`.slice(0, 200);

  const existing = await Report.findOne(pendingFilter);

  if (existing) {
    existing.reason = reason;
    existing.description = description;
    existing.category = CATEGORY;
    await existing.save();
  } else {
    const doc = {
      [floraField]: floraId,
      source: SOURCE,
      category: CATEGORY,
      reason,
      description,
      status: "pending",
    };
    await Report.create(doc);
  }

  return {
    contentScreening: {
      flagged: true,
      matchCount: scan.matchedTerms.length,
      titleHits: scan.locations.title,
      textHits: scan.locations.text,
      matchedTerms: scan.matchedTerms,
    },
  };
}

/** Uses modular app Report model (`reportedFloraId`). */
async function syncLanguageScreenReport(floraId, title, text) {
  const Report = require("../models/Report");
  return syncLanguageScreenReportWithModel(Report, "reportedFloraId", floraId, title, text);
}

module.exports = {
  syncLanguageScreenReport,
  syncLanguageScreenReportWithModel,
  SOURCE,
  CATEGORY,
};
