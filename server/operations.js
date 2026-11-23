"use strict";
const crypto = require("node:crypto");
const { withDBLock } = require("./db");
const { hashPassword } = require("./auth");
const { normalizeLeadSource } = require("./customer-source");
const accounting = require("./accounting");
const { parseBody, jsonResponse, fail, validateFields } = require("./security");
const broker = (auth) => ["owner", "admin"].includes(auth.membership.role);
const owns = (record, auth) =>
  (record.assignedToUserId || record.createdById) === auth.user.id;
function scope(db, auth) {
  if (broker(auth)) return;
  if (auth.membership.role === "secretary") return;
  for (const key of ["properties", "customers"])
    db[key] = (db[key] || []).filter(
      (x) => x.companyId === auth.companyId && owns(x, auth),
    );
  db.followUps = (db.followUps || []).filter(
    (x) =>
      x.companyId === auth.companyId && x.assignedToUserId === auth.user.id,
  );
}
function amount(value) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1e12
  )
    fail("Geçersiz tutar.");
  return Math.round(value * 100);
}
function members(db, companyId) {
  return (db.companyMemberships || []).filter(
    (m) => m.companyId === companyId && m.status === "active",
  );
}
function requireBroker(auth) {
  if (!broker(auth)) fail("Bu işlem broker yetkisi gerektirir.", 403);
}
async function handle(req, res, auth, db, pathname) {
  if (await accounting.handle(req, res, auth, db, pathname)) return true;
  if (await require("./network").handle(req, res, auth, db, pathname))
    return true;
  if (await require("./media").handle(req, res, auth, db, pathname))
    return true;
  if (pathname === "/api/locations" && req.method === "GET") {
    const locations = require("../data/locations.json");
    const params = new URL(req.url, "http://localhost").searchParams;
    const city = locations.provinces.find((p) => p.name === params.get("city"));
    const district = locations.districts.find(
      (d) => d.provinceId === city?.id && d.name === params.get("district"),
    );
    jsonResponse(res, 200, {
      cities: locations.provinces.map((p) => p.name),
      districts: locations.districts
        .filter((d) => d.provinceId === city?.id)
        .map((d) => d.name),
      neighborhoods: locations.neighborhoods
        .filter((n) => n.districtId === district?.id)
        .map((n) => n.name),
    });
    return true;
  }
  if (!broker(auth) && req.method !== "GET") {
    const match = pathname.match(/^\/api\/(properties|customers)\/([^/]+)$/);
    const record =
      match &&
      (db[match[1]] || []).find(
        (x) => x.id === match[2] && x.companyId === auth.companyId,
      );
    if (record && !owns(record, auth))
      fail("Bu kaydı düzenleme yetkiniz yok.", 403);
  }
  if (
    ["POST", "PUT"].includes(req.method) &&
    /^\/api\/(properties|customers)(?:\/[^/]+)?$/.test(pathname)
  ) {
    const body = await parseBody(req);
    const collection = pathname.split("/")[2];
    const id = pathname.split("/")[3];
    const existing =
      id &&
      (db[collection] || []).find(
        (item) => item.id === id && item.companyId === auth.companyId,
      );
    const merged = { ...existing, ...body };
    if (
      collection === "customers" &&
      (merged.preferredFloorTypes || []).some(
        (type) => !["zemin_kat", "ara_kat", "ust_kat"].includes(type),
      )
    )
      fail("Tercih edilen kat konumu geçersiz.");
    if (
      collection === "customers" &&
      !merged.preferredCity &&
      (merged.preferredNeighborhoods || []).length
    )
      fail("Mahalle seçmek için önce il ve ilçe seçin.");
    if (collection === "customers" && merged.preferredCity) {
      const locations = require("../data/locations.json");
      const city = locations.provinces.find(
        (province) => province.name === merged.preferredCity,
      );
      if (!city) fail("Tercih edilen il geçersiz.");
      const allowedDistricts = new Set(
        locations.districts
          .filter((district) => district.provinceId === city.id)
          .map((district) => district.name),
      );
      if (
        (merged.preferredDistricts || []).some(
          (district) => !allowedDistricts.has(district),
        )
      )
        fail("Tercih edilen ilçeler seçilen ile ait olmalı.");
      const selectedDistrictIds = new Set(
        locations.districts
          .filter(
            (district) =>
              district.provinceId === city.id &&
              (merged.preferredDistricts || []).includes(district.name),
          )
          .map((district) => district.id),
      );
      const allowedNeighborhoods = new Set(
        locations.neighborhoods
          .filter((neighborhood) =>
            selectedDistrictIds.has(neighborhood.districtId),
          )
          .map((neighborhood) => neighborhood.name),
      );
      if (
        (merged.preferredNeighborhoods || []).some(
          (neighborhood) => !allowedNeighborhoods.has(neighborhood),
        )
      )
        fail("Tercih edilen mahalleler seçilen ilçelere ait olmalı.");
    }
    const assignedId =
      merged.assignedToUserId || existing?.createdById || auth.user.id;
    const member = members(db, auth.companyId).find(
      (m) => m.userId === assignedId,
    );
    if (!member) fail("Sorumlu çalışan bu ofise ait olmalı.");
    const dept = (db.departments || []).find(
      (d) => d.id === member.departmentId && d.companyId === auth.companyId,
    );
    const criteria = dept?.customCriteria || {};
    if (member.role === "agent" && dept) {
      const selections =
        collection === "properties"
          ? {
              types: [merged.type || "daire"],
              statuses: [
                { satildi: "satilik", kiralandi: "kiralik" }[merged.status] ||
                  merged.status ||
                  "satilik",
              ],
              rooms: merged.type === "arsa" ? [] : [merged.rooms || "3+1"],
              districts: merged.district ? [merged.district] : [],
            }
          : {
              types: merged.preferredTypes || [],
              statuses: merged.preferredStatuses || [],
              rooms: merged.preferredRooms || [],
              districts: merged.preferredDistricts || [],
            };
      for (const [key, values] of Object.entries(selections))
        if (
          criteria[key]?.length &&
          values.length &&
          !values.some((value) => criteria[key].includes(value))
        )
          fail(
            "Seçilen danışmanın departmanı bu kaydın " +
              {
                types: "ürün",
                statuses: "işlem",
                rooms: "oda",
                districts: "bölge",
              }[key] +
              " kriterine uygun değil.",
          );
    }
  }
  const companyId = auth.companyId;
  const send = (data, status = 200) => {
    jsonResponse(res, status, data);
    return true;
  };
  if (
    ["POST", "PUT"].includes(req.method) &&
    /^\/api\/departments(?:\/[^/]+)?$/.test(pathname)
  ) {
    requireBroker(auth);
    const body = await parseBody(req);
    const criteria = body.customCriteria || {};
    const allowed = {
      types: [
        "daire",
        "villa",
        "mustakil",
        "residans",
        "arsa",
        "isyeri",
        "dukkan",
      ],
      statuses: ["satilik", "kiralik"],
      rooms: ["1+0", "1+1", "2+1", "3+1", "4+1", "5+1", "6+1", "7+1"],
    };
    for (const [key, values] of Object.entries(allowed))
      if (
        criteria[key] !== undefined &&
        (!Array.isArray(criteria[key]) ||
          criteria[key].some((value) => !values.includes(value)))
      )
        fail("Departman kriteri geçersiz.");
    if (
      criteria.districts !== undefined &&
      (!Array.isArray(criteria.districts) ||
        criteria.districts.some((value) => typeof value !== "string"))
    )
      fail("Bölge seçimi geçersiz.");
  }
  if (pathname === "/api/staff" && req.method === "POST") {
    requireBroker(auth);
    const body = await parseBody(req);
    validateFields(
      body,
      {
        username: "string",
        password: "string",
        fullName: "string",
        departmentId: "string",
        role: "string",
      },
      ["username", "password", "fullName", "departmentId", "role"],
    );
    if (/\s/.test(body.username)) fail("Kullanıcı adında boşluk olmamalı.");
    if (!["agent", "secretary"].includes(body.role)) fail("Geçersiz rol.");
    const passwordHash = hashPassword(body.password);
    await withDBLock((data, save) => {
      if (
        data.users.some((u) =>
          [u.username, u.email].some(
            (v) => v?.toLowerCase() === body.username.toLowerCase(),
          ),
        )
      )
        fail("Kullanıcı adı kullanılıyor.", 409);
      const dept = (data.departments || []).find(
        (d) => d.id === body.departmentId && d.companyId === companyId,
      );
      if (!dept) fail("Bu ofise ait departman seçin.");
      const id = crypto.randomUUID();
      data.users.push({
        id,
        username: body.username.toLowerCase(),
        email: id + "@local.invalid",
        fullName: body.fullName.trim(),
        passwordHash,
        status: "active",
        createdAt: new Date().toISOString(),
      });
      data.companyMemberships.push({
        id: crypto.randomUUID(),
        userId: id,
        companyId,
        role: body.role,
        status: "active",
        departmentId: dept.id,
        joinedAt: new Date().toISOString(),
      });
      dept.assignedUserIds = [
        ...new Set([...(dept.assignedUserIds || []), id]),
      ];
      save(data);
    });
    return send({ success: true }, 201);
  }
  if (pathname === "/api/sales" && req.method === "POST") {
    requireBroker(auth);
    const body = await parseBody(req);
    const paymentEntry =
      body.receivedAmount !== undefined || body.receivableAmount !== undefined;
    validateFields(
      body,
      {
        propertyId: "string",
        customerId: "string",
        advisorId: "string",
        gross: "number",
        deductions: "number",
        distributable: "number",
        shares: "array",
        requestId: "string",
        receivedAmount: "number",
        receivableAmount: "number",
        isCredit: "boolean",
      },
      [
        "propertyId",
        "customerId",
        "advisorId",
        ...(paymentEntry
          ? ["receivedAmount", "receivableAmount", "isCredit"]
          : ["gross", "deductions", "distributable"]),
        "requestId",
      ],
    );
    if (
      paymentEntry &&
      ["gross", "deductions", "distributable", "shares"].some(
        (key) => body[key] !== undefined,
      )
    )
      fail(
        "Tahsilat alanlarıyla eski komisyon alanları birlikte kullanılamaz.",
      );
    const receivedAmount = paymentEntry ? amount(body.receivedAmount) : null;
    const receivableAmount = paymentEntry
      ? amount(body.receivableAmount)
      : null;
    const totalAmount = paymentEntry ? receivedAmount + receivableAmount : null;
    const gross = paymentEntry ? totalAmount : amount(body.gross),
      deductions = paymentEntry ? 0 : amount(body.deductions),
      distributable = paymentEntry ? 0 : amount(body.distributable);
    if (deductions > gross || distributable > gross - deductions)
      fail("Kesinti ve dağıtılacak tutar net kazancı aşamaz.");
    let sale;
    await withDBLock((data, save) => {
      data.sales ||= [];
      sale = data.sales.find(
        (s) => s.companyId === companyId && s.requestId === body.requestId,
      );
      if (sale) return;
      const prop = data.properties.find(
        (p) => p.id === body.propertyId && p.companyId === companyId,
      );
      const customer = data.customers.find(
        (c) => c.id === body.customerId && c.companyId === companyId,
      );
      const member = members(data, companyId).find(
        (m) => m.userId === body.advisorId,
      );
      if (!prop || !customer || !member)
        fail("Satış kayıtları aynı ofise ait olmalı.");
      if (
        ["satildi", "kiralandi"].includes(prop.status) ||
        data.sales.some(
          (s) => s.companyId === companyId && s.propertyId === prop.id,
        )
      )
        fail("Bu portföyün satışı zaten kapatıldı.", 409);
      const departments = (data.departments || []).filter(
        (d) => d.companyId === companyId,
      );
      const targets = [
        { id: "company", name: "Emlak şirketi" },
        ...departments,
      ];
      const shares = (body.shares || []).map((value) => {
        const split = value.lastIndexOf("=");
        return {
          id: value.slice(0, split),
          percent: Number(value.slice(split + 1)),
        };
      });
      if (
        !paymentEntry &&
        (shares.length !== targets.length ||
          new Set(shares.map((s) => s.id)).size !== targets.length ||
          shares.some(
            (s) =>
              !targets.some((t) => t.id === s.id) ||
              !Number.isFinite(s.percent) ||
              s.percent < 0 ||
              s.percent > 100,
          ) ||
          Math.abs(shares.reduce((sum, s) => sum + s.percent, 0) - 100) >
            0.00001)
      )
        fail("Şirket ve tüm departmanların payı toplam yüzde 100 olmalı.");
      let remaining = distributable;
      const allocations = shares.map((share, i) => {
        const cents =
          i === shares.length - 1
            ? remaining
            : Math.floor((distributable * share.percent) / 100);
        remaining -= cents;
        return {
          ...share,
          name: targets.find((t) => t.id === share.id).name,
          cents,
        };
      });
      sale = {
        id: crypto.randomUUID(),
        requestId: body.requestId,
        companyId,
        propertyId: prop.id,
        propertyTitle: prop.title,
        transactionType: prop.status === "kiralik" ? "kiralik" : "satilik",
        propertyType: prop.type,
        portfolioSource: prop.portfolioSource || null,
        customerId: customer.id,
        customerName: customer.name,
        customerLeadSource: normalizeLeadSource(customer.leadSource),
        advisorId: member.userId,
        departmentId: member.departmentId,
        departmentName:
          departments.find((d) => d.id === member.departmentId)?.name || "",
        ...(paymentEntry
          ? {
              receivedAmount,
              receivableAmount,
              totalAmount,
              isCredit: body.isCredit,
            }
          : {}),
        gross,
        deductions,
        net: gross - deductions,
        distributable,
        companyNet: paymentEntry
          ? receivedAmount
          : gross -
            deductions -
            distributable +
            (allocations.find((a) => a.id === "company")?.cents || 0),
        allocations,
        createdAt: new Date().toISOString(),
        createdById: auth.user.id,
      };
      data.sales.push(sale);
      prop.status = prop.status === "kiralik" ? "kiralandi" : "satildi";
      prop.updatedAt = sale.createdAt;
      customer.pipelineStatus = customer.status = "kapandi_basarili";
      customer.updatedAt = sale.createdAt;
      save(data);
    });
    return send(sale, 201);
  }
  if (pathname === "/api/finance" && req.method === "GET") {
    requireBroker(auth);
    const summary = accounting.overview(db, companyId);
    return send({
      accounting: summary,
      sales: (db.sales || [])
        .filter((s) => s.companyId === companyId)
        .map((sale) => {
          const customer = (db.customers || []).find(
            (c) => c.id === sale.customerId && c.companyId === companyId,
          );
          return {
            ...sale,
            distribution: summary.results.find((r) => r.saleId === sale.id),
            customerName:
              customer?.name || sale.customerName || "Silinmiş müşteri",
            customerLeadSource: normalizeLeadSource(
              customer?.leadSource ?? sale.customerLeadSource,
            ),
          };
        }),
    });
  }
  if (pathname === "/api/reports" && req.method === "GET") {
    requireBroker(auth);
    const month =
      new URL(req.url, "http://localhost").searchParams.get("month") ||
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
      }).format(new Date());
    if (!/^\d{4}-\d{2}$/.test(month)) fail("Geçersiz ay.");
    const dateKey = (date) =>
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(date));
    const sales = (db.sales || []).filter((s) => s.companyId === companyId);
    const now = new Date();
    const today = dateKey(now);
    const start = new Date(today + "T00:00:00+03:00");
    start.setUTCDate(
      start.getUTCDate() -
        ((new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7),
    );
    const weekStart = dateKey(start);
    const periods = [
      ["Günlük", (s) => dateKey(s.createdAt) === today],
      [
        "Haftalık",
        (s) =>
          dateKey(s.createdAt) >= weekStart && dateKey(s.createdAt) <= today,
      ],
      ["Aylık", (s) => dateKey(s.createdAt).startsWith(month)],
      ["Yıllık", (s) => dateKey(s.createdAt).startsWith(today.slice(0, 4))],
    ].map(([name, filter]) => ({
      name,
      count: sales.filter(filter).length,
      net: sales.filter(filter).reduce((a, s) => a + s.companyNet, 0),
    }));
    const ranking = members(db, companyId)
      .filter((m) => m.role === "agent")
      .map((m) => {
        const user = db.users.find((u) => u.id === m.userId);
        return {
          id: m.userId,
          name: user?.fullName,
          department:
            (db.departments || []).find((d) => d.id === m.departmentId)?.name ||
            "Atanmamış",
          revenue: sales
            .filter(
              (s) =>
                s.advisorId === m.userId &&
                dateKey(s.createdAt).startsWith(month),
            )
            .reduce((a, s) => a + s.companyNet, 0),
          properties: (db.properties || []).filter(
            (p) =>
              p.companyId === companyId &&
              p.createdById === m.userId &&
              p.createdAt &&
              dateKey(p.createdAt).startsWith(month),
          ).length,
          followups: (db.followUps || []).filter(
            (t) =>
              t.companyId === companyId &&
              t.assignedToUserId === m.userId &&
              t.isCompleted &&
              t.completedAt &&
              dateKey(t.completedAt).startsWith(month),
          ).length,
        };
      });
    return send({
      periods,
      ranking,
      month,
      awards: (db.awards || []).filter(
        (a) => a.companyId === companyId && a.month === month,
      ),
    });
  }
  if (pathname === "/api/awards" && req.method === "POST") {
    requireBroker(auth);
    const body = await parseBody(req);
    validateFields(
      body,
      { month: "string", userId: "string", criterion: "string" },
      ["month", "userId", "criterion"],
    );
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month) ||
      !["sales", "properties", "followups"].includes(body.criterion)
    )
      fail("Ay ve kriter seçin.");
    await withDBLock((data, save) => {
      if (
        !members(data, companyId).some(
          (m) => m.userId === body.userId && m.role === "agent",
        )
      )
        fail("Danışman seçin.");
      if (body.criterion === "sales") {
        const totals = new Map();
        for (const sale of (data.sales || []).filter(
          (s) =>
            s.companyId === companyId &&
            new Intl.DateTimeFormat("sv-SE", {
              timeZone: "Europe/Istanbul",
              year: "numeric",
              month: "2-digit",
            }).format(new Date(s.createdAt)) === body.month,
        ))
          totals.set(
            sale.advisorId,
            (totals.get(sale.advisorId) || 0) + sale.companyNet,
          );
        const highest = Math.max(0, ...totals.values());
        if (highest <= 0 || totals.get(body.userId) !== highest)
          fail(
            "Satış kriterinde şirket kasasına en yüksek katkıyı sağlayan danışmanı seçin.",
          );
      }
      data.awards ||= [];
      data.awards = data.awards.filter(
        (a) =>
          !(
            a.companyId === companyId &&
            a.month === body.month &&
            a.criterion === body.criterion
          ),
      );
      data.awards.push({
        ...body,
        companyId,
        createdById: auth.user.id,
        createdAt: new Date().toISOString(),
      });
      save(data);
    });
    return send({ success: true });
  }

  if (
    ["POST", "PUT"].includes(req.method) &&
    /^\/api\/properties(?:\/[^/]+)?$/.test(pathname)
  ) {
    const body = await parseBody(req);
    for (const src of [
      ...(body.images || []),
      ...(body.videos || []),
      ...(body.documents || []),
    ]) {
      if (!src.startsWith("/api/media/")) {
        if ((body.images || []).includes(src) && src.startsWith("https://"))
          continue;
        fail("Dosyayı bu ofise yükleyin.");
      }
      const file = (db.media || []).find(
        (m) => "/api/media/" + m.id === src && m.companyId === companyId,
      );
      if (!file) fail("Dosya bu ofise ait değil.");
    }
  }
  return false;
}
module.exports = { handle, scope };
