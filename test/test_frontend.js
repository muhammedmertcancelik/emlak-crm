const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
(async () => {
  const core = await import(
    pathToFileURL(path.join(__dirname, "../public/js/core.js"))
  );
  const views = await import(
    pathToFileURL(path.join(__dirname, "../public/js/views.js"))
  );
  const attack = '<img src=x onerror="alert(1)">';
  const { state } = core;
  state.session = {
    user: { id: "user-a", fullName: attack, email: "qa@example.test" },
    company: { id: "company-a", name: attack, city: "İstanbul" },
    role: "owner",
    memberships: [],
  };
  state.properties = [
    {
      id: "prop-a",
      companyId: "company-a",
      createdById: "user-a",
      title: attack,
      city: "İstanbul",
      district: "Kadıköy",
      type: "daire",
      status: "satilik",
      currency: "TRY",
      price: 5000000,
      netArea: 120,
      rooms: "3+1",
      shareStatus: "private",
    },
  ];
  state.customers = [
    {
      id: "cust-a",
      companyId: "company-a",
      createdById: "user-a",
      name: attack,
      phone: "555",
      status: "yeni",
      totalBudget: 6000000,
      preferredDistricts: ["Kadıköy"],
      preferredRooms: ["3+1"],
    },
  ];
  state.tasks = [
    {
      id: "task-a",
      companyId: "company-a",
      assignedToUserId: "user-a",
      title: attack,
      dueDate: "2026-11-22T09:00:00Z",
      type: "arama",
    },
  ];
  global.fetch = async () => ({ ok: true, json: async () => [] });
  for (const name of Object.keys(views.renderers)) {
    state.page = name;
    const html = await views.renderers[name]();
    assert.ok(html.includes("<h1>"), name);
    assert.ok(!html.includes(attack), "unescaped in " + name);
    assert.ok(
      !/\s(?:onclick|onchange|onerror|onsubmit)="/.test(html),
      "inline handler in " + name,
    );
  }
  for (const mode of ["login", "register", "invite"]) {
    const html = views.authView(mode, {
      email: "qa@example.test",
      companyName: attack,
    });
    assert.ok(html.includes('id="auth-form"'));
    assert.ok(!html.includes(attack));
  }
  assert.equal(core.safeImage("javascript:alert(1)"), "");
  assert.equal(core.safeImage("//evil.example/a"), "");
  assert.equal(
    core.safeImage("https://example.test/a"),
    "https://example.test/a",
  );
  assert.equal(core.dateKey("2026-11-21T22:00:00Z"), "2026-11-22");
  const html = fs.readFileSync(
    path.join(__dirname, "../public/index.html"),
    "utf8",
  );
  for (const match of html.matchAll(/(?:src|href)="(\/[^"#]*)"/g))
    assert.ok(
      fs.existsSync(path.join(__dirname, "../public", match[1])),
      "Missing asset " + match[1],
    );
  assert.ok(!/\s(?:onclick|onchange|onerror|onsubmit)="/.test(html));
  console.log(
    "PASS: 10 ekran, 3 giriş görünümü, XSS kaçışı, güvenli URL, İstanbul tarihi ve statik dosya bağlantıları.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
