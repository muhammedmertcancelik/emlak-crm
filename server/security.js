"use strict";
const { sessionCookie } = require("./auth");
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const rateBuckets = new Map();
function secureRequest(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  );
  if (process.env.NODE_ENV === "production")
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (req.headers.origin) {
    let origin;
    try {
      origin = new URL(req.headers.origin);
    } catch {
      fail("Geçersiz kaynak.", 403);
    }
    if (
      origin.host !== req.headers.host ||
      !["http:", "https:"].includes(origin.protocol)
    )
      fail("Bu kaynaktan erişime izin verilmiyor.", 403);
  }
  if (req.headers["sec-fetch-site"] === "cross-site")
    fail("Çapraz site isteği engellendi.", 403);
  if (
    mutation &&
    req.headers.cookie?.includes("crm_session=") &&
    req.headers["x-crm-request"] !== "1"
  )
    fail("İstek doğrulanamadı.", 403);
  if (
    mutation &&
    !req.url.startsWith("/api/media?") &&
    !/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")
  )
    fail("JSON içerik bekleniyor.", 415);
  if (mutation && req.url.startsWith("/api/auth/")) {
    const now = Date.now();
    for (const [key, item] of rateBuckets)
      if (item.until <= now) rateBuckets.delete(key);
    const key = `${req.socket.remoteAddress}:${req.url.split("?")[0]}`;
    const bucket = rateBuckets.get(key) || {
      count: 0,
      until: now + 15 * 60 * 1000,
    };
    if (++bucket.count > 30) {
      res.setHeader("Retry-After", Math.ceil((bucket.until - now) / 1000));
      fail("Çok fazla deneme. Lütfen daha sonra tekrar deneyin.", 429);
    }
    rateBuckets.set(key, bucket);
  }
}
function jsonResponse(res, status, data) {
  if (data?.token) res.setHeader("Set-Cookie", sessionCookie(data.token));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
const strings = (words) =>
  Object.fromEntries(words.split(" ").map((k) => [k, "string"]));
const numbers = (words) =>
  Object.fromEntries(words.split(" ").map((k) => [k, "number"]));
const booleans = (words) =>
  Object.fromEntries(words.split(" ").map((k) => [k, "boolean"]));
const propertySchema = {
  ...strings(
    "title description type status currency portfolioCode neighborhood siteName district city address floorType rooms facade heating furnishedStatus tenantStatus deedStatus legalEncumbrance authorizationStatus saleReason urgencyLevel priceClass contactName contactPhone notes priceChangeNote",
  ),
  ...numbers(
    "price buildingAge grossArea netArea floor totalFloors bathrooms estimatedRent monthlyDues monthlyExpenses negotiationMargin",
  ),
  ...booleans(
    "isSite hasBalcony hasElevator hasParking creditEligible isSwap isFavorite",
  ),
  assignedToUserId: "string",
  videos: "array",
  documents: "array",
  features: "array",
  images: "array",
  readinessChecklist: "object",
};
const customerSchema = {
  ...strings(
    "name phone email status pipelineStatus customerClass leadSource purchaseTimeline furnishedPreference purpose investmentGoal notes lastContactDate nextMeetingDate",
  ),
  ...numbers(
    "minBudget maxBudget totalBudget downPayment minNetArea maxBuildingAge maxMonthlyDues",
  ),
  ...booleans(
    "usesCredit requiresSite requiresParking kvkkConsent contactPermission",
  ),
  assignedToUserId: "string",
  creditAmount: "number",
  preferredTypes: "array",
  preferredStatuses: "array",
  preferredDistricts: "array",
  preferredRooms: "array",
};
const taskSchema = {
  ...strings(
    "title type relatedPropertyId relatedCustomerId assignedToUserId dueDate notes",
  ),
};
function validateShape(value, depth = 0) {
  if (depth > 8) fail("Veri yapısı çok derin.");
  if (typeof value === "string" && value.length > 20000)
    fail("Metin çok uzun.");
  if (Array.isArray(value) && value.length > 10000) fail("Çok fazla kayıt.");
  if (value && typeof value === "object")
    for (const [key, child] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key))
        fail("Geçersiz alan.");
      validateShape(child, depth + 1);
    }
}
function validateFields(body, schema, required = []) {
  const names = {
    title: "Başlık",
    price: "Fiyat",
    name: "Ad",
    fullName: "Ad soyad",
    companyName: "Ofis adı",
    password: "Parola",
    email: "E-posta",
    dueDate: "Tarih",
    totalBudget: "Bütçe",
  };
  for (const key of required)
    if (
      body[key] === undefined ||
      body[key] === null ||
      String(body[key]).trim() === ""
    )
      fail(`${names[key] || key}: zorunlu alan.`);
  for (const [key, value] of Object.entries(body)) {
    const type = schema[key];
    if (!type) fail(`${key}: bu alan değiştirilemez.`);
    if (value === null && !required.includes(key)) continue;
    if (type === "number") {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < (key === "floor" ? -10 : 0) ||
        value > 1e15
      )
        fail(`${key}: geçerli bir sayı girin.`);
    } else if (type === "array") {
      if (
        !Array.isArray(value) ||
        value.length > 100 ||
        value.some((v) => typeof v !== "string")
      )
        fail(`${key}: geçerli bir liste girin.`);
    } else if (type === "object") {
      if (!value || Array.isArray(value) || typeof value !== "object")
        fail(`${key}: geçersiz veri.`);
    } else if (typeof value !== type) fail(`${key}: geçersiz veri türü.`);
  }
  if (
    body.email &&
    schema !== loginSchema &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
  )
    fail("Geçerli bir e-posta adresi girin.");
  if (body.currency && !["TRY", "USD", "EUR", "GBP"].includes(body.currency))
    fail("Geçersiz para birimi.");
  if (body.dueDate && !Number.isFinite(Date.parse(body.dueDate)))
    fail("Geçerli bir tarih girin.");
  if (
    body.minBudget != null &&
    (body.maxBudget ?? body.totalBudget) != null &&
    body.minBudget > (body.maxBudget ?? body.totalBudget)
  )
    fail("Alt bütçe üst bütçeden büyük olamaz.");
  if (
    body.images?.some(
      (src) => !/^https:\/\//i.test(src) && !/^\/[^/]/.test(src),
    )
  )
    fail("Fotoğraf için HTTPS veya yerel adres kullanın.");
  if (body.images?.length > 15) fail("En fazla 15 fotoğraf eklenebilir.");
  if (body.color && !/^#[a-f0-9]{6}$/i.test(body.color)) fail("Geçersiz renk.");
  if (body.title !== undefined && !body.title.trim())
    fail("Başlık boş olamaz.");
  if (body.name !== undefined && !body.name.trim()) fail("Ad boş olamaz.");
  if (
    body.readinessChecklist &&
    Object.values(body.readinessChecklist).some((v) => typeof v !== "boolean")
  )
    fail("Geçersiz kontrol listesi.");
  return body;
}
const loginSchema = strings("email password");
function validateBody(body, pathname, method) {
  validateShape(body);
  if (/^\/api\/properties(?:\/[^/]+)?$/.test(pathname))
    validateFields(
      body,
      propertySchema,
      method === "POST" ? ["title", "price"] : [],
    );
  if (/^\/api\/customers(?:\/[^/]+)?$/.test(pathname))
    validateFields(body, customerSchema, method === "POST" ? ["name"] : []);
  if (/^\/api\/followups(?:\/[^/]+)?$/.test(pathname))
    validateFields(
      body,
      taskSchema,
      method === "POST" ? ["title", "dueDate"] : [],
    );
  if (pathname === "/api/auth/register")
    validateFields(
      body,
      strings("email password fullName phone companyName city"),
      ["email", "password", "fullName", "companyName"],
    );
  if (pathname === "/api/auth/login")
    validateFields(body, loginSchema, ["email", "password"]);
  if (pathname === "/api/auth/change-password")
    validateFields(body, strings("currentPassword newPassword"), [
      "currentPassword",
      "newPassword",
    ]);
  if (pathname === "/api/auth/accept-invitation")
    validateFields(body, strings("token fullName password phone"), [
      "token",
      "fullName",
      "password",
    ]);
  if (pathname === "/api/companies/invitations")
    validateFields(body, strings("email role"), ["email"]);
  if (pathname === "/api/companies/current")
    validateFields(body, {
      ...strings("name phone email city address taxNumber"),
      settings: "object",
    });
  if (/^\/api\/(properties|customers)\/[^/]+\/share$/.test(pathname)) {
    validateFields(body, {
      ...strings("action targetType commissionSplit legalBasisNote"),
      targetCompanyIds: "array",
    });
    if (!["share", "revoke"].includes(body.action))
      fail("Geçersiz paylaşım işlemi.");
    if (
      body.targetType &&
      !["all_members", "specific_companies"].includes(body.targetType)
    )
      fail("Geçersiz paylaşım hedefi.");
    if (
      body.targetType === "specific_companies" &&
      !body.targetCompanyIds?.length
    )
      fail("Paylaşılacak şirketi seçin.");
  }
  if (pathname === "/api/auth/switch-company")
    validateFields(body, strings("targetCompanyId"), ["targetCompanyId"]);
  if (/^\/api\/departments\/[^/]+\/assign$/.test(pathname))
    validateFields(body, { userIds: "array" }, ["userIds"]);
  if (/^\/api\/companies\/members\/[^/]+\/department$/.test(pathname))
    validateFields(body, strings("departmentId"));
  if (/^\/api\/departments(?:\/[^/]+)?$/.test(pathname))
    validateFields(
      body,
      {
        ...strings("name icon color description leaderUserId"),
        customCriteria: "object",
        assignedUserIds: "array",
      },
      method === "POST" ? ["name"] : [],
    );
  return body;
}
async function parseBody(req) {
  if (req.parsedBody) return req.parsedBody;
  if (Number(req.headers["content-length"]) > 2 * 1024 * 1024) {
    req.resume();
    fail("İstek en fazla 2 MB olabilir.", 413);
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) fail("İstek en fazla 2 MB olabilir.", 413);
    chunks.push(chunk);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch {
    fail("Geçersiz JSON.");
  }
  if (!body || Array.isArray(body) || typeof body !== "object")
    fail("JSON nesnesi bekleniyor.");
  req.parsedBody = validateBody(
    body,
    new URL(req.url, "http://localhost").pathname,
    req.method,
  );
  return req.parsedBody;
}
function validateReferences(body, db, companyId, userId, manager) {
  const members = (db.companyMemberships || []).filter(
    (m) => m.companyId === companyId && m.status === "active",
  );
  for (const key of ["assignedUserIds", "userIds", "targetCompanyIds"])
    if (body[key] !== undefined && !Array.isArray(body[key]))
      fail("Geçerli bir liste girin.");
  for (const id of body.targetCompanyIds || [])
    if (!(db.companies || []).some((c) => c.id === id && c.status === "active"))
      fail("Paylaşılacak şirket aktif değil.");
  for (const id of [
    body.leaderUserId,
    body.assignedToUserId,
    ...(body.assignedUserIds || []),
    ...(body.userIds || []),
  ].filter(Boolean)) {
    if (!members.some((m) => m.userId === id || m.id === id))
      fail("Seçilen çalışan bu şirkete ait değil.");
  }
  if (body.assignedToUserId && !manager && body.assignedToUserId !== userId)
    fail("Başka bir çalışana görev atama yetkiniz yok.", 403);
  if (
    body.departmentId &&
    !(db.departments || []).some(
      (d) => d.id === body.departmentId && d.companyId === companyId,
    )
  )
    fail("Departman bulunamadı.");
  for (const [key, collection] of [
    ["relatedPropertyId", "properties"],
    ["relatedCustomerId", "customers"],
  ]) {
    if (
      body[key] &&
      !(db[collection] || []).some(
        (x) => x.id === body[key] && x.companyId === companyId,
      )
    )
      fail("İlişkili kayıt bu şirkete ait değil.");
  }
}
function publicProperty(property, companyId) {
  if (property.companyId === companyId) return property;
  const {
    documents,
    videos,
    contactName,
    contactPhone,
    notes,
    address,
    priceHistory,
    readinessChecklist,
    ...publicData
  } = property;
  return publicData;
}
module.exports = {
  secureRequest,
  jsonResponse,
  parseBody,
  fail,
  validateFields,
  validateReferences,
  publicProperty,
  propertySchema,
  customerSchema,
  taskSchema,
};
