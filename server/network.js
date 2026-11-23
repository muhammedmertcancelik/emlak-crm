"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
function localKey() {
  const file = path.join(
    path.dirname(require("./db").DATA_FILE),
    ".network-key",
  );
  try {
    return fs.readFileSync(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try {
      fs.writeFileSync(file, crypto.randomBytes(32), {
        flag: "wx",
        mode: 0o600,
      });
    } catch (writeError) {
      if (writeError.code !== "EEXIST") throw writeError;
    }
    return fs.readFileSync(file);
  }
}
function seal(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", localKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64"))
    .join(".");
}
function unseal(value) {
  const [iv, tag, encrypted] = value
    .split(".")
    .map((part) => Buffer.from(part, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", localKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}
const https = require("node:https");
const dns = require("node:dns").promises;
const { BlockList } = require("node:net");
const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
])
  blocked.addSubnet(address, prefix, "ipv4");
const { withDBLock } = require("./db");
const { parseBody, jsonResponse, fail, validateFields } = require("./security");
const digest = (key) => crypto.createHash("sha256").update(key).digest("hex");
const projection = (p) =>
  Object.fromEntries(
    [
      "id",
      "title",
      "type",
      "status",
      "price",
      "currency",
      "city",
      "district",
      "neighborhood",
      "rooms",
      "netArea",
      "buildingAge",
    ].map((k) => [k, p[k]]),
  );
const shared = (db, companyId) =>
  (db.properties || [])
    .filter(
      (p) =>
        p.companyId === companyId &&
        p.shareStatus === "shared_pool" &&
        !p.isArchived &&
        !["satildi", "kiralandi"].includes(p.status),
    )
    .map(projection);
const customerProjection = (customer) => ({
  id: customer.id,
  name: "Müşteri talebi",
  totalBudget: customer.totalBudget,
  preferredCity: customer.preferredCity || "",
  preferredDistricts: customer.preferredDistricts || [],
  preferredNeighborhoods: customer.preferredNeighborhoods || [],
  preferredFloorTypes: customer.preferredFloorTypes || [],
  preferredRooms: customer.preferredRooms || [],
  preferredTypes: customer.preferredTypes || [],
  preferredStatuses: customer.preferredStatuses || [],
});
const sharedCustomers = (db, companyId) =>
  (db.customers || [])
    .filter(
      (c) =>
        c.companyId === companyId &&
        c.shareStatus === "shared_pool" &&
        c.contactPermission &&
        c.kvkkConsent,
    )
    .map(customerProjection);
function listings(db, companyId) {
  const office = db.companies.find((c) => c.id === companyId);
  return [
    {
      office: office.name,
      phone: office.phone || "",
      properties: shared(db, companyId),
      customers: sharedCustomers(db, companyId),
    },
    ...(db.networkPeers || [])
      .filter(
        (p) =>
          p.companyId === companyId &&
          Date.now() - Date.parse(p.updatedAt) < 86400000 &&
          (db.networkKeys || []).some((k) => k.id === p.keyId && !k.revoked),
      )
      .map((p) => ({
        office: p.office,
        phone: p.phone,
        properties: p.properties,
        customers: p.customers || [],
      })),
  ];
}
async function exchange(req, res) {
  if (req.method !== "POST") fail("POST gerekli.", 405);
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!/^[a-f0-9]{64}$/.test(token)) fail("Geçersiz ağ anahtarı.", 401);
  const body = await parseBody(req);
  validateFields(
    body,
    {
      office: "string",
      phone: "string",
      properties: "object",
      customers: "object",
    },
    ["office", "properties"],
  );
  if (
    !Array.isArray(body.properties.items) ||
    body.properties.items.length > 1000
  )
    fail("En fazla 1000 ortak ağ portföyü gönderilebilir.");
  const properties = body.properties.items.map((p) => {
    if (
      !p ||
      typeof p !== "object" ||
      typeof p.id !== "string" ||
      typeof p.title !== "string"
    )
      fail("Geçersiz portföy.");
    const item = projection(p);
    for (const value of Object.values(item))
      if (
        value !== undefined &&
        typeof value !== "string" &&
        typeof value !== "number"
      )
        fail("Geçersiz portföy alanı.");
    return item;
  });
  const incomingCustomers = body.customers?.items || [];
  if (!Array.isArray(incomingCustomers) || incomingCustomers.length > 1000)
    fail("Geçersiz müşteri talepleri.");
  const customers = incomingCustomers.map((customer) => {
    if (
      typeof customer.id !== "string" ||
      typeof customer.totalBudget !== "number" ||
      !Number.isFinite(customer.totalBudget)
    )
      fail("Geçersiz müşteri talebi.");
    for (const key of [
      "preferredDistricts",
      "preferredNeighborhoods",
      "preferredFloorTypes",
      "preferredCity",
      "preferredRooms",
      "preferredTypes",
      "preferredStatuses",
    ])
      if (
        customer[key] !== undefined &&
        (!Array.isArray(customer[key]) ||
          customer[key].some((v) => typeof v !== "string"))
      )
        fail("Geçersiz müşteri tercihi.");
    return customerProjection(customer);
  });
  let result;
  await withDBLock((db, save) => {
    const key = (db.networkKeys || []).find(
      (k) => k.hash === digest(token) && !k.revoked,
    );
    if (!key) fail("Ağ anahtarı iptal edilmiş veya geçersiz.", 401);
    db.networkPeers ||= [];
    db.networkPeers = db.networkPeers.filter((p) => p.keyId !== key.id);
    db.networkPeers.push({
      keyId: key.id,
      companyId: key.companyId,
      office: body.office,
      phone: body.phone || "",
      properties,
      customers,
      updatedAt: new Date().toISOString(),
    });
    result = listings(db, key.companyId);
    save(db);
  });
  jsonResponse(res, 200, { offices: result });
}
async function remote(url, key, body) {
  const target = new URL(url);
  if (
    target.protocol !== "https:" ||
    target.username ||
    target.password ||
    (target.port && target.port !== "443")
  )
    fail("Ortak ağ adresi HTTPS kullanmalı.");
  const addresses = await dns.lookup(target.hostname, { all: true, family: 4 });
  const safe = addresses.filter(
    (address) => !blocked.check(address.address, "ipv4"),
  );
  if (!safe.length || safe.length !== addresses.length)
    fail("Ortak ağ için herkese açık sunucu adresi gerekli.");
  target.pathname = "/api/federation/exchange";
  target.search = "";
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = https.request(
      target,
      {
        method: "POST",
        family: 4,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + key,
          "Content-Length": Buffer.byteLength(payload),
        },
        lookup: (_host, _options, callback) =>
          callback(null, safe[0].address, 4),
      },
      (response) => {
        let size = 0;
        const chunks = [];
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > 2 * 1024 * 1024) {
            response.destroy();
            reject(new Error("Ortak ağ yanıtı çok büyük."));
          } else chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          try {
            const result = JSON.parse(Buffer.concat(chunks));
            if (response.statusCode !== 200)
              return reject(
                new Error(result.error || "Ortak ağ bağlantısı başarısız."),
              );
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.setTimeout(10000, () =>
      request.destroy(new Error("Ortak ağ zaman aşımı.")),
    );
    request.on("error", reject);
    request.end(payload);
  });
}
async function handle(req, res, auth, db, pathname) {
  if (!pathname.startsWith("/api/network/")) return false;
  if (!["owner", "admin"].includes(auth.membership.role))
    fail("Broker yetkisi gerekli.", 403);
  const companyId = auth.companyId;
  const send = (data) => {
    jsonResponse(res, 200, data);
    return true;
  };
  if (pathname === "/api/network/settings" && req.method === "GET")
    return send({
      keys: (db.networkKeys || [])
        .filter((k) => k.companyId === companyId)
        .map(({ id, label, revoked }) => ({ id, label, revoked })),
      connection: (db.networkConnections || [])
        .filter((c) => c.companyId === companyId)
        .map(({ url, updatedAt }) => ({ url, updatedAt })),
      offices: listings(db, companyId),
    });
  const body = await parseBody(req);
  if (pathname === "/api/network/keys" && req.method === "POST") {
    validateFields(body, { label: "string" }, ["label"]);
    const key = crypto.randomBytes(32).toString("hex");
    await withDBLock((data, save) => {
      data.networkKeys ||= [];
      data.networkKeys.push({
        id: crypto.randomUUID(),
        companyId,
        label: body.label,
        hash: digest(key),
        createdAt: new Date().toISOString(),
      });
      save(data);
    });
    return send({ key });
  }
  if (pathname === "/api/network/revoke" && req.method === "POST") {
    await withDBLock((data, save) => {
      const key = (data.networkKeys || []).find(
        (k) => k.id === body.id && k.companyId === companyId,
      );
      if (!key) fail("Anahtar bulunamadı.", 404);
      key.revoked = true;
      save(data);
    });
    return send({ success: true });
  }
  if (pathname === "/api/network/connect" && req.method === "POST") {
    validateFields(body, { url: "string", key: "string" }, ["url", "key"]);
    if (!/^[a-f0-9]{64}$/.test(body.key)) fail("Geçersiz anahtar.");
    const result = await remote(body.url, body.key, {
      office: auth.company.name,
      phone: auth.company.phone || "",
      properties: { items: shared(db, companyId) },
      customers: { items: sharedCustomers(db, companyId) },
    });
    await withDBLock((data, save) => {
      data.networkConnections = (data.networkConnections || []).filter(
        (c) => c.companyId !== companyId,
      );
      data.networkConnections.push({
        companyId,
        url: new URL(body.url).origin,
        key: seal(body.key),
        updatedAt: new Date().toISOString(),
      });
      save(data);
    });
    return send(result);
  }
  if (pathname === "/api/network/sync" && req.method === "POST") {
    const connection = (db.networkConnections || []).find(
      (c) => c.companyId === companyId,
    );
    if (!connection) return send({ offices: listings(db, companyId) });
    return send(
      await remote(connection.url, unseal(connection.key), {
        office: auth.company.name,
        phone: auth.company.phone || "",
        properties: { items: shared(db, companyId) },
        customers: { items: sharedCustomers(db, companyId) },
      }),
    );
  }
  fail("Ortak ağ işlemi bulunamadı.", 404);
}
module.exports = { handle, exchange };
