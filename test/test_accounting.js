"use strict";
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { preview, organization } = require("../server/accounting");
const { withDBLock, readDB } = require("../server/db");

function fixture() {
  return {
    users: [
      { id: "a", fullName: "Ali" },
      { id: "b", fullName: "Banu" },
    ],
    companyMemberships: [
      {
        userId: "a",
        companyId: "office",
        role: "agent",
        status: "active",
        departmentId: "d",
      },
      {
        userId: "b",
        companyId: "office",
        role: "agent",
        status: "active",
        departmentId: "d",
      },
    ],
    departments: [{ id: "d", companyId: "office", name: "Kiralık" }],
    customers: [
      { id: "c", companyId: "office", name: "Müşteri", leadSource: "Ali" },
    ],
    properties: [
      {
        id: "p",
        companyId: "office",
        title: "Portföy",
        type: "daire",
        status: "kiralandi",
        portfolioSource: "Ali",
      },
    ],
  };
}
const sale = {
  id: "s",
  companyId: "office",
  propertyId: "p",
  customerId: "c",
  advisorId: "a",
  departmentId: "d",
  receivedAmount: 10000000,
  receivableAmount: 90000000,
};
for (const key of organization.departments.map((d) => d.key)) {
  const result = preview(fixture(), sale, { departmentKey: key });
  assert.equal(result.totalPercent, 100);
  assert.equal(result.canFinalize, true);
  assert.equal(result.baseCents, 10000000);
  assert.equal(result.beneficiaries.find((b) => b.id === "a").percent, 45);
  assert.equal(result.beneficiaries.find((b) => b.id === "a").cents, 4500000);
  assert.equal(result.companyCents, 4400000);
  assert.equal(
    result.lines.filter((r) => r.recipientType === "department").length,
    4,
  );
  assert.ok(!result.lines.some((r) => r.recipientId === "department:" + key));
}
for (const [customerSource, portfolioSource, expected] of [
  ["emlak", "Ali", 95],
  ["Ali", "emlak", 95],
  ["emlak", "emlak", 90],
]) {
  const db = fixture();
  db.customers[0].leadSource = customerSource;
  db.properties[0].portfolioSource = portfolioSource;
  const result = preview(db, sale);
  assert.equal(result.totalPercent, expected);
  assert.equal(result.canFinalize, false);
  assert.equal(result.unallocatedCents, (100 - expected) * 100000);
  assert.equal(
    result.lines.find((r) => r.key === "customer").percent,
    customerSource === "emlak" ? 5 : 10,
  );
  assert.equal(
    result.lines.find((r) => r.key === "portfolio").percent,
    portfolioSource === "emlak" ? 5 : 10,
  );
}
for (const cents of [1, 2, 3, 7, 99, 101, 1234567, 100000000000000]) {
  for (const source of ["Ali", "emlak"]) {
    const db = fixture();
    db.properties[0].portfolioSource = source;
    const result = preview(db, { ...sale, receivedAmount: cents });
    assert.equal(
      result.lines.reduce((sum, row) => sum + row.cents, 0) +
        result.unallocatedCents,
      cents,
    );
    assert.equal(
      result.beneficiaries.reduce((sum, row) => sum + row.cents, 0),
      result.allocatedCents,
    );
  }
}
{
  const db = fixture();
  db.users[0].fullName = organization.coordinator;
  db.customers[0].leadSource = organization.coordinator;
  db.properties[0].portfolioSource = organization.coordinator;
  assert.equal(
    preview(db, sale).beneficiaries.find((b) => b.id === "a").percent,
    48,
  );
  assert.equal(preview(db, { ...sale, receivedAmount: 0 }).canFinalize, false);
  assert.equal(
    preview(db, { ...sale, receivedAmount: undefined, net: 10000000 })
      .baseCents,
    0,
  );
  delete db.properties[0].portfolioSource;
  const missing = preview(db, sale);
  assert.equal(missing.canFinalize, false);
  assert.ok(missing.warnings.some((w) => w.includes("Portföy kaynağını")));
}
process.env.PORT = "0";
const server = require("../server/index");
(async () => {
  if (!server.listening) await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  async function request(path, token, body) {
    const response = await fetch(base + "/api" + path, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  }
  const register = (email) =>
    request("/auth/register", null, {
      email,
      fullName: "Broker",
      password: "Accounting-pass-2026!",
      companyName: email,
      city: "İstanbul",
    });
  const owner = await register("owner@accounting.test");
  const other = await register("other@accounting.test");
  assert.equal(owner.status, 201);
  const token = owner.data.token;
  const companyId = owner.data.company.id;
  await withDBLock((db, save) => {
    const seed = fixture();
    for (const key of [
      "users",
      "companyMemberships",
      "departments",
      "customers",
      "properties",
    ]) {
      db[key] ||= [];
      db[key].push(
        ...seed[key].map((item) => ({
          ...item,
          ...(item.companyId ? { companyId } : {}),
        })),
      );
    }
    db.sales = [
      { ...sale, companyId },
      { ...sale, id: "pending", companyId },
      { ...sale, id: "stale", companyId },
    ];
    save(db);
  });
  const path = "/finance/s/distribution";
  assert.equal((await request(path, other.data.token)).status, 404);
  assert.equal((await request(path)).status, 401);
  const initial = await request(path, token);
  assert.equal(initial.data.totalPercent, 100);
  assert.equal(
    (
      await request(path, token, {
        departmentKey: "rental",
        revision: initial.data.revision,
        percent: 100,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(path, token, {
        departmentKey: "outside",
        revision: initial.data.revision,
      })
    ).status,
    400,
  );
  const both = await Promise.all(
    [1, 2].map(() =>
      request(path, token, {
        departmentKey: "rental",
        revision: initial.data.revision,
      }),
    ),
  );
  assert.ok(
    both.every((r) => r.status === 200 && r.data.status === "finalized"),
  );
  assert.equal(
    readDB().auditLogs.filter((a) => a.action === "commission_finalized")
      .length,
    1,
  );
  const oldRevision = (await request("/finance/stale/distribution", token)).data
    .revision;
  await withDBLock((db, save) => {
    db.customers.find((c) => c.id === "c").leadSource = "emlak";
    db.properties.find((p) => p.id === "p").portfolioSource = "emlak";
    save(db);
  });
  assert.equal(
    (
      await request("/finance/stale/distribution", token, {
        departmentKey: "rental",
        revision: oldRevision,
      })
    ).status,
    409,
  );
  assert.equal((await request(path, token)).data.customerSource.name, "Ali");
  const pending = (await request("/finance/pending/distribution", token)).data;
  assert.equal(pending.totalPercent, 90);
  const savedDraft = await request("/finance/pending/distribution", token, {
    departmentKey: "rental",
    revision: pending.revision,
  });
  assert.equal(savedDraft.data.status, "draft");
  assert.equal(
    readDB().sales.find((s) => s.id === "pending").accounting,
    undefined,
  );
  const overview = (await request("/finance", token)).data.accounting;
  assert.equal(overview.totals.finalized, 10000000);
  assert.equal(overview.totals.company, 4400000);
  assert.equal(overview.totals.pending, 20000000);
  assert.equal(overview.beneficiaries.find((b) => b.id === "a").cents, 4500000);
  console.log(
    "PASS: %100/%95/%90, birleşen katkılar, dört departman, tahsilat esası, kuruş dengesi, izolasyon, taslak, değişiklik kontrolü ve sabit dağıtım kaydı.",
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    server.closeAllConnections();
    server.close();
  });
