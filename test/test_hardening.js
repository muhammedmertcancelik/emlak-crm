const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
process.env.PORT = "0";
const server = require("../server/index");
const { readDB } = require("../server/db");
let base;
async function request(
  path,
  token,
  body,
  method = body === undefined ? "GET" : "POST",
  headers = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data, headers: response.headers };
}
async function register(email, name = "Test Ofisi") {
  const r = await request("/api/auth/register", null, {
    email,
    password: "Test-parolasi-2026!",
    fullName: "Test Yöneticisi",
    companyName: name,
    city: "İstanbul",
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r;
}
test("Payidar güvenlik ve veri bütünlüğü regresyonları", async (t) => {
  if (!server.listening) await once(server, "listening");
  base = "http://127.0.0.1:" + server.address().port;
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  const a = await register("office-a@example.test"),
    b = await register("office-b@example.test");
  let tokenA = a.data.token;
  const tokenB = b.data.token;
  let property, customer, agentToken, task;
  await t.test(
    "Parola atlatma, demo girişi ve şirket taklidi engellenir",
    async () => {
      assert.equal(
        (
          await request("/api/auth/login", null, {
            email: "office-a@example.test",
            password: "admin123",
          })
        ).status,
        401,
      );
      assert.notEqual(
        (await request("/api/auth/demo-login", null, {})).status,
        200,
      );
      assert.equal(
        (
          await request("/api/properties", tokenA, undefined, "GET", {
            "X-Company-Id": b.data.company.id,
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await request("/api/auth/login", null, {
            email: "office-a@example.test",
            password: "Test-parolasi-2026!",
          })
        ).status,
        200,
      );
      assert.equal((await request("/api/network-info")).status, 401);
    },
  );
  await t.test(
    "HttpOnly çerez, CSRF kaynağı ve JSON içerik denetimi",
    async () => {
      const cookie = a.headers.get("set-cookie");
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Strict/);
      const cookieHeader = cookie.split(";")[0];
      assert.equal(
        (
          await request("/api/auth/me", null, undefined, "GET", {
            Cookie: cookieHeader,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request("/api/customers", null, { name: "A" }, "POST", {
            Cookie: cookieHeader,
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/customers", tokenA, { name: "A" }, "POST", {
            Origin: "https://evil.example",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/customers", tokenA, { name: "A" }, "POST", {
            "Content-Type": "text/plain",
          })
        ).status,
        415,
      );
      assert.equal(
        (
          await request(
            "/api/customers",
            null,
            { name: "Çerez müşterisi" },
            "POST",
            { Cookie: cookieHeader, "X-CRM-Request": "1" },
          )
        ).status,
        201,
      );
    },
  );
  await t.test(
    "Geçersiz gövde, sayısal değer ve yetki alanları reddedilir",
    async () => {
      const raw = await fetch(base + "/api/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + tokenA,
        },
        body: "{broken",
      });
      assert.equal(raw.status, 400);
      assert.equal(
        (
          await request("/api/properties", tokenA, {
            title: "İlan",
            price: -10,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request("/api/properties", tokenA, {
            title: "İlan",
            price: 10,
            id: "injected",
          })
        ).status,
        400,
      );
      property = (
        await request("/api/properties", tokenA, {
          title: "Deniz manzaralı daire",
          price: 5000000,
          city: "İstanbul",
          district: "Kadıköy",
          contactName: "Özel sahip",
          contactPhone: "5551111111",
          notes: "Gizli not",
          address: "Gizli adres",
          rooms: "3+1",
          netArea: 120,
        })
      ).data;
      assert.ok(property.id);
      assert.equal(
        (
          await request(
            "/api/properties/" + property.id,
            tokenA,
            { shareStatus: "shared_pool" },
            "PUT",
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            "/api/properties/" + property.id,
            tokenA,
            { createdById: b.data.user.id },
            "PUT",
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            "/api/properties/" + property.id,
            tokenA,
            { price: 5500000 },
            "PUT",
          )
        ).status,
        200,
      );
      assert.equal(
        (await request("/api/properties/" + property.id, tokenA)).data
          .priceHistory.length,
        2,
      );
      assert.equal(
        (await request("/api/properties/" + property.id, tokenB)).status,
        404,
      );
      assert.equal(
        (
          await request(
            "/api/properties/" + property.id,
            tokenB,
            { title: "İhlal" },
            "PUT",
          )
        ).status,
        403,
      );
    },
  );
  await t.test(
    "Davetler tek kullanımlı; çalışanların erişimleri sınırlı",
    async () => {
      const invitation = await request("/api/companies/invitations", tokenA, {
        email: "agent@example.test",
        role: "agent",
      });
      assert.equal(invitation.status, 201);
      const stored = readDB().invitations.find(
        (i) => i.id === invitation.data.invitation.id,
      );
      assert.ok(stored.tokenHash);
      assert.equal(stored.token, undefined);
      const result = await Promise.all(
        [1, 2].map(() =>
          request("/api/auth/accept-invitation", null, {
            token: invitation.data.inviteToken,
            fullName: "Test Danışmanı",
            password: "Danisman-parola-2026!",
          }),
        ),
      );
      assert.deepEqual(result.map((r) => r.status).sort(), [200, 400]);
      agentToken = result.find((r) => r.status === 200).data.token;
      assert.equal(
        (await request("/api/companies/invitations", agentToken)).status,
        403,
      );
      assert.equal(
        (
          await request(
            "/api/properties/" + property.id + "/toggle-archive",
            agentToken,
            {},
          )
        ).status,
        403,
      );
      assert.equal((await request("/api/backup", agentToken)).status, 403);
      assert.equal(
        (
          await request(
            "/api/properties/" + property.id,
            agentToken,
            { title: "İzinsiz" },
            "PUT",
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/departments", tokenA, {
            name: "Sahte",
            assignedUserIds: [b.data.user.id],
          })
        ).status,
        400,
      );
      const dept = await request("/api/departments", tokenA, {
        name: "Konut",
        assignedUserIds: [a.data.user.id],
      });
      assert.equal(dept.status, 201);
      assert.equal(
        (
          await request(
            "/api/departments/" + dept.data.department.id,
            tokenA,
            { description: "Güncellendi" },
            "PUT",
          )
        ).status,
        200,
      );
      const existing = await request("/api/companies/invitations", tokenB, {
        email: "office-a@example.test",
        role: "agent",
      });
      assert.equal(
        (
          await request("/api/auth/accept-invitation", null, {
            token: existing.data.inviteToken,
            fullName: "Sahte",
            password: "Yanlis-parola-2026!",
          })
        ).status,
        401,
      );
      assert.equal(
        readDB().invitations.find((i) => i.id === existing.data.invitation.id)
          .status,
        "pending",
      );
    },
  );
  await t.test(
    "Görev referansları ve sorumlu yetkisi şirket sınırını korur",
    async () => {
      assert.equal(
        (
          await request("/api/followups", tokenB, {
            title: "Yabancı portföy",
            dueDate: new Date().toISOString(),
            relatedPropertyId: property.id,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request("/api/followups", tokenA, {
            title: "Hatalı tarih",
            dueDate: "yesterday",
          })
        ).status,
        400,
      );
      task = (
        await request("/api/followups", tokenA, {
          title: "Yer gösterimi",
          dueDate: "2026-12-01T13:00:00+03:00",
          relatedPropertyId: property.id,
        })
      ).data;
      assert.equal(
        (
          await request(
            "/api/followups/" + task.id + "/complete",
            agentToken,
            {},
          )
        ).status,
        403,
      );
      assert.equal(
        (await request("/api/followups/" + task.id, agentToken, {}, "DELETE"))
          .status,
        403,
      );
      assert.equal(
        (await request("/api/followups/" + task.id + "/complete", tokenA, {}))
          .data.isCompleted,
        true,
      );
    },
  );
  await t.test("Ortak ağ ve eşleştirme özel bilgileri sızdırmaz", async () => {
    customer = (
      await request("/api/customers", tokenA, {
        name: "Özel Müşteri",
        phone: "5559999999",
        email: "private@example.test",
        notes: "Müşteri sırrı",
        totalBudget: 6000000,
        preferredCity: "İstanbul",
        preferredDistricts: ["Kadıköy"],
      })
    ).data;
    assert.equal(
      (
        await request("/api/customers", tokenA, {
          name: "Geçersiz konum",
          totalBudget: 1000000,
          preferredCity: "Van",
          preferredDistricts: ["Kadıköy"],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/api/customers", tokenA, {
          name: "Geçersiz mahalle",
          totalBudget: 1000000,
          preferredCity: "Van",
          preferredDistricts: ["İpekyolu"],
          preferredNeighborhoods: ["Caferağa"],
        })
      ).status,
      400,
    );
    assert.equal(customer.kvkkConsent, false);
    assert.equal(customer.contactPermission, false);
    assert.equal(
      (
        await request("/api/customers/" + customer.id + "/share", tokenA, {
          action: "share",
          legalBasisNote: "Onay",
        })
      ).status,
      400,
    );
    await request(
      "/api/customers/" + customer.id,
      tokenA,
      { kvkkConsent: true },
      "PUT",
    );
    assert.equal(
      (
        await request("/api/customers/" + customer.id + "/share", tokenA, {
          action: "share",
          legalBasisNote: "Kayıtlı açık rıza",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request("/api/properties/" + property.id + "/share", tokenA, {
          action: "share",
        })
      ).status,
      200,
    );
    for (const endpoint of [
      "/api/properties?scope=pool",
      "/api/properties/" + property.id,
      "/api/matching?customerId=" + customer.id,
      "/api/matching?propertyId=" + property.id,
    ]) {
      const result = await request(endpoint, tokenB);
      assert.equal(result.status, 200);
      const text = JSON.stringify(result.data);
      for (const secret of [
        "Özel sahip",
        "5551111111",
        "Gizli not",
        "Gizli adres",
        "5559999999",
        "Müşteri sırrı",
      ])
        assert.ok(!text.includes(secret), endpoint + " leaked " + secret);
    }
    const publicCustomer = (
      await request("/api/customers/" + customer.id, tokenB)
    ).data;
    assert.equal(publicCustomer.phone, null);
    assert.match(publicCustomer.name, /\*/);
    assert.equal(
      (
        await request(
          "/api/properties/" + property.id + "/toggle-favorite",
          tokenB,
          {},
        )
      ).status,
      404,
    );
    await request(
      "/api/properties/" + property.id + "/toggle-archive",
      tokenA,
      {},
    );
    await request(
      "/api/properties/" + property.id + "/toggle-archive",
      tokenA,
      {},
    );
    assert.equal(
      (await request("/api/properties/" + property.id, tokenB)).status,
      404,
    );
  });
  await t.test(
    "Yedek geri yükleme kimlik çakışmalarını önler ve bağlantıları korur",
    async () => {
      const backup = (await request("/api/backup", tokenA)).data;
      const otherBefore = JSON.stringify(
        (await request("/api/properties", tokenB)).data,
      );
      assert.equal(
        (await request("/api/restore", tokenA, { data: { properties: {} } }))
          .status,
        400,
      );
      const restored = await request("/api/restore", tokenA, {
        data: backup.data,
      });
      assert.equal(restored.status, 200, JSON.stringify(restored.data));
      const props = (await request("/api/properties", tokenA)).data;
      assert.ok(
        props.every((p) => p.id !== property.id && p.shareStatus === "private"),
      );
      const tasks = (await request("/api/followups", tokenA)).data;
      assert.ok(props.some((p) => p.id === tasks[0].relatedPropertyId));
      assert.equal(
        JSON.stringify((await request("/api/properties", tokenB)).data),
        otherBefore,
      );
      const imported = readDB().properties.find(
        (p) => p.companyId === a.data.company.id,
      );
      assert.equal(imported.createdById, a.data.user.id);
    },
  );
  await t.test(
    "Parola değişimi ve çıkış eski oturumları geçersiz kılar",
    async () => {
      const change = await request("/api/auth/change-password", tokenA, {
        currentPassword: "Test-parolasi-2026!",
        newPassword: "Yeni-parola-2026!",
      });
      assert.equal(change.status, 200);
      const old = tokenA;
      tokenA = change.data.token;
      assert.equal((await request("/api/auth/me", old)).status, 401);
      assert.equal((await request("/api/auth/me", tokenA)).status, 200);
      assert.equal(
        (
          await request("/api/auth/change-password", tokenA, {
            currentPassword: "yanlis",
            newPassword: "Yeni-parola-2027!",
          })
        ).status,
        400,
      );
      assert.equal((await request("/api/auth/logout", tokenA, {})).status, 200);
      assert.equal((await request("/api/auth/me", tokenA)).status, 401);
    },
  );
  await t.test("Statik dosyalar, CSP ve giriş denemesi sınırı", async () => {
    const index = await fetch(base + "/");
    assert.equal(index.status, 200);
    const csp = index.headers.get("content-security-policy");
    assert.ok(
      csp.includes("script-src 'self'") && !csp.includes("unsafe-inline"),
    );
    assert.equal((await fetch(base + "/missing.js")).status, 404);
    assert.notEqual(
      (await fetch(base + "/%2e%2e%5cdata%5cdatabase.json")).status,
      200,
    );
    let last;
    for (let i = 0; i < 32; i++)
      last = await request("/api/auth/login", null, {
        email: "no@example.test",
        password: "invalid-password",
      });
    assert.equal(last.status, 429);
    assert.ok(last.headers.get("retry-after"));
    assert.equal((await request("/api/health")).status, 200);
  });
});
