"use strict";
const crypto = require("node:crypto");
const { withDBLock } = require("./db");
const { fail, parseBody, validateFields, jsonResponse } = require("./security");
const { normalizeLeadSource } = require("./customer-source");

const defaultRules = {
  closing: 25,
  customer: 10,
  portfolio: 10,
  companySource: 5,
  corporate: 40,
  team: 8,
  secretary: 3,
  office: 4,
};
const rulesFor = (db, companyId) => ({
  ...defaultRules,
  ...(db.companies || []).find((c) => c.id === companyId)?.distributionRules,
});
const organization = {
  broker: "Sıraç KOLUŞ",
  departments: [
    { key: "rental", name: "Kiralık", responsible: "Mehmet Ali TAŞ" },
    {
      key: "land",
      name: "Arsa",
      responsible: "Arif SANTUR · Departman Müdürü",
    },
    {
      key: "sale_1",
      name: "Satılık 1+1",
      responsible: "Muhammed Mertcan ÇELİK",
    },
    { key: "sale_2", name: "Satılık 2+1", responsible: "Mustafa Koray KÖK" },
    { key: "sale_3", name: "Satılık 3+1, 4+1 ve 5+1", responsible: "Kadir" },
  ],
};
const nameKey = (name) =>
  String(name || "")
    .trim()
    .toLocaleLowerCase("tr-TR");
