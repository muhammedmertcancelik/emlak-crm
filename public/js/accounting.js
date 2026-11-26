import {
  api,
  state,
  field,
  esc,
  manager,
  options,
  btn,
  badge,
  label,
  date,
  toast,
} from "./core.js";
import { formDialog, showDialog } from "./forms.js";
import { financeDetails } from "./broker.js";

const cash = (cents) =>
  Number.isSafeInteger(cents)
    ? new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 2,
      }).format(cents / 100)
    : "—";
const table = (headers, rows) =>
  '<div class="table-wrap"><table><thead><tr>' +
  headers.map((h) => "<th>" + esc(h) + "</th>").join("") +
  "</tr></thead><tbody>" +
  rows
    .map(
      (row) =>
        "<tr>" +
        row.map((cell) => "<td>" + esc(cell) + "</td>").join("") +
        "</tr>",
    )
    .join("") +
  "</tbody></table></div>";
const sourceName = (source) => source?.name || "Kaynak eksik";
const percent = (value) =>
  "%" + value.toLocaleString("tr-TR", { maximumFractionDigits: 4 });
const status = (result) =>
  result?.status === "finalized"
    ? badge("Kesinleşti", "green")
    : result?.canFinalize
      ? badge("Dağıtıma hazır", "blue")
      : badge("Kontrol gerekli", "amber");
