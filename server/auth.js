"use strict";
const crypto = require("node:crypto");
const { readDB } = require("./db");
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
) {
  throw new Error("Üretimde JWT_SECRET en az 32 karakter olmalıdır.");
}
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex");
const TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000;
const revoked = new Map();
function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 256
  ) {
    const error = new Error("Parola 12–256 karakter arasında olmalıdır.");
    error.status = 400;
    throw error;
  }
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}
function verifyPassword(password, storedHash) {
  if (
    typeof password !== "string" ||
    password.length > 256 ||
    typeof storedHash !== "string"
  )
    return false;
  const parts = storedHash.split(":");
  if (
    parts.length !== 3 ||
    parts[0] !== "scrypt" ||
    !/^[a-f0-9]{32}$/i.test(parts[1]) ||
    !/^[a-f0-9]{128}$/i.test(parts[2])
  )
    return false;
  return crypto.timingSafeEqual(
    crypto.scryptSync(password, parts[1], 64),
    Buffer.from(parts[2], "hex"),
  );
}
function createToken(payload) {
  const user = (readDB().users || []).find((u) => u.id === payload.userId);
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      version: user?.authVersion || 0,
      jti: crypto.randomUUID(),
      iat: Date.now(),
      exp: Date.now() + TOKEN_EXPIRY_MS,
    }),
  ).toString("base64url");
  return `${header}.${body}.${crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url")}`;
}
function verifyToken(token) {
  if (typeof token !== "string" || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const [head, body, signature] = parts;
    const expected = crypto
      .createHmac("sha256", SECRET)
      .update(`${head}.${body}`)
      .digest();
    const actual = Buffer.from(signature, "base64url");
    if (
      actual.length !== expected.length ||
      !crypto.timingSafeEqual(actual, expected)
    )
      return null;
    const header = JSON.parse(Buffer.from(head, "base64url"));
    const payload = JSON.parse(Buffer.from(body, "base64url"));
    if (
      header.alg !== "HS256" ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= Date.now() ||
      !payload.jti ||
      revoked.has(payload.jti)
    )
      return null;
    return payload;
  } catch {
    return null;
  }
}
function requestToken(req) {
  const authorization = req.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7).trim();
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("crm_session="));
  return cookie ? cookie.slice("crm_session=".length) : "";
}
function revokeSession(req) {
  const payload = verifyToken(requestToken(req));
  for (const [id, expires] of revoked)
    if (expires <= Date.now()) revoked.delete(id);
  if (payload) revoked.set(payload.jti, payload.exp);
}
function sessionCookie(token = "") {
  return `crm_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token ? TOKEN_EXPIRY_MS / 1000 : 0}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
function resolveAuthContext(req, db) {
  const payload = verifyToken(requestToken(req));
  if (!payload?.userId) return null;
  const user = (db.users || []).find(
    (u) => u.id === payload.userId && u.status === "active",
  );
  if (!user || (user.authVersion || 0) !== payload.version) return null;
  const memberships = (db.companyMemberships || []).filter(
    (m) => m.userId === user.id && m.status === "active",
  );
  const companyId = req.headers["x-company-id"] || payload.companyId;
  const membership = memberships.find((m) => m.companyId === companyId);
  const company =
    membership &&
    (db.companies || []).find(
      (c) => c.id === membership.companyId && c.status === "active",
    );
  if (!company) return null;
  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      mustChangePassword: Boolean(user.mustChangePassword),
    },
    company,
    membership,
    companyId: company.id,
    memberships,
  };
}
module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  resolveAuthContext,
  revokeSession,
  sessionCookie,
};
