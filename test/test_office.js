"use strict";
const assert = require("node:assert/strict");
const { once } = require("node:events");
process.env.PORT = "0";
const server = require("../server/index");
(async () => {
  if (!server.listening) await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  async function request(path, token, body, method = body ? "POST" : "GET") {
    const response = await fetch(base + "/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  }
  const registration = await request("/auth/register", null, {
    email: "broker@roles.test",
    password: "Strong-password-2026!",
    fullName: "Broker",
    companyName: "Test Ofisi",
    city: "İstanbul",
  });
  assert.equal(registration.status, 201);
  const token = registration.data.token;
  const department = await request("/departments", token, {
    name: "Konut",
    customCriteria: {
      types: ["daire"],
      statuses: ["satilik"],
      rooms: ["2+1"],
      districts: ["Kadıköy"],
    },
  });
  assert.equal(department.status, 201);
  assert.equal(
    (await request("/departments", token, { name: "Genel Kordinasyon" })).status,
    409,
  );
  const dept = department.data.department.id;
  for (const [username, role] of [
    ["danisman1", "agent"],
    ["danisman2", "agent"],
    ["sekreter1", "secretary"],
  ])
    assert.equal(
      (
        await request("/staff", token, {
          username,
          role,
          fullName: username,
          password: "Strong-password-2026!",
          departmentId: dept,
        })
      ).status,
      201,
    );
  assert.equal(
    (
      await request("/staff", token, {
        username: "danisman1",
        role: "agent",
        fullName: "X",
        password: "Strong-password-2026!",
        departmentId: dept,
      })
    ).status,
    409,
  );
  const agent = (
    await request("/auth/login", null, {
      email: "danisman1",
      password: "Strong-password-2026!",
    })
  ).data.token;
  const second = (
    await request("/auth/login", null, {
      email: "danisman2",
      password: "Strong-password-2026!",
    })
  ).data.token;
  const secretary = (
    await request("/auth/login", null, {
      email: "sekreter1",
      password: "Strong-password-2026!",
    })
  ).data.token;
  assert.ok(agent);
  const me = (await request("/auth/me", agent)).data;
  const advisorId = me.user.id;
  for (const t of [agent, secretary]) {
    assert.equal((await request("/finance", t)).status, 403);
    assert.equal((await request("/staff", t, {})).status, 403);
    assert.equal((await request("/sales", t, {})).status, 403);
  }
  const property = await request("/properties", token, {
    title: "Atanan portföy",
    price: 5000000,
    type: "daire",
    status: "satilik",
    city: "İstanbul",
    district: "Kadıköy",
    rooms: "2+1",
    assignedToUserId: advisorId,
  });
  const customer = await request("/customers", token, {
    name: "Atanan müşteri",
    phone: "05550000000",
    totalBudget: 6000000,
    assignedToUserId: advisorId,
    creditAmount: 1000000,
  });
  assert.equal(property.status, 201);
  assert.equal(customer.status, 201);
  assert.equal(customer.data.leadSource, "emlak");
  assert.equal(
    (
      await request(
        "/customers/" + customer.data.id,
        token,
        {
          leadSource: "Ofiste olmayan danışman",
        },
        "PUT",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/customers/" + customer.data.id,
        token,
        {
          leadSource: "danisman2",
        },
        "PUT",
      )
    ).status,
    200,
  );
  assert.equal((await request("/customers", agent)).data.length, 1);
  assert.equal((await request("/customers", second)).data.length, 0);
  assert.equal(
    (await request("/customers/" + customer.data.id, second)).status,
    404,
  );
  assert.equal(
    (
      await request(
        "/properties/" + property.data.id,
        agent,
        { title: "Güncellenen portföy" },
        "PUT",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/properties/" + property.data.id,
        second,
        { title: "Yetkisiz" },
        "PUT",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/properties", token, {
        title: "Fazla görsel",
        price: 1,
        images: Array(16).fill("https://example.com/a.jpg"),
      })
    ).status,
    400,
  );
  const sale = {
    requestId: crypto.randomUUID(),
    propertyId: property.data.id,
    customerId: customer.data.id,
    advisorId,
    gross: 100000,
    deductions: 10000,
    distributable: 40000,
    shares: ["company=50", dept + "=50"],
  };
  assert.equal(
    (
      await request("/sales", token, {
        ...sale,
        shares: ["company=10", dept + "=10"],
      })
    ).status,
    400,
  );
  const closed = await request("/sales", token, sale);
  assert.equal(closed.status, 201);
  assert.equal(closed.data.customerLeadSource, "danisman2");
  assert.equal(closed.data.advisorId, advisorId);
  assert.equal(closed.data.net, 9000000);
  assert.equal(closed.data.companyNet, 7000000);
  assert.equal((await request("/sales", token, sale)).data.id, closed.data.id);
  assert.equal(
    (
      await request("/sales", token, {
        ...sale,
        requestId: crypto.randomUUID(),
      })
    ).status,
    409,
  );
  assert.equal((await request("/finance", token)).data.sales.length, 1);
  assert.equal(
    (await request("/finance", token)).data.sales[0].customerLeadSource,
    "danisman2",
  );
  assert.equal(
    (
      await request(
        "/customers/" + customer.data.id,
        token,
        {
          leadSource: "emlak",
        },
        "PUT",
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/finance", token)).data.sales[0].customerLeadSource,
    "emlak",
  );
  assert.equal(
    (await request("/properties/" + property.data.id, token)).data.status,
    "satildi",
  );
  const reports = (await request("/reports", token)).data;
  assert.equal(
    reports.ranking.find((r) => r.id === advisorId).revenue,
    7000000,
  );
  for (const isCredit of [true, false]) {
    const paymentProperty = await request("/properties", token, {
      title: "Tahsilat testi",
      price: 5000000,
      type: "daire",
      status: "satilik",
    });
    assert.equal(paymentProperty.status, 201);
    const paymentSale = {
      requestId: crypto.randomUUID(),
      propertyId: paymentProperty.data.id,
      customerId: customer.data.id,
      advisorId,
      receivedAmount: 1234.56,
      receivableAmount: 789.01,
      isCredit,
    };
    for (const invalid of [
      { receivedAmount: -1 },
      { receivableAmount: null },
      { isCredit: "yes" },
      { totalAmount: 1 },
      { gross: 1 },
    ]) {
      assert.equal(
        (await request("/sales", token, { ...paymentSale, ...invalid })).status,
        400,
      );
    }
    const paymentResult = await request("/sales", token, paymentSale);
    assert.equal(paymentResult.status, 201);
    assert.equal(paymentResult.data.receivedAmount, 123456);
    assert.equal(paymentResult.data.receivableAmount, 78901);
    assert.equal(paymentResult.data.totalAmount, 202357);
    assert.equal(paymentResult.data.companyNet, 123456);
    assert.equal(paymentResult.data.isCredit, isCredit);
    assert.equal(
      (await request("/sales", token, paymentSale)).data.id,
      paymentResult.data.id,
    );
    const savedPayment = (await request("/finance", token)).data.sales.find(
      (s) => s.id === paymentResult.data.id,
    );
    assert.equal(savedPayment.totalAmount, 202357);
    assert.equal(savedPayment.isCredit, isCredit);
  }
  const loc = await request(
    "/locations?city=" +
      encodeURIComponent("İstanbul") +
      "&district=" +
      encodeURIComponent("Kadıköy"),
    token,
  );
  assert.equal(loc.data.cities.length, 81);
  assert.ok(
    loc.data.neighborhoods.includes("Fenerbahçe") ||
      loc.data.neighborhoods.some((n) => n.includes("FENERBAHÇE")),
  );

  const mismatched = await request("/properties", token, {
    title: "Kriter dışı",
    price: 500,
    assignedToUserId: advisorId,
    type: "arsa",
    status: "satilik",
    district: "Kadıköy",
  });
  assert.equal(mismatched.status, 400);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1cAAAAASUVORK5CYII=",
    "base64",
  );
  const uploadResponse = await fetch(base + "/api/media?kind=image", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/octet-stream",
    },
    body: png,
  });
  assert.equal(uploadResponse.status, 201);
  const uploaded = await uploadResponse.json();
  const media = await fetch(base + uploaded.url, {
    headers: { Authorization: "Bearer " + token },
  });
  assert.equal(media.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await media.arrayBuffer()), png);
  assert.equal(
    (
      await fetch(base + uploaded.url, {
        headers: { Authorization: "Bearer " + second },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/media?kind=image", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/octet-stream",
        },
        body: "<script>bad</script>",
      })
    ).status,
    400,
  );
  const key = (await request("/network/keys", token, { label: "İkinci ofis" }))
    .data.key;
  assert.ok(key);
  const exchange = await request("/federation/exchange", key, {
    office: "Uzak ofis",
    phone: "555",
    properties: {
      items: [
        {
          id: "remote-1",
          title: "Uzak ilan",
          price: 200,
          contactName: "Sızmamalı",
        },
      ],
    },
  });
  assert.equal(exchange.status, 200);
  assert.ok(!JSON.stringify(exchange.data).includes("Sızmamalı"));
  const settings = (await request("/network/settings", token)).data;
  assert.ok(!JSON.stringify(settings).includes(key));
  await request("/network/revoke", token, { id: settings.keys[0].id });
  assert.equal(
    (
      await request("/federation/exchange", key, {
        office: "Uzak",
        properties: { items: [] },
      })
    ).status,
    401,
  );
  const departmentPath = "/departments/" + dept;
  assert.equal(
    (await request(departmentPath, agent, null, "DELETE")).status,
    403,
  );
  assert.equal(
    (await request(departmentPath, token, null, "DELETE")).status,
    200,
  );
  const remainingDepartments = (await request("/departments", token)).data;
  assert.ok(!remainingDepartments.some((item) => item.id === dept));
  const coordination = remainingDepartments.find((item) => item.permanent);
  assert.equal(coordination.name, "Genel Koordinasyon");
  assert.equal(
    (await request("/departments/" + coordination.id, token, null, "DELETE")).status,
    409,
  );
  const remainingMembers = (await request("/companies/members", token)).data;
  assert.equal(
    remainingMembers.find((member) => member.userId === advisorId).departmentId,
    null,
  );
  const advisorPath = "/staff/" + remainingMembers.find(
    (member) => member.userId === advisorId,
  ).id;
  assert.equal((await request(advisorPath, agent, null, "DELETE")).status, 403);
  assert.equal((await request(advisorPath, token, null, "DELETE")).status, 200);
  assert.equal((await request("/auth/me", agent)).status, 401);
  const staffAfterRemoval = (await request("/companies/members", token)).data;
  assert.ok(!staffAfterRemoval.some((member) => member.userId === advisorId));
  const brokerId = (await request("/auth/me", token)).data.user.id;
  for (const path of [
    "/properties/" + property.data.id,
    "/customers/" + customer.data.id,
  ]) {
    const record = await request(path, token);
    assert.equal(record.status, 200);
    assert.equal(record.data.assignedToUserId, brokerId);
    assert.equal((await request(path, token, null, "DELETE")).status, 200);
    assert.equal((await request(path, token)).status, 404);
  }
  console.log(
    "PASS: üç rol, kullanıcı adı, atama izolasyonu, fotoğraf sınırı, satış ve muhasebe, tekrar deneme, rapor, konum ve ortak ağ anahtarı.",
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => server.close());
