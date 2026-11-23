const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { once } = require("node:events");
const { pathToFileURL } = require("node:url");
const { JSDOM } = require("jsdom");
process.env.PORT = "0";
const server = require("../server/index");
const nativeFetch = global.fetch;
let dom,
  cookie = "",
  passed = 0;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(fn, message) {
  for (let i = 0; i < 150; i++) {
    if (fn()) return;
    await pause(20);
  }
  throw Error("UI timeout: " + message);
}
function input(name, value) {
  const el = dom.window.document.querySelector('[name="' + name + '"]');
  assert.ok(el, "Missing field " + name);
  el.value = value;
  return el;
}
function click(action, id) {
  const selector =
    '[data-action="' + action + '"]' + (id ? '[data-id="' + id + '"]' : "");
  const el = dom.window.document.querySelector(selector);
  assert.ok(el, "Missing action " + action);
  el.click();
}
function submit(id) {
  dom.window.document
    .getElementById(id)
    .dispatchEvent(
      new dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
}
function pass(name) {
  passed++;
  console.log("PASS UI: " + name);
}
(async () => {
  if (!server.listening) await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  const reg = await nativeFetch(base + "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "ui@example.test",
      password: "UI-test-parola-2026!",
      fullName: "Deniz Yılmaz",
      companyName: "UI Test Ofisi",
      city: "İstanbul",
    }),
  });
  assert.equal(reg.status, 201);
  dom = new JSDOM(
    fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8"),
    { url: base, pretendToBeVisual: true },
  );
  for (const key of [
    "window",
    "document",
    "location",
    "history",
    "localStorage",
    "FormData",
  ])
    global[key] = dom.window[key];
  Object.defineProperty(global, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  dom.window.scrollTo = () => {};
  dom.window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  global.confirm = () => true;
  global.fetch = async (url, init = {}) => {
    const response = await nativeFetch(new URL(url, base), {
      ...init,
      headers: { ...init.headers, ...(cookie ? { Cookie: cookie } : {}) },
    });
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    return response;
  };
  await import(pathToFileURL(path.join(__dirname, "../public/js/app.js")));
  await until(() => document.getElementById("auth-form"), "login screen");
  input("email", "ui@example.test");
  input("password", "UI-test-parola-2026!");
  submit("auth-form");
  await until(
    () => document.querySelector(".metrics"),
    "dashboard after login",
  );
  assert.equal(localStorage.getItem("emlak_crm_token"), null);
  pass("Giriş ve HttpOnly oturum ile genel bakış");
  click("new-customer");
  await until(() => document.getElementById("field-name"), "customer form");
  assert.deepEqual(
    [...document.querySelector('[name="leadSource"]').options].map(
      (o) => o.textContent,
    ),
    ["Emlak"],
  );
  assert.equal(input("preferredCity", "").value, "");
  assert.equal(
    document.querySelectorAll('[name="preferredDistricts"]').length,
    0,
  );
  assert.match(
    document.getElementById("field-preferredDistricts").textContent,
    /Önce bir il seçin/,
  );
  assert.equal(
    document.getElementById("field-preferredDistricts").closest("details").open,
    false,
  );
  input("name", "Selin Test");
  input("phone", "05320000000");
  input("totalBudget", "8000000");
  input("preferredCity", "Van").dispatchEvent(
    new dom.window.Event("change", { bubbles: true }),
  );
  await until(
    () =>
      [...document.querySelectorAll('[name="preferredDistricts"]')].some(
        (el) => el.value === "İpekyolu",
      ),
    "Van districts",
  );
  const districtPicker = document
    .getElementById("field-preferredDistricts")
    .closest("details");
  districtPicker.open = true;
  document
    .querySelector('[name="preferredDistricts"][value="İpekyolu"]')
    .click();
  assert.equal(districtPicker.open, false);
  districtPicker.open = true;
  document
    .querySelector('[name="preferredDistricts"][value="Edremit"]')
    .click();
  assert.equal(districtPicker.open, false);
  assert.match(
    districtPicker.querySelector("summary").textContent,
    /2 seçildi/,
  );
  await until(
    () =>
      document.querySelector(
        '[name="preferredNeighborhoods"][value="Bahçıvan"]',
      ),
    "Van neighborhoods",
  );
  document.querySelector(
    '[name="preferredNeighborhoods"][value="Bahçıvan"]',
  ).checked = true;
  document
    .querySelector('[name="preferredFloorTypes"][value="ara_kat"]')
    .click();
  assert.match(
    document
      .getElementById("field-preferredFloorTypes")
      .closest("details")
      .querySelector("summary").textContent,
    /1 seçildi/,
  );
  submit("record-form");
  const { state } = await import(
    pathToFileURL(path.join(__dirname, "../public/js/core.js"))
  );
  await until(
    () =>
      state.customers.length === 1 && !document.getElementById("dialog").open,
    "customer saved",
  );
  assert.deepEqual(state.customers[0].preferredDistricts, [
    "Edremit",
    "İpekyolu",
  ]);
  assert.equal(state.customers[0].preferredCity, "Van");
  assert.deepEqual(state.customers[0].preferredNeighborhoods, ["Bahçıvan"]);
  assert.deepEqual(state.customers[0].preferredFloorTypes, ["ara_kat"]);
  assert.equal(state.customers[0].kvkkConsent, false);
  pass("Müşteri formu, liste alanları ve varsayılan izinler");
  location.hash = "customers";
  await until(
    () => document.querySelector('[data-action="edit-customer"]'),
    "customer list",
  );
  click("edit-customer", state.customers[0].id);
  await until(
    () => document.getElementById("field-preferredCity"),
    "customer edit form",
  );
  assert.equal(input("preferredCity", "Van").value, "Van");
  assert.deepEqual(
    [...document.querySelectorAll('[name="preferredDistricts"]:checked')]
      .map((el) => el.value)
      .sort(),
    ["Edremit", "İpekyolu"],
  );
  assert.equal(
    document.querySelector('[name="preferredNeighborhoods"][value="Bahçıvan"]')
      ?.checked,
    true,
  );
  assert.equal(
    document.querySelector('[name="preferredFloorTypes"][value="ara_kat"]')
      ?.checked,
    true,
  );
  click("close-dialog");
  pass("Müşteri düzenlemede il ve ilçe seçimleri korunuyor");
  location.hash = "properties";
  await until(
    () => document.querySelector('[data-action="new-property"]'),
    "property list",
  );
  click("new-property");
  await until(() => document.getElementById("field-title"), "property form");
  input("title", '<img src=x onerror="alert(1)"> Test portföy');
  input("price", "7500000");
  input("city", "İstanbul");
  input("district", "Kadıköy");
  input("netArea", "120");
  submit("record-form");
  await until(
    () =>
      state.properties.length === 1 && !document.getElementById("dialog").open,
    "property saved",
  );
  assert.equal(document.querySelector('img[src="x"]'), null);
  pass("Portföy formu ve zararlı metnin güvenli gösterimi");
  click("property-detail", state.properties[0].id);
  await until(() => document.querySelector(".detail-price"), "property detail");
  click("edit-property", state.properties[0].id);
  await until(() => document.getElementById("field-price"), "edit property");
  input("price", "7600000");
  submit("record-form");
  await until(
    () =>
      state.properties[0].price === 7600000 &&
      !document.getElementById("dialog").open,
    "property edit",
  );
  pass("Portföy detayı, düzenleme ve fiyat geçmişi");
  location.hash = "tasks";
  await until(
    () => document.querySelector('[data-action="new-task"]'),
    "task list",
  );
  click("new-task");
  await until(() => document.getElementById("field-dueDate"), "task form");
  input("title", "Selin Hanım ile görüşme");
  input("dueDate", "2026-12-01T14:30");
  input("relatedCustomerId", state.customers[0].id);
  input("relatedPropertyId", state.properties[0].id);
  submit("record-form");
  await until(
    () => state.tasks.length === 1 && !document.getElementById("dialog").open,
    "task saved",
  );
  assert.equal(state.tasks[0].dueDate, "2026-12-01T11:30:00.000Z");
  pass("İstanbul saatine göre ilişkili görev oluşturma");
  location.hash = "tasks";
  await until(() => document.querySelector(".week-strip"), "task route");
  click("edit-task", state.tasks[0].id);
  await until(
    () =>
      document.getElementById("dialog").open &&
      document.getElementById("field-dueDate"),
    "task edit",
  );
  assert.equal(input("dueDate", "2026-12-02T16:00").value, "2026-12-02T16:00");
  submit("record-form");
  await until(
    () =>
      state.tasks[0].dueDate === "2026-12-02T13:00:00.000Z" &&
      !document.getElementById("dialog").open,
    "task rescheduled",
  );
  pass("Görev düzenleme ve randevu tarihini değiştirme");
  click("complete-task", state.tasks[0].id);
  await until(() => state.tasks[0].isCompleted, "completed");
  pass("Ajanda gezinmesi ve görev tamamlama");
  location.hash = "matching";
  await until(() => document.querySelector(".selector-list"), "matching route");
  click("match-select", state.customers[0].id);
  await until(
    () =>
      document
        .querySelector(".split-layout > .panel:nth-child(2) .panel-head h2")
        ?.textContent.includes(state.customers[0].name),
    "matching result loaded",
  );
  const allMatches = document.querySelector('[data-filter="allMatches"]');
  allMatches.checked = true;
  allMatches.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  await until(() => document.querySelector(".match-card"), "matching results");
  assert.match(
    document.querySelector(".match-card").textContent,
    /İl uyuşmuyor/,
  );
  pass("Gerçek API ile eşleştirme ve nedenler");
  location.hash = "company";
  await until(
    () => document.querySelector('[data-action="company-tab"]'),
    "company route",
  );
  click("company-tab", "departments");
  await until(
    () => document.querySelector('[data-action="new-department"]'),
    "dept tab",
  );
  click("new-department");
  await until(() => document.getElementById("field-leaderUserId"), "dept form");
  input("name", "Konut Ekibi");
  submit("record-form");
  await until(
    () =>
      state.departments.length === 1 && !document.getElementById("dialog").open,
    "dept saved",
  );
  await until(
    () => document.querySelector('[data-action="edit-department"]'),
    "department actions ready",
  );
  click("edit-department", state.departments[0].id);
  await until(() => document.getElementById("field-name"), "edit dept form");
  input("name", "Konut ve Yatırım");
  submit("record-form");
  await until(
    () =>
      state.departments[0].name === "Konut ve Yatırım" &&
      !document.getElementById("dialog").open,
    "dept edited",
  );
  await until(
    () => document.querySelector('[data-action="company-tab"]'),
    "department page rendered",
  );
  pass("Departman oluşturma ve düzenleme");
  click("company-tab", "members");
  await until(
    () => document.querySelector('[data-action="invite"]'),
    "member tab",
  );
  click("invite");
  await until(() => document.getElementById("field-email"), "invite form");
  input("email", "invite@example.test");
  submit("record-form");
  await until(() => document.getElementById("invite-link"), "invite link");
  assert.ok(document.getElementById("dialog").open);
  assert.ok(
    document.getElementById("invite-link").value.includes("inviteToken="),
  );
  pass("Davet bağlantısı oluşturma ve sonuç penceresi");
  click("close-dialog");
  input("q", "Selin");
  submit("global-search-form");
  await until(
    () =>
      state.page === "search" &&
      document.querySelector(".page-heading h1")?.textContent ===
        "Arama sonuçları",
    "search",
  );
  assert.ok(document.querySelector("main").textContent.includes("Selin Test"));
  pass("Genel arama ve sayfalar arası gezinme");
  location.hash = "properties";
  await until(
    () => document.querySelector('[data-action="new-property"]'),
    "properties",
  );
  click("new-property");
  await until(() => document.getElementById("field-price"), "invalid form");
  input("title", "");
  input("price", "-1");
  submit("record-form");
  await until(
    () => document.querySelector("#record-form .form-error")?.textContent,
    "error state",
  );
  assert.ok(document.getElementById("dialog").open);
  assert.equal(
    document.querySelector('#record-form [type="submit"]').disabled,
    false,
  );
  pass("Başarısız kayıtta formun korunması ve hata mesajı");
  click("close-dialog");

  location.hash = "company";
  await until(
    () => document.querySelector('[data-action="new-staff"]'),
    "staff action",
  );
  click("new-staff");
  await until(() => document.querySelector('[name="username"]'), "staff form");
  input("fullName", "Test Danışman");
  input("username", "ui_danisman");
  input("password", "UI-danisman-2026!");
  input("role", "agent");
  input("departmentId", state.departments[0].id);
  submit("record-form");
  await until(
    () =>
      state.members.some((m) => m.fullName === "Test Danışman") &&
      !document.getElementById("dialog").open,
    "staff saved",
  );
  pass("Broker panelinden kullanıcı adı ve parola ile danışman oluşturma");
  const advisor = state.members.find((m) => m.fullName === "Test Danışman");
  const { openForm } = await import(
    pathToFileURL(path.join(__dirname, "../public/js/forms.js"))
  );
  // Form must fetch the latest staff even if this tab's member cache is stale.
  state.members = [];
  await openForm("customer");
  assert.deepEqual(
    [...document.querySelector('[name="leadSource"]').options].map(
      (o) => o.textContent,
    ),
    ["Emlak", "Test Danışman"],
  );
  click("close-dialog");
  location.hash = "team";
  await until(
    () => document.querySelector('[data-action="team-select"]'),
    "team page",
  );
  click("team-select", advisor.userId);
  await until(
    () => document.querySelector('[data-member-dept="' + advisor.id + '"]'),
    "advisor detail",
  );
  assert.equal(
    document.querySelector('[data-member-dept="' + advisor.id + '"]').value,
    state.departments[0].id,
  );
  click("team-records", "all");
  await until(
    () => document.querySelector('[data-record-assign="property"]'),
    "team assignments",
  );
  const propertyAssignment = document.querySelector(
    '[data-record-assign="property"][data-id="' + state.properties[0].id + '"]',
  );
  propertyAssignment.value = advisor.userId;
  propertyAssignment.dispatchEvent(
    new dom.window.Event("change", { bubbles: true }),
  );
  await until(
    () => state.properties[0].assignedToUserId === advisor.userId,
    "property assigned",
  );
  const customerAssignment = document.querySelector(
    '[data-record-assign="customer"][data-id="' + state.customers[0].id + '"]',
  );
  customerAssignment.value = advisor.userId;
  customerAssignment.dispatchEvent(
    new dom.window.Event("change", { bubbles: true }),
  );
  await until(
    () => state.customers[0].assignedToUserId === advisor.userId,
    "customer assigned",
  );
  click("team-records", "selected");
  await until(
    () => document.querySelectorAll("[data-record-assign]").length === 2,
    "advisor records",
  );
  pass("Departmanlar ve ekip ekranında portföy ve müşteri ataması");
  location.hash = "sales";
  await until(
    () => document.querySelector('[data-action="new-sale"]'),
    "sales route",
  );
  click("new-sale");
  await until(
    () => document.querySelector('[name="receivedAmount"]'),
    "sale form",
  );
  input("propertyId", state.properties[0].id);
  input("customerId", state.customers[0].id).dispatchEvent(
    new dom.window.Event("change", { bubbles: true }),
  );
  input("advisorId", advisor.userId);
  input("receivedAmount", "70000").dispatchEvent(
    new dom.window.Event("input", { bubbles: true }),
  );
  input("receivableAmount", "30000").dispatchEvent(
    new dom.window.Event("input", { bubbles: true }),
  );
  assert.equal(
    document.querySelector('[name="totalAmount"]').value,
    "100000.00",
  );
  assert.equal(document.querySelector('[name="totalAmount"]').readOnly, true);
  assert.equal(document.querySelectorAll('[name="isCredit"]').length, 1);
  document.querySelector('[name="isCredit"]').click();
  assert.equal(
    document.querySelector('[name="gross"], [name^="share-"]'),
    null,
  );
  submit("record-form");
  await until(
    () =>
      !document.getElementById("dialog").open &&
      state.properties[0].status === "satildi",
    "sale saved",
  );
  location.hash = "finance";
  await until(
    () =>
      document.querySelector("main h1")?.textContent === "Muhasebe" &&
      document.querySelector("main")?.textContent.includes("₺70.000"),
    "finance result",
  );
  pass("Tek satış formunda tahsilat, otomatik toplam ve kredili işlem");
  const financeTable = [...document.querySelectorAll("main table")].find(
    (table) =>
      table.querySelector("thead").textContent.includes("Müşteriyi getiren"),
  );
  assert.ok(financeTable);
  assert.match(financeTable.querySelector("tbody").textContent, /Emlak/);
  assert.match(financeTable.querySelector("tbody").textContent, /₺30.000/);
  assert.match(financeTable.querySelector("tbody").textContent, /₺100.000/);
  assert.match(financeTable.querySelector("tbody").textContent, /Evet/);
  assert.equal(document.querySelector('main [data-action="new-sale"]'), null);
  click(
    "commission-detail",
    document.querySelector('[data-action="commission-detail"]').dataset.id,
  );
  await until(
    () => document.querySelector('[name="departmentKey"]'),
    "distribution form",
  );
  input("departmentKey", "rental").dispatchEvent(
    new dom.window.Event("change", { bubbles: true }),
  );
  await until(
    () =>
      document
        .getElementById("distribution-preview")
        ?.textContent.includes("Dağılım toplamı: %90"),
    "company source distribution",
  );
  assert.match(
    document.getElementById("distribution-preview").textContent,
    /Dağıtılmamış: %10/,
  );
  assert.equal(
    document.querySelector('#record-form [type="submit"]').textContent,
    "Taslağı kaydet",
  );
  submit("record-form");
  await until(
    () => !document.getElementById("dialog").open,
    "distribution draft saved",
  );
  for (const kind of ["property", "customer"]) {
    const record =
      kind === "property" ? state.properties[0] : state.customers[0];
    await openForm(kind, record.id);
    input(
      kind === "property" ? "portfolioSource" : "leadSource",
      advisor.fullName,
    );
    submit("record-form");
    await until(
      () => !document.getElementById("dialog").open,
      "contributor saved",
    );
  }
  click(
    "commission-detail",
    document.querySelector('[data-action="commission-detail"]').dataset.id,
  );
  await until(
    () =>
      document
        .getElementById("distribution-preview")
        ?.textContent.includes("Dağılım toplamı: %100"),
    "advisor source distribution",
  );
  assert.match(
    document.getElementById("distribution-preview").textContent,
    /%45/,
  );
  assert.equal(
    document.querySelector('#record-form [type="submit"]').textContent,
    "Dağıtımı kesinleştir",
  );
  submit("record-form");
  await until(
    () =>
      !document.getElementById("dialog").open &&
      document.querySelector("main")?.textContent.includes("31.500,00"),
    "beneficiary total",
  );
  pass(
    "Muhasebede %90 taslak, %100 kesinleştirme ve aynı danışmana %45 hak ediş",
  );
  location.hash = "reports";
  await until(
    () => document.querySelector("main")?.textContent.includes("Test Danışman"),
    "reports",
  );
  pass("Dönemsel özet ve danışman faaliyet raporu");
  click("logout");
  await until(() => document.getElementById("auth-form"), "logout");
  assert.equal(state.session, null);
  pass("Güvenli çıkış ve oturum temizliği");
  console.log(
    passed +
      " UI akışı geçti. DOM testleri görsel yerleşim doğrulaması içermez.",
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    dom?.window.close();
    server.closeAllConnections();
    server.close();
    setTimeout(() => process.exit(process.exitCode || 0), 50);
  });