function breakdown(result) {
  return (
    '<div class="accounting-check ' +
    (result.canFinalize || result.status === "finalized"
      ? "complete"
      : "pending") +
    '">' +
    "<strong>Dağılım toplamı: %" +
    esc(result.totalPercent) +
    "</strong><span>" +
    esc(
      result.unallocatedPercent
        ? "Dağıtılmamış: %" +
            result.unallocatedPercent +
            " · " +
            cash(result.unallocatedCents)
        : "Tüm tutar hak sahipleriyle eşleşiyor.",
    ) +
    "</span></div>" +
    (result.warnings.length
      ? '<ul class="accounting-warnings">' +
        result.warnings.map((w) => "<li>" + esc(w) + "</li>").join("") +
        "</ul>"
      : "") +
    table(
      ["Katkı", "Hak sahibi", "Oran", "Tutar"],
      result.lines.map((line) => [
        line.title,
        line.recipientName,
        percent(line.percent),
        cash(line.cents),
      ]),
    ) +
    "<h3>Hak sahibi toplamları</h3>" +
    table(
      ["Hak sahibi", "Birleşen pay", "Toplam kazanç"],
      result.beneficiaries.map((b) => [
        b.name,
        percent(b.percent),
        cash(b.cents),
      ]),
    ) +
    (result.savedAt
      ? '<p class="muted small">Kayıt tarihi: ' +
        esc(date(result.savedAt, { dateStyle: "medium", timeStyle: "short" })) +
        "</p>"
      : "")
  );
}
function context(result) {
  return (
    '<div class="accounting-context">' +
    [
      ["Portföy", result.propertyTitle],
      ["Müşteri", result.customerName],
      [
        "İşlem türü",
        label(result.transactionType) + " · " + label(result.propertyType),
      ],
      [
        result.version === 2
          ? "Toplam emlak komisyonu"
          : "Tahsil edilen net komisyon",
        cash(result.baseCents),
      ],
      ["İşlemi tamamlayan", result.advisor?.name || "Danışman eksik"],
      ["Kayıtlı departman", result.crmDepartmentName],
      ["Müşteriyi getiren", sourceName(result.customerSource)],
      ["Portföyü getiren", sourceName(result.portfolioSource)],
    ]
      .map(
        ([title, value]) =>
          "<div><span>" +
          esc(title) +
          "</span><strong>" +
          esc(value) +
          "</strong></div>",
      )
      .join("") +
    "</div>"
  );
}
export async function distributionForm(id) {
  if (!manager()) return;
  let result = await api(
    "/finance/" + encodeURIComponent(id) + "/distribution",
  );
  if (result.status === "finalized") {
    showDialog(
      "Kesinleşen komisyon dağıtımı",
      '<div class="dialog-body">' +
        context(result) +
        breakdown(result) +
        "</div>",
      "Bu dağıtım, kesinleştirildiği tarihteki kaynak ve hak sahibi bilgilerini korur.",
    );
    return;
  }
  formDialog(
    "Komisyon dağıtımı",
    context(result) +
      (result.version === 1
        ? '<label class="form-field">İşlemi tamamlayan dağıtım departmanı<select class="control" name="departmentKey">' +
          options(
            result.organization.departments.map((d) => [d.key, d.name]),
            result.departmentKey,
            "Departman seçin",
          ) +
          "</select></label>" +
          '<p class="muted small">Bu departman %2 dayanışma payı almaz; diğer dört departman alır. Kaynakları değiştirmek için müşteri veya portföy kaydını düzenleyin.</p>'
        : "") +
      '<div id="distribution-preview">' +
      breakdown(result) +
      "</div>",
    async (_, values) => {
      const saved = await api(
        "/finance/" + encodeURIComponent(id) + "/distribution",
        {
          method: "POST",
          body: {
            ...(values.has("departmentKey")
              ? { departmentKey: values.get("departmentKey") }
              : {}),
            revision: result.revision,
          },
        },
      );
      if (saved.status !== "finalized")
        toast(
          "Taslak kaydedildi. Eksik bilgiler ve dağıtılmamış paylar tamamlanınca kesinleşebilir.",
        );
    },
    [],
    result.version === 2
      ? "Paylar toplam emlak komisyonu üzerinden hesaplanır."
      : "Paylar yalnızca ofise fiilen giren net komisyon üzerinden hesaplanır.",
    result.canFinalize ? "Dağıtımı kesinleştir" : "Taslağı kaydet",
  );
  const form = document.getElementById("record-form");
  const saveButton = form.querySelector('[type="submit"]');
  let request = 0;
  form.elements.departmentKey?.addEventListener("change", async (event) => {
    const version = ++request;
    saveButton.disabled = true;
    try {
      const updated = await api(
        "/finance/" +
          encodeURIComponent(id) +
          "/distribution?departmentKey=" +
          encodeURIComponent(event.target.value),
      );
      if (version !== request || !form.isConnected) return;
      result = updated;
      form.querySelector(".form-error").textContent = "";
      form.querySelector("#distribution-preview").innerHTML = breakdown(result);
      saveButton.textContent = result.canFinalize
        ? "Dağıtımı kesinleştir"
        : "Taslağı kaydet";
      saveButton.disabled = false;
    } catch (error) {
      if (version === request && form.isConnected)
        form.querySelector(".form-error").textContent = error.message;
    }
  });
}
const ruleLabels = {
  closing: "Satışı bitiren",
  customer: "Müşteri kaynağı",
  portfolio: "Ürün kaynağı",
  companySource: "Emlak kaynak payı",
  corporate: "Şirket",
  team: "Diğer danışmanlar",
  secretary: "Genel danışman",
  office: "Ofis gideri",
};
export async function financeView() {
  if (!manager()) return "<p>Broker yetkisi gereklidir.</p>";
  const { sales } = await api("/finance");
  const monthOf = (value) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date(value));
    return (
      parts.find((p) => p.type === "year").value +
      "-" +
      parts.find((p) => p.type === "month").value
    );
  };
  const month = state.filters.financeMonth || monthOf(Date.now());
  const ordered = [...sales]
    .reverse()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const selected = ordered.filter((s) => monthOf(s.createdAt) === month);
  const sum = (items, get) =>
    items.reduce((total, sale) => total + get(sale), 0);
  const companyShare = (sale) =>
    sum(sale.distribution?.lines || [], (line) =>
      line.recipientType === "company" ? line.cents : 0,
    );
  const officeShare = (sale) =>
    sum(sale.distribution?.lines || [], (line) =>
      ["expense", "reserve"].includes(line.recipientType) ? line.cents : 0,
    );
  const commission = (sale) => sale.totalAmount ?? sale.gross ?? 0;
  const metrics = [
    ["Aylık toplam komisyon", cash(sum(selected, commission))],
    ["Aylık şirket payı", cash(sum(selected, companyShare))],
    [
      "Seçili ay satışlarının tahsilatı",
      cash(sum(selected, (s) => s.receivedAmount || 0)),
    ],
    [
      "Aylık alınacak ücret",
      cash(sum(selected, (s) => s.receivableAmount || 0)),
    ],
    ["Aylık ofis gideri payı", cash(sum(selected, officeShare))],
    ["Aylık tamamlanan işlem", selected.length],
  ];
  const months = [...new Set(ordered.map((s) => monthOf(s.createdAt)))]
    .sort()
    .reverse();
  const section = (title, headers, rows) =>
    '<section class="panel"><div class="panel-head"><h2>' +
    esc(title) +
    "</h2></div>" +
    (rows.length
      ? table(headers, rows)
      : '<p class="panel-body">Bu dönemde işlem yok.</p>') +
    "</section>";
  return (
    '<div class="page-heading"><h1>Muhasebe</h1></div>' +
    '<label class="form-field">Ay<input type="month" class="control" data-filter="financeMonth" value="' +
    esc(month) +
    '"></label>' +
    '<div class="accounting-metrics">' +
    metrics
      .map(
        ([title, value]) =>
          '<div class="accounting-metric"><span>' +
          esc(title) +
          "</span><strong>" +
          esc(value) +
          "</strong></div>",
      )
      .join("") +
    "</div>" +
    '<p class="notice">Komisyonlar satış ayına, giderler kayıt tarihine göre hesaplanır.</p>' +
    (await financeDetails(month)) +
    section(
      "Aylık kazanç geçmişi",
      [
        "Ay",
        "İşlem",
        "Toplam komisyon",
        "Şirket payı",
        "Tahsil edilen",
        "Alacak",
      ],
      months.map((key) => {
        const items = ordered.filter((s) => monthOf(s.createdAt) === key);
        return [
          key,
          items.length,
          cash(sum(items, commission)),
          cash(sum(items, companyShare)),
          cash(sum(items, (s) => s.receivedAmount || 0)),
          cash(sum(items, (s) => s.receivableAmount || 0)),
        ];
      }),
    )
  );
}
export async function rulesForm() {
  const rules = await api("/finance/rules");
  formDialog(
    "Dağıtım kuralları",
    Object.entries(ruleLabels)
      .map(([key, title]) =>
        field(
          key,
          title + " (%)",
          key === "secretary" ? 3 : rules[key],
          "number",
          true,
          key === "secretary" ? "readonly" : 'min="0" max="100" step="1"',
        ),
      )
      .join(""),
    async (_, values) =>
      api("/finance/rules", {
        method: "POST",
        body: Object.fromEntries(
          Object.keys(ruleLabels).map((key) => [key, Number(values.get(key))]),
        ),
      }),
    [],
    "Yeni satışlara uygulanır. Emlak kaynak payı dışındaki oranlar toplam %100 olmalıdır.",
  );
}

