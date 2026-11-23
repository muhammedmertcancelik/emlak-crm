"use strict";
const { fail } = require("./security");
const legacySources = new Set([
  "telefon",
  "ilan",
  "whatsapp",
  "ofis",
  "tavsiye",
  "sosyal_medya",
  "diger",
]);
function normalizeLeadSource(value) {
  return !value || legacySources.has(value) ? "emlak" : value;
}
function customerLeadSource(db, companyId, value, existingValue) {
  const source = normalizeLeadSource(value);
  if (source === "emlak" || (existingValue && source === existingValue))
    return source;
  const advisorIds = new Set(
    (db.companyMemberships || [])
      .filter(
        (m) =>
          m.companyId === companyId &&
          m.role === "agent" &&
          m.status === "active",
      )
      .map((m) => m.userId),
  );
  if (
    !(db.users || []).some((u) => advisorIds.has(u.id) && u.fullName === source)
  )
    fail("Talep kaynağı olarak Emlak veya ofisinizdeki bir danışmanı seçin.");
  return source;
}
module.exports = { normalizeLeadSource, customerLeadSource };
