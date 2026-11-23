"use strict";
const crypto = require("node:crypto");
const { withDBLock } = require("./db");
const { fail, parseBody, validateFields, jsonResponse } = require("./security");
const { normalizeLeadSource } = require("./customer-source");

const organization = {
  broker: "Sıraç KOLUŞ",
  coordinator: "Elanur ERİPEK",
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
    customer?.leadSource ?? sale.customerLeadSource,
  );
  const portfolioSource = resolveSource(
    db,
    companyId,
    property?.portfolioSource ?? sale.portfolioSource,
  );
  const warnings = [];
  const baseCents =
    Number.isSafeInteger(sale.receivedAmount) && sale.receivedAmount >= 0
      ? sale.receivedAmount
      : 0;
  if (sale.receivedAmount == null)
    warnings.push(
      "Eski işlemde fiilen tahsil edilen net komisyon kayıtlı değil.",
    );
  else if (baseCents === 0) warnings.push("Henüz net komisyon tahsilatı yok.");
  if (!advisor)
    warnings.push("İşlemi tamamlayan danışman bu ofiste bulunamadı.");
  if (!completingDepartment)
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
      25,
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
  add("corporate", "Şirket kurumsal payı", company, 40);
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
  const coordinatorMembers = (db.companyMemberships || []).filter(
    (m) => m.companyId === companyId,
  );
  const coordinatorUsers = (db.users || []).filter(
    (u) =>
      coordinatorMembers.some((m) => m.userId === u.id) &&
      nameKey(u.fullName) === nameKey(organization.coordinator),
  );
  add(
    "coordination",
    "Genel koordinasyon",
    {
      id:
        coordinatorUsers.length === 1 ? coordinatorUsers[0].id : "coordinator",
      type: "advisor",
      name: organization.coordinator,
    },
    3,
  );
  add(
    "reserve",
    "Şirket katkı rezervi",
    { id: "reserve", type: "reserve", name: "Payidar Emlak · İşletme rezervi" },
    4,
  );
  const totalPercent = rows.reduce((sum, row) => sum + row.percent, 0);
  const unallocatedPercent = 100 - totalPercent;
  if (
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
  const lines = rounded.filter((r) => r.key !== "unallocated");
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
    version: 1,
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
  const sales = (db.sales || []).filter((s) => s.companyId === companyId);
  const results = sales.map((s) => preview(db, s));
  const finalized = results.filter((r) => r.status === "finalized");
  const totals = {
    collected: results.reduce((sum, r) => sum + r.baseCents, 0),
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
  const match = pathname.match(/^\/api\/finance\/([^/]+)\/distribution$/);
  if (!match) return false;
  if (!["owner", "admin"].includes(auth.membership.role))
    fail("Bu işlem broker yetkisi gerektirir.", 403);
  const findSale = (data) => {
    const sale = (data.sales || []).find(
      (s) => s.id === match[1] && s.companyId === auth.companyId,
    );
    if (!sale) fail("Muhasebe işlemi bulunamadı.", 404);
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
module.exports = { preview, overview, handle, organization };