export async function paymentForm(id, undo = false) {
  const result = await api(
    "/finance/" + encodeURIComponent(id) + "/distribution",
  );
  formDialog(
    undo ? "Dağıtımı geri al" : "Dağıtıldı",
    context(result) + breakdown(result),
    async () =>
      api("/finance/" + encodeURIComponent(id) + (undo ? "/undo" : "/paid"), {
        method: "POST",
        body: { revision: result.revision },
      }),
    [],
    undo
      ? "Dağıtım kaydı geri alınır ve satış tekrar bekleyenlere eklenir. Güncel kurallarla yeniden hesaplanır."
      : "Bu satışın komisyonunu dağıtıldı olarak kaydedin.",
    undo ? "Geri al" : "Dağıtıldı",
  );
}
export async function salesView() {
  if (!manager()) return "<p>Broker yetkisi gereklidir.</p>";
  const { sales } = await api("/finance");
  const ordered = [...sales]
    .reverse()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const pending = ordered.filter((s) => !s.distributedAt);
  const query = (state.filters.saleSearch || "").toLocaleLowerCase("tr-TR");
  const matches = (sale) =>
    [sale.propertyTitle, sale.customerName, sale.distribution?.advisor?.name]
      .join(" ")
      .toLocaleLowerCase("tr-TR")
      .includes(query) &&
    (!state.filters.saleMonth ||
      sale.createdAt?.slice(0, 7) === state.filters.saleMonth);
  const pendingShares = new Map();
  for (const sale of pending) {
    for (const share of sale.distribution?.beneficiaries || []) {
      const key = share.type + ":" + share.id;
      const total = pendingShares.get(key) || {
        name: share.name,
        cents: 0,
        count: 0,
      };
      total.cents += share.cents;
      total.count++;
      pendingShares.set(key, total);
    }
  }
  const unallocated = pending.reduce(
    (sum, sale) => sum + (sale.distribution?.unallocatedCents || 0),
    0,
  );
  const pendingTotal = pending.reduce(
    (sum, sale) => sum + (sale.distribution?.baseCents || 0),
    0,
  );
  const shareRows = [...pendingShares.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
    .map((share) => [share.name, share.count, cash(share.cents)]);
  if (unallocated)
    shareRows.push(["Hak sahibi bekleyen pay", "—", cash(unallocated)]);
  shareRows.push(["Genel toplam", pending.length, cash(pendingTotal)]);
  const row = (sale) =>
    '<div class="panel-body"><strong>' +
    esc(sale.propertyTitle) +
    "</strong><p>" +
    esc(date(sale.createdAt)) +
    " · " +
    esc(cash(sale.distribution?.baseCents || 0)) +
    (sale.distributedAt ? " · Dağıtıldı" : " · Dağıtılmayı bekliyor") +
    "</p>" +
    btn("Dağıtım detayı", "commission-detail", sale.id, "small") +
    (!sale.distributedAt
      ? btn("Dağıtıldı", "distribution-paid", sale.id, "small primary")
      : "") +
    btn("İşlemi geri al", "distribution-undo", sale.id, "small") +
    btn("Satışı düzelt", "correct-sale", sale.id, "small") +
    btn("Satışı iptal et", "cancel-sale", sale.id, "small") +
    "</div>";
  return (
    '<div class="page-heading"><h1>Satış bitirme</h1>' +
    btn("Satış bitir", "new-sale", "", "primary") +
    "</div>" +
    '<section class="panel"><div class="panel-body"><span>Dağıtılması gereken toplam ücret</span><h2>' +
    esc(
      cash(
        pending.reduce((sum, s) => sum + (s.distribution?.baseCents || 0), 0),
      ),
    ) +
    "</h2></div>" +
    (ordered.length ? row(ordered[0]) : "") +
    "</section>" +
    '<div class="form-grid"><label class="form-field">İşlem ara<input type="search" class="control" data-filter="saleSearch" placeholder="Portföy, müşteri veya danışman" value="' +
    esc(state.filters.saleSearch || "") +
    '"></label>' +
    '<label class="form-field">Satış ayı<input type="month" class="control" data-filter="saleMonth" value="' +
    esc(state.filters.saleMonth || "") +
    '"></label></div>' +
    '<section class="panel"><details><summary>Toplam dağıtılmayı bekleyen işlemler (' +
    pending.length +
    ") · " +
    esc(cash(pendingTotal)) +
    "</summary>" +
    table(["Hak sahibi / pay", "İşlem sayısı", "Toplam pay"], shareRows) +
    "</details></section>" +
    '<section class="panel"><details><summary>Dağıtılmayı bekleyen (' +
    pending.length +
    ")</summary>" +
    (pending.filter(matches).map(row).join("") ||
      '<p class="panel-body">Filtreye uygun bekleyen dağıtım yok.</p>') +
    "</details>" +
    "<details><summary>Geçmiş satışlar</summary>" +
    (ordered.slice(1).filter(matches).map(row).join("") ||
      '<p class="panel-body">Filtreye uygun geçmiş satış yok.</p>') +
    "</details>" +
    '<details><summary>Dağıtım kuralları</summary><div class="panel-body">' +
    btn("Kuralları düzenle", "distribution-rules", "", "small") +
    "</div></details></section>"
  );
}
