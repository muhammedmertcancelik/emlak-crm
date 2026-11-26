"use strict";
const crypto = require("node:crypto");
const { withDBLock } = require("./db");
const { fail, parseBody, validateFields, jsonResponse } = require("./security");
const accounting = require("./accounting");
const isBroker = (auth) => ["owner", "admin"].includes(auth.membership.role);
const cents = (value) => {
  if (!Number.isFinite(value) || value < 0 || value > 1e12)
    fail("Geçersiz tutar.");
  return Math.round(value * 100);
};
function audit(db, auth, action, recordId, details) {
  db.auditLogs ||= [];
  db.auditLogs.push({
    id: crypto.randomUUID(),
    companyId: auth.companyId,
    userId: auth.user.id,
    action,
    recordId,
    details,
    createdAt: new Date().toISOString(),
  });
}
function ledger(db, companyId) {
  const rows = new Map();
  for (const sale of (db.sales || []).filter(
    (s) => s.companyId === companyId && !s.cancelledAt,
  )) {
    for (const share of accounting.preview(db, sale).beneficiaries || []) {
      if (!["advisor", "secretary"].includes(share.type)) continue;
      const row = rows.get(share.id) || {
        id: share.id,
        name: share.name,
        earned: 0,
        paid: 0,
        balance: 0,
      };
      row.earned += share.cents;
      if (sale.distributedAt) row.paid += share.cents;
      rows.set(share.id, row);
    }
  }
  for (const row of rows.values()) row.balance = row.earned - row.paid;
  return [...rows.values()];
}
async function handle(req, res, auth, db, pathname) {
  const send = (data) => {
    jsonResponse(res, 200, data);
    return true;
  };
  const listMatch = pathname.match(/^\/api\/records\/(properties|customers)$/);
  if (listMatch && req.method === "GET") {
    const params = new URL(req.url, "http://localhost").searchParams;
    const kind = listMatch[1];
    const normalize = (value) =>
      String(value || "")
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ı/g, "i");
    const q = normalize(params.get("q"));
    const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));
    const limit = Math.min(
      100,
      Math.max(1, Math.floor(Number(params.get("limit")) || 30)),
    );
    const items = (db[kind] || [])
      .filter((row) => row.companyId === auth.companyId)
      .filter(
        (row) =>
          isBroker(auth) ||
          auth.membership.role === "secretary" ||
          (row.assignedToUserId || row.createdById) === auth.user.id,
      )
      .filter((row) => {
        if (
          q &&
          !normalize(
            [
              row.title,
              row.name,
              row.phone,
              row.email,
              row.city,
              row.district,
              row.portfolioCode,
              ...(row.preferredDistricts || []),
              ...(row.preferredNeighborhoods || []),
            ].join(" "),
          ).includes(q)
        )
          return false;
        if (params.get("mine") === "true" && row.createdById !== auth.user.id)
          return false;
        if (
          params.get("status") &&
          (row.pipelineStatus || row.status) !== params.get("status")
        )
          return false;
        if (kind === "customers")
          return (
            !params.get("customerClass") ||
            row.customerClass === params.get("customerClass")
          );
        if (!!row.isArchived !== (params.get("archived") === "true"))
          return false;
        if (params.get("favorite") === "true" && !row.isFavorite) return false;
        for (const key of ["type", "city", "currency", "rooms"]) {
          if (
            params.get(key) &&
            (row[key] || (key === "currency" ? "TRY" : "")) !== params.get(key)
          )
            return false;
        }
        return (
          (!params.get("min") || row.price >= Number(params.get("min"))) &&
          (!params.get("max") || row.price <= Number(params.get("max")))
        );
      })
      .sort(
        (a, b) =>
          String(b.createdAt).localeCompare(String(a.createdAt)) ||
          a.id.localeCompare(b.id),
      );
    return send({
      total: items.length,
      page,
      items: items.slice((page - 1) * limit, page * limit).map((row) => ({
        ...row,
        isOwn: true,
        canEdit: true,
        createdByName:
          db.users.find((u) => u.id === row.createdById)?.fullName || null,
      })),
    });
  }
  const readMatch = pathname.match(/^\/api\/followups\/([^/]+)\/read$/);
  if (readMatch && req.method === "POST") {
    return send(
      await withDBLock((data, save) => {
        const task = (data.followUps || []).find(
          (t) =>
            t.id === readMatch[1] &&
            t.companyId === auth.companyId &&
            t.assignedToUserId === auth.user.id,
        );
        if (!task) fail("Görev bulunamadı.", 404);
        task.readAt ||= new Date().toISOString();
        save(data);
        return { success: true };
      }),
    );
  }
  if (!pathname.startsWith("/api/broker/")) return false;
  if (!isBroker(auth)) fail("Broker yetkisi gereklidir.", 403);
  if (pathname === "/api/broker/overview" && req.method === "GET") {
    const receipts = (db.receipts || []).filter(
      (e) => e.companyId === auth.companyId,
    );
    const sales = (db.sales || []).filter(
      (s) => s.companyId === auth.companyId,
    );
    const initial = sales
      .map((s) => ({
        id: "initial-" + s.id,
        saleId: s.id,
        propertyTitle: s.propertyTitle,
        amount: Math.max(
          0,
          (s.receivedAmount || 0) -
            receipts
              .filter((r) => r.saleId === s.id)
              .reduce((sum, r) => sum + r.amount, 0),
        ),
        date: new Intl.DateTimeFormat("sv-SE", {
          timeZone: "Europe/Istanbul",
        }).format(new Date(s.createdAt)),
        note: "Satış kaydındaki ilk tahsilat",
      }))
      .filter((r) => r.amount > 0);
    return send({
      expenses: (db.expenses || []).filter(
        (e) => e.companyId === auth.companyId,
      ),
      receipts: [...initial, ...receipts],
      cancelled: sales
        .filter((s) => s.cancelledAt)
        .map((s) => ({
          id: s.id,
          propertyTitle: s.propertyTitle,
          receivedAmount: s.receivedAmount || 0,
          cancelledAt: s.cancelledAt,
        })),
      ledger: ledger(db, auth.companyId),
    });
  }
  if (pathname === "/api/broker/audit" && req.method === "GET") {
    const params = new URL(req.url, "http://localhost").searchParams;
    const query = (params.get("q") || "").toLocaleLowerCase("tr-TR");
    const page = Math.max(1, Number(params.get("page")) || 1);
    const rows = (db.auditLogs || [])
      .filter((e) => e.companyId === auth.companyId)
      .map((e) => ({
        ...e,
        userName: db.users.find((u) => u.id === e.userId)?.fullName || "Sistem",
      }))
      .filter((e) =>
        JSON.stringify(e).toLocaleLowerCase("tr-TR").includes(query),
      )
      .reverse();
    return send({
      items: rows.slice((page - 1) * 30, page * 30),
      total: rows.length,
      page,
    });
  }
  const saleMatch = pathname.match(
    /^\/api\/broker\/sales\/([^/]+)\/(receipt|edit|cancel)$/,
  );
  const expenseMatch = pathname.match(
    /^\/api\/broker\/expenses(?:\/([^/]+)\/void)?$/,
  );
  if (!saleMatch && !expenseMatch) return false;
  if (req.method !== "POST") fail("İşlem desteklenmiyor.", 405);
  const body = await parseBody(req);
  if (expenseMatch)
    validateFields(
      body,
      {
        requestId: "string",
        amount: "number",
        category: "string",
        note: "string",
        date: "string",
      },
      expenseMatch[1]
        ? ["requestId"]
        : ["requestId", "amount", "category", "date"],
    );
  else if (saleMatch[2] === "receipt")
    validateFields(
      body,
      { requestId: "string", amount: "number", note: "string", date: "string" },
      ["requestId", "amount", "date"],
    );
  else if (saleMatch[2] === "edit")
    validateFields(
      body,
      {
        requestId: "string",
        version: "number",
        totalAmount: "number",
        advisorId: "string",
        customerSourceId: "string",
        propertySourceId: "string",
        reason: "string",
      },
      [
        "requestId",
        "version",
        "totalAmount",
        "advisorId",
        "customerSourceId",
        "propertySourceId",
        "reason",
      ],
    );
  else
    validateFields(
      body,
      { requestId: "string", version: "number", reason: "string" },
      ["requestId", "version", "reason"],
    );
  if (!body.requestId.trim()) fail("İstek kimliği gerekli.");
  if (
    body.date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
      !Number.isFinite(Date.parse(body.date)) ||
      new Date(body.date).toISOString().slice(0, 10) !== body.date)
  )
    fail("Geçerli bir tarih seçin.");
  return send(
    await withDBLock((data, save) => {
      data.brokerRequests ||= [];
      if (
        data.brokerRequests.some(
          (r) =>
            r.companyId === auth.companyId &&
            r.id === body.requestId &&
            r.path === pathname,
        )
      )
        return { success: true };
      if (expenseMatch) {
        data.expenses ||= [];
        if (expenseMatch[1]) {
          const expense = data.expenses.find(
            (e) => e.id === expenseMatch[1] && e.companyId === auth.companyId,
          );
          if (!expense) fail("Gider bulunamadı.", 404);
          expense.voidedAt ||= new Date().toISOString();
          audit(data, auth, "expense_voided", expense.id, expense.note);
        } else {
          const amount = cents(body.amount);
          if (!amount || !body.category.trim())
            fail("Kategori ve pozitif tutar gerekli.");
          const expense = {
            id: crypto.randomUUID(),
            companyId: auth.companyId,
            amount,
            category: body.category,
            note: body.note || "",
            date: body.date,
            createdAt: new Date().toISOString(),
            createdById: auth.user.id,
          };
          data.expenses.push(expense);
          audit(data, auth, "expense_created", expense.id, body.category);
        }
      } else {
        const sale = (data.sales || []).find(
          (s) => s.id === saleMatch[1] && s.companyId === auth.companyId,
        );
        if (!sale || sale.cancelledAt) fail("Aktif satış bulunamadı.", 404);
        if (saleMatch[2] === "receipt") {
          const amount = cents(body.amount);
          if (!amount || amount > (sale.receivableAmount || 0))
            fail("Tahsilat kalan alacaktan fazla olamaz.");
          sale.receivedAmount = (sale.receivedAmount || 0) + amount;
          sale.receivableAmount -= amount;
          data.receipts ||= [];
          data.receipts.push({
            id: crypto.randomUUID(),
            companyId: auth.companyId,
            saleId: sale.id,
            propertyTitle: sale.propertyTitle,
            amount,
            date: body.date,
            note: body.note || "",
            createdById: auth.user.id,
            createdAt: new Date().toISOString(),
          });
          audit(data, auth, "receipt_created", sale.id, { amount });
        } else {
          if ((sale.version || 0) !== body.version)
            fail("Satış değişti. Ekranı yenileyin.", 409);
          if (!body.reason.trim()) fail("Düzeltme veya iptal nedenini yazın.");
          if (sale.distributedAt) fail("Önce dağıtımı geri alın.", 409);
          const before = JSON.parse(JSON.stringify(sale));
          if (saleMatch[2] === "edit") {
            const ids = data.companyMemberships
              .filter(
                (m) =>
                  m.companyId === auth.companyId &&
                  m.status === "active" &&
                  m.role === "agent",
              )
              .map((m) => m.userId);
            if (
              !ids.includes(body.advisorId) ||
              ![body.customerSourceId, body.propertySourceId].every(
                (id) => id === "emlak" || ids.includes(id),
              )
            )
              fail("Danışman ve kaynakları bu ofisten seçin.");
            const total = cents(body.totalAmount);
            if (!total || total < (sale.receivedAmount || 0))
              fail("Toplam komisyon tahsil edilen tutardan az olamaz.");
            Object.assign(sale, {
              totalAmount: total,
              gross: total,
              net: total,
              receivableAmount: total - (sale.receivedAmount || 0),
              advisorId: body.advisorId,
              customerSourceId: body.customerSourceId,
              propertySourceId: body.propertySourceId,
              distributionRules: accounting.rulesFor(data, auth.companyId),
            });
            const member = data.companyMemberships.find(
              (m) =>
                m.companyId === auth.companyId && m.userId === body.advisorId,
            );
            sale.departmentId = member.departmentId;
            sale.departmentName =
              data.departments.find((d) => d.id === member.departmentId)
                ?.name || "";
          } else {
            sale.cancelledAt = new Date().toISOString();
            const property = data.properties.find(
              (p) => p.id === sale.propertyId && p.companyId === auth.companyId,
            );
            const customer = data.customers.find(
              (c) => c.id === sale.customerId && c.companyId === auth.companyId,
            );
            if (property && ["satildi", "kiralandi"].includes(property.status))
              property.status =
                sale.previousPropertyStatus ||
                (sale.transactionType === "kiralik" ? "kiralik" : "satilik");
            if (
              customer &&
              !data.sales.some(
                (s) =>
                  s.id !== sale.id &&
                  s.customerId === customer.id &&
                  s.companyId === auth.companyId &&
                  !s.cancelledAt,
              )
            ) {
              customer.status = sale.previousCustomerStatus || "aktif";
              customer.pipelineStatus =
                sale.previousCustomerPipelineStatus || customer.status;
            }
          }
          delete sale.accounting;
          delete sale.accountingDraft;
          sale.companyNet = 0;
          audit(
            data,
            auth,
            saleMatch[2] === "edit" ? "sale_corrected" : "sale_cancelled",
            sale.id,
            { reason: body.reason, before },
          );
        }
        sale.version = (sale.version || 0) + 1;
        sale.updatedAt = new Date().toISOString();
      }
      data.brokerRequests.push({
        id: body.requestId,
        companyId: auth.companyId,
        path: pathname,
      });
      save(data);
      return { success: true };
    }),
  );
}
module.exports = { handle, audit, ledger };