function companyAdvisors(db, companyId) {
  return (db.companyMemberships || [])
    .filter((m) => m.companyId === companyId && m.role === "agent")
    .map((m) => ({
      ...m,
      user: (db.users || []).find((u) => u.id === m.userId),
    }))
    .filter((m) => m.user);
}
function resolveSource(db, companyId, value) {
  if (!value) return null;
  if (normalizeLeadSource(value) === "emlak")
    return {
      id: "company",
      type: "company",
      name: "Payidar Emlak",
      percent: 5,
    };
  const matches = companyAdvisors(db, companyId).filter(
    (m) => m.userId === value || nameKey(m.user.fullName) === nameKey(value),
  );
  const unique = [...new Map(matches.map((m) => [m.userId, m])).values()];
  if (unique.length !== 1) return null;
  return {
    id: unique[0].userId,
    type: "advisor",
    name: unique[0].user.fullName,
    percent: 10,
  };
}
function departmentKey(name) {
  const value = nameKey(name);
  if (value.includes("kiral")) return "rental";
  if (value.includes("arsa")) return "land";
  if (/3\+1|4\+1|5\+1/.test(value)) return "sale_3";
  if (value.includes("2+1")) return "sale_2";
  if (value.includes("1+1")) return "sale_1";
  return "";
}
// Largest remainder rounding keeps every kurus accounted for, including unallocated funds.
function allocateCents(base, rows) {
  const values = rows.map((row, index) => {
    const product = BigInt(base) * BigInt(row.percent);
    return {
      ...row,
      cents: Number(product / 100n),
      remainder: Number(product % 100n),
      index,
    };
  });
  let left = base - values.reduce((sum, row) => sum + row.cents, 0);
  const ranked = [...values].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  );
  for (let i = 0; i < left; i++) ranked[i % ranked.length].cents++;
  return values.map(({ remainder, index, ...row }) => row);
}
function preview(db, sale, selection = {}) {
  if (sale.accounting?.status === "finalized") return sale.accounting;
  const companyId = sale.companyId;
  const usesTotalCommission = sale.customerSourceId !== undefined;
  const rules = sale.distributionRules || rulesFor(db, companyId);
  const customer = (db.customers || []).find(
    (c) => c.id === sale.customerId && c.companyId === companyId,
  );
  const property = (db.properties || []).find(
    (p) => p.id === sale.propertyId && p.companyId === companyId,
  );
  const advisor = companyAdvisors(db, companyId).find(
    (m) => m.userId === sale.advisorId,
  );
  const dept = (db.departments || []).find(
    (d) => d.id === sale.departmentId && d.companyId === companyId,
  );
  const coordination = (db.departments || []).find(
    (d) => d.companyId === companyId && d.permanent,
  );
  const coordinator = (db.companyMemberships || []).find(
    (m) =>
      m.companyId === companyId &&
      m.status === "active" &&
      m.userId === coordination?.leaderUserId,
  );
  const selectedKey =
    selection.departmentKey ??
    sale.accountingDraft?.departmentKey ??
    departmentKey(sale.departmentName || dept?.name);
  const completingDepartment = organization.departments.find(
    (d) => d.key === selectedKey,
  );
  const customerSource = resolveSource(
    db,
    companyId,
    sale.customerSourceId ?? customer?.leadSource ?? sale.customerLeadSource,
  );
  const portfolioSource = resolveSource(
    db,
    companyId,
    sale.propertySourceId ?? property?.portfolioSource ?? sale.portfolioSource,
  );
  if (usesTotalCommission) {
    if (customerSource)
      customerSource.percent =
        customerSource.type === "company"
          ? rules.companySource
          : rules.customer;
    if (portfolioSource)
      portfolioSource.percent =
        portfolioSource.type === "company"
          ? rules.companySource
          : rules.portfolio;
  }
  const warnings = [];
  const commission = usesTotalCommission
    ? sale.totalAmount
    : sale.receivedAmount;
  const baseCents =
    Number.isSafeInteger(commission) && commission >= 0 ? commission : 0;
  if (usesTotalCommission && baseCents === 0)
    warnings.push("Toplam emlak komisyonu sıfırdan büyük olmalı.");
  else if (sale.receivedAmount == null)
    warnings.push(
      "Eski işlemde fiilen tahsil edilen net komisyon kayıtlı değil.",
    );
  else if (baseCents === 0) warnings.push("Henüz net komisyon tahsilatı yok.");
  if (!advisor)
    warnings.push("İşlemi tamamlayan danışman bu ofiste bulunamadı.");
  if (!usesTotalCommission && !completingDepartment)
    warnings.push("İşlemi tamamlayan beş dağıtım departmanından birini seçin.");
  if (!customerSource)
    warnings.push(
      "Müşterinin talep kaynağını Emlak veya tek bir danışmanla eşleştirin.",
    );
  if (!portfolioSource)
    warnings.push("Portföy kaynağını portföy kaydından seçin.");
  const rows = [];
  const add = (key, title, recipient, percent) =>
    rows.push({
      key,
      title,
      recipientId: recipient.id,
      recipientType: recipient.type,
      recipientName: recipient.name,
      percent,
    });
  const company = { id: "company", type: "company", name: "Payidar Emlak" };
  if (advisor)
    add(
      "closing",
      "İşlemi tamamlama",
      { id: advisor.userId, type: "advisor", name: advisor.user.fullName },
      usesTotalCommission
        ? rules.closing +
            (customerSource?.type === "company"
              ? rules.customer - rules.companySource
              : 0) +
            (portfolioSource?.type === "company"
              ? rules.portfolio - rules.companySource
              : 0)
        : 25,
    );
  if (customerSource)
    add("customer", "Müşteri katkısı", customerSource, customerSource.percent);
  if (portfolioSource)
    add(
      "portfolio",
      "Portföy katkısı",
      portfolioSource,
      portfolioSource.percent,
    );
  add(
    "corporate",
    "Şirket kurumsal payı",
    company,
    usesTotalCommission ? rules.corporate : 40,
  );
  const pools = new Map();
  if (usesTotalCommission) {
    const addPool = (key, title, percent, recipients, warning) => {
      if (percent === 0) return;
      if (recipients.length === 0) {
        warnings.push(warning);
        return;
      }
      pools.set(
        key,
        recipients.sort((a, b) => a.id.localeCompare(b.id)),
      );
      add(key, title, { id: key, type: "pool", name: title }, percent);
    };
    addPool(
      "team",
      "Diğer danışmanların payı",
      8,
      companyAdvisors(db, companyId)
        .filter(
          (m) =>
            m.status === "active" &&
            m.userId !== sale.advisorId &&
            m.userId !== coordinator?.userId,
        )
        .map((m) => ({ id: m.userId, type: "advisor", name: m.user.fullName })),
      "%8 pay için satışı bitiren dışında aktif danışman bulunamadı.",
    );
    add(
      "office",
      "Ofis gideri",
      { id: "office", type: "expense", name: "Ofis gideri" },
      rules.office,
    );
  } else {
    if (completingDepartment)
      for (const d of organization.departments.filter(
        (d) => d.key !== selectedKey,
      ))
        add(
          "department-" + d.key,
          "Departman dayanışma payı",
          { id: "department:" + d.key, type: "department", name: d.name },
          2,
        );
    add(
      "reserve",
      "Şirket katkı rezervi",
      {
        id: "reserve",
        type: "reserve",
        name: "Payidar Emlak · İşletme rezervi",
      },
      4,
    );
  }
  add(
    "coordination",
    "Genel danışman",
    {
      id: coordinator?.userId || "coordinator",
      type: coordinator?.role === "secretary" ? "secretary" : "advisor",
      name: "Genel danışman",
    },
    defaultRules.secretary,
  );
  const totalPercent = rows.reduce((sum, row) => sum + row.percent, 0);
  const unallocatedPercent = 100 - totalPercent;
  if (
    !usesTotalCommission &&
    customerSource &&
    portfolioSource &&
    unallocatedPercent > 0 &&
    completingDepartment &&
    advisor
  )
    warnings.push(
      `Metindeki oranlar %${totalPercent} ediyor. Kalan %${unallocatedPercent} için hak sahibi belirtilmedi; dağıtım kesinleştirilemez.`,
    );
  const rounded = allocateCents(baseCents, [
    ...rows,
    { key: "unallocated", percent: unallocatedPercent },
  ]);
  const lines = rounded
    .filter((r) => r.key !== "unallocated")
    .flatMap((row) => {
      const recipients = pools.get(row.key);
      if (!recipients) return [row];
      const count = recipients.length;
      return recipients.map((recipient, index) => ({
        ...row,
        key: row.key + "-" + recipient.id,
        recipientId: recipient.id,
        recipientType: recipient.type,
        recipientName: recipient.name,
        percent: row.percent / count,
        cents:
          Math.floor(row.cents / count) + Number(index < row.cents % count),
      }));
    });
  const unallocatedCents = rounded.find((r) => r.key === "unallocated").cents;
  const beneficiaries = [
    ...lines
      .reduce((map, row) => {
        const key = row.recipientId;
        const item = map.get(key) || {
          id: key,
          name: row.recipientName,
          type: row.recipientType,
          percent: 0,
          cents: 0,
          contributions: [],
        };
        item.percent += row.percent;
        item.cents += row.cents;
        item.contributions.push(row.title);
        map.set(key, item);
        return map;
      }, new Map())
      .values(),
  ];
  const result = {
    version: usesTotalCommission ? 2 : 1,
    saleId: sale.id,
    status: "draft",
    baseCents,
    transactionType:
      sale.transactionType ||
      (property?.status === "kiralandi" ? "kiralik" : "satilik"),
    propertyType: sale.propertyType || property?.type || "diger",
    customerName: customer?.name || sale.customerName || "Silinmiş müşteri",
    propertyTitle: property?.title || sale.propertyTitle,
    advisor: advisor
      ? { id: advisor.userId, name: advisor.user.fullName }
      : null,
    departmentKey: selectedKey,
    departmentName: completingDepartment?.name || "Seçilmedi",
    crmDepartmentName: sale.departmentName || dept?.name || "Atanmamış",
    customerSource,
    portfolioSource,
    lines,
    beneficiaries,
    totalPercent,
    unallocatedPercent,
    unallocatedCents,
    allocatedCents: baseCents - unallocatedCents,
    companyCents: lines
      .filter((r) => ["company", "reserve"].includes(r.recipientType))
      .reduce((s, r) => s + r.cents, 0),
    warnings,
    canFinalize: warnings.length === 0 && totalPercent === 100,
  };
  return {
    ...result,
    revision: crypto
      .createHash("sha256")
      .update(JSON.stringify(result))
      .digest("hex"),
  };
}
function overview(db, companyId) {
  const sales = (db.sales || []).filter(
    (s) => s.companyId === companyId && !s.cancelledAt,
  );
  const results = sales.map((s) => preview(db, s));
  const finalized = results.filter((r) => r.status === "finalized");
  const totals = {
    collected: sales.reduce((sum, s) => sum + (s.receivedAmount || 0), 0),
    receivable: sales.reduce((sum, s) => sum + (s.receivableAmount || 0), 0),
    finalized: finalized.reduce((sum, r) => sum + r.allocatedCents, 0),
    pending: results
      .filter((r) => r.status !== "finalized")
      .reduce((sum, r) => sum + r.baseCents, 0),
    company: finalized.reduce((sum, r) => sum + r.companyCents, 0),
  };
  const beneficiaries = [
    ...finalized
      .flatMap((r) => r.beneficiaries)
      .reduce((map, row) => {
        const item = map.get(row.id) || { ...row, cents: 0, count: 0 };
        item.cents += row.cents;
        item.count++;
        map.set(row.id, item);
        return map;
      }, new Map())
      .values(),
  ];
  return { organization, totals, beneficiaries, results };
}
async function handle(req, res, auth, db, pathname) {
  const paymentMatch = pathname.match(/^\/api\/finance\/([^/]+)\/(paid|undo)$/);
  if (paymentMatch) {
    if (!["owner", "admin"].includes(auth.membership.role))
      fail("Broker yetkisi gereklidir.", 403);
    if (req.method !== "POST") fail("İşlem desteklenmiyor.", 405);
    const body = await parseBody(req);
    validateFields(body, { revision: "string" }, ["revision"]);
    const result = await withDBLock((data, save) => {
      const sale = (data.sales || []).find(
        (s) => s.id === paymentMatch[1] && s.companyId === auth.companyId,
      );
      if (!sale || sale.cancelledAt) fail("Satış bulunamadı.", 404);
      const calculation = preview(data, sale);
      if (body.revision !== calculation.revision)
        fail("Bilgiler değişti. Ekranı yenileyin.", 409);
      if (paymentMatch[2] === "paid") {
        if (!calculation.canFinalize && calculation.status !== "finalized")
          fail("Önce dağıtım detayındaki eksikleri tamamlayın.");
        sale.accounting = {
          ...calculation,
          status: "finalized",
          savedAt: new Date().toISOString(),
          savedById: auth.user.id,
        };
        sale.companyNet = calculation.companyCents;
        sale.distributedAt ||= new Date().toISOString();
      } else {
        delete sale.distributedAt;
        delete sale.accounting;
        delete sale.accountingDraft;
        if (sale.customerSourceId !== undefined)
          sale.distributionRules = rulesFor(data, auth.companyId);
        sale.companyNet = 0;
      }
      data.auditLogs ||= [];
      data.auditLogs.push({
        id: crypto.randomUUID(),
        companyId: auth.companyId,
        userId: auth.user.id,
        saleId: sale.id,
        action:
          paymentMatch[2] === "paid"
            ? "distribution_paid"
            : "distribution_undone",
        createdAt: new Date().toISOString(),
      });
      save(data);
      return { success: true };
    });
    jsonResponse(res, 200, result);
    return true;
  }
  if (pathname === "/api/finance/rules") {
    if (!["owner", "admin"].includes(auth.membership.role))
      fail("Broker yetkisi gereklidir.", 403);
    if (req.method === "GET") {
      jsonResponse(res, 200, rulesFor(db, auth.companyId));
      return true;
    }
    if (req.method !== "POST") fail("??lem desteklenmiyor.", 405);
    const body = await parseBody(req);
    validateFields(
      body,
      Object.fromEntries(Object.keys(defaultRules).map((k) => [k, "number"])),
      Object.keys(defaultRules),
    );
    if (body.secretary !== defaultRules.secretary)
      fail("Genel danışman payı %3 olmalıdır.");
    if (
      Object.values(body).some(
        (v) => !Number.isInteger(v) || v < 0 || v > 100,
      ) ||
      Object.entries(body)
        .filter(([k]) => k !== "companySource")
        .reduce((sum, [, v]) => sum + v, 0) !== 100 ||
      body.companySource > Math.min(body.customer, body.portfolio)
    )
      fail(
        "Oranlar 0?100 aras? tam say? ve toplam %100 olmal?. Emlak kaynak pay? dan??man kaynak paylar?n? a?amaz.",
      );
    await withDBLock((data, save) => {
      const company = data.companies.find((c) => c.id === auth.companyId);
      company.distributionRules = body;
      save(data);
    });
    jsonResponse(res, 200, body);
    return true;
  }
  const match = pathname.match(/^\/api\/finance\/([^/]+)\/distribution$/);
  if (!match) return false;
  if (!["owner", "admin"].includes(auth.membership.role))
    fail("Bu işlem broker yetkisi gerektirir.", 403);
  const findSale = (data) => {
    const sale = (data.sales || []).find(
      (s) => s.id === match[1] && s.companyId === auth.companyId,
    );
    if (!sale || sale.cancelledAt) fail("Muhasebe işlemi bulunamadı.", 404);
    return sale;
  };
  if (req.method === "GET") {
    const key = new URL(req.url, "http://localhost").searchParams.get(
      "departmentKey",
    );
    const result = preview(
      db,
      findSale(db),
      key === null ? {} : { departmentKey: key },
    );
    jsonResponse(res, 200, { ...result, organization });
    return true;
  }
  if (req.method !== "POST") fail("İşlem desteklenmiyor.", 405);
  const body = await parseBody(req);
  validateFields(body, { departmentKey: "string", revision: "string" }, [
    "revision",
  ]);
  if (
    body.departmentKey &&
    !organization.departments.some((d) => d.key === body.departmentKey)
  )
    fail("Dağıtım departmanı geçersiz.");
  const result = await withDBLock((data, save) => {
    const sale = findSale(data);
    if (sale.accounting?.status === "finalized") return sale.accounting;
    const calculation = preview(data, sale, {
      departmentKey: body.departmentKey,
    });
    if (body.revision !== calculation.revision)
      fail("İşlem bilgileri değişti. Dağıtımı yeniden açıp kontrol edin.", 409);
    const now = new Date().toISOString();
    if (calculation.canFinalize) {
      sale.accounting = {
        ...calculation,
        status: "finalized",
        savedAt: now,
        savedById: auth.user.id,
      };
      sale.companyNet = calculation.companyCents;
    } else {
      sale.accountingDraft = {
        departmentKey: calculation.departmentKey,
        savedAt: now,
        savedById: auth.user.id,
      };
    }
    data.auditLogs ||= [];
    data.auditLogs.push({
      id: crypto.randomUUID(),
      companyId: auth.companyId,
      userId: auth.user.id,
      action: calculation.canFinalize
        ? "commission_finalized"
        : "commission_draft_saved",
      saleId: sale.id,
      createdAt: now,
      revision: calculation.revision,
    });
    save(data);
    return (
      sale.accounting || {
        ...calculation,
        savedAt: now,
        savedById: auth.user.id,
      }
    );
  });
  jsonResponse(res, 200, result);
  return true;
}
module.exports = { preview, overview, handle, organization, rulesFor };
