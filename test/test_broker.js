"use strict";
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { withDBLock, readDB } = require("../server/db");
process.env.PORT = "0";
const server = require("../server/index");
(async () => {
  if (!server.listening) await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port + "/api";
  async function request(path, token, body) {
    const response = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  }
  const register = (email) =>
    request("/auth/register", null, {
      email,
      password: "Test-password-2026!",
      fullName: "Broker",
      companyName: email,
      city: "İstanbul",
    });
  const owner = (await register("owner@broker.test")).data;
  const other = (await register("other@broker.test")).data;
  const token = owner.token;
  const companyId = owner.company.id;
  // Seed exact accounting fixtures independently of UI setup.
  await withDBLock((db, save) => {
    db.users.push(
      { id: "advisor", fullName: "Advisor" },
      { id: "other-advisor", fullName: "Other" },
    );
    db.companyMemberships.push(
      ...["advisor", "other-advisor"].map((userId) => ({
        id: userId,
        userId,
        companyId,
        role: "agent",
        status: "active",
      })),
    );
    db.properties.push(
      ...Array.from({ length: 65 }, (_, i) => ({
        id: "p" + i,
        companyId,
        title: "Property " + i,
        status: i === 0 ? "satildi" : "satilik",
        createdAt: "2026-11-25T10:00:00Z",
      })),
    );
    db.customers.push({
      id: "c",
      companyId,
      name: "Customer",
      status: "kapandi_basarili",
    });
    db.sales ||= [];
    db.sales.push({
      id: "s",
      companyId,
      propertyId: "p0",
      propertyTitle: "Property 0",
      customerId: "c",
      customerName: "Customer",
      advisorId: "advisor",
      customerSourceId: "emlak",
      propertySourceId: "emlak",
      totalAmount: 10000000,
      gross: 10000000,
      receivedAmount: 7000000,
      receivableAmount: 3000000,
      transactionType: "satilik",
      createdAt: "2026-11-25T10:00:00Z",
    });
    save(db);
  });
  assert.equal(
    (await request("/broker/overview", other.token)).data.ledger.length,
    0,
  );
  const receipt = { requestId: "receipt-1", amount: 10000, date: "2026-11-25" };
  assert.equal(
    (await request("/broker/sales/s/receipt", other.token, receipt)).status,
    404,
  );
  const retries = await Promise.all(
    [1, 2].map(() => request("/broker/sales/s/receipt", token, receipt)),
  );
  assert.ok(retries.every((r) => r.status === 200));
  assert.equal(
    readDB().sales.find((s) => s.id === "s").receivableAmount,
    2000000,
  );
  assert.equal(
    (
      await request("/broker/sales/s/receipt", token, {
        ...receipt,
        requestId: "over",
        amount: 30000,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/broker/expenses", token, {
        requestId: "expense-1",
        amount: 1000,
        category: "Kira",
        date: "2026-02-30",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/broker/expenses", token, {
        requestId: "expense-1",
        amount: 1000,
        category: "Kira",
        date: "2026-11-25",
      })
    ).status,
    200,
  );
  let overview = (await request("/broker/overview", token)).data;
  assert.equal(
    overview.receipts.reduce((sum, r) => sum + r.amount, 0),
    8000000,
  );
  assert.equal(
    overview.ledger.find((r) => r.id === "advisor").balance,
    3500000,
  );
  const page = (await request("/records/properties?page=2", token)).data;
  assert.equal(page.items.length, 30);
  assert.equal(page.total, 65);
  assert.equal(
    (await request("/records/properties?q=Property%2064", token)).data.items
      .length,
    1,
  );
  assert.equal(
    (await request("/records/properties", other.token)).data.total,
    0,
  );
  const calculation = (await request("/finance/s/distribution", token)).data;
  assert.equal(
    (
      await request("/finance/s/paid", token, {
        revision: calculation.revision,
      })
    ).status,
    200,
  );
  overview = (await request("/broker/overview", token)).data;
  assert.equal(overview.ledger.find((r) => r.id === "advisor").balance, 0);
  assert.equal(
    (
      await request("/broker/sales/s/cancel", token, {
        requestId: "cancel",
        version: 1,
        reason: "Test",
      })
    ).status,
    409,
  );
  const finalized = (await request("/finance/s/distribution", token)).data;
  assert.equal(
    (await request("/finance/s/undo", token, { revision: finalized.revision }))
      .status,
    200,
  );
  const correction = {
    requestId: "edit",
    version: 1,
    reason: "Correction",
    totalAmount: 120000,
    advisorId: "advisor",
    customerSourceId: "emlak",
    propertySourceId: "emlak",
  };
  assert.equal(
    (await request("/broker/sales/s/edit", token, correction)).status,
    200,
  );
  assert.equal(
    (
      await request("/broker/sales/s/edit", token, {
        ...correction,
        requestId: "stale",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/broker/sales/s/cancel", token, {
        requestId: "cancel",
        version: 2,
        reason: "Test",
      })
    ).status,
    200,
  );
  assert.equal(
    readDB().properties.find((p) => p.id === "p0").status,
    "satilik",
  );
  assert.equal((await request("/finance", token)).data.sales.length, 0);
  assert.equal(
    (await request("/finance/s/paid", token, { revision: finalized.revision }))
      .status,
    404,
  );
  assert.ok((await request("/broker/audit", token)).data.total >= 5);
  const task = await request("/followups", token, {
    title: "New task",
    notes: "Read test",
    assignedToUserId: owner.user.id,
  });
  assert.equal(task.status, 201);
  assert.equal(task.data.createdById, owner.user.id);
  assert.equal(
    (await request("/followups/" + task.data.id + "/read", other.token, {}))
      .status,
    404,
  );
  assert.equal(
    (await request("/followups/" + task.data.id + "/read", token, {})).status,
    200,
  );
  assert.ok(readDB().followUps.find((t) => t.id === task.data.id).readAt);
  console.log(
    "PASS: broker receipts, retries, expenses, ledger, correction, cancellation, audit, pagination and read status.",
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
