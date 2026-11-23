import {
  api,
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
        "%" + line.percent,
        cash(line.cents),
      ]),
    ) +
    "<h3>Hak sahibi toplamları</h3>" +
    table(
      ["Hak sahibi", "Birleşen pay", "Toplam kazanç"],
      result.beneficiaries.map((b) => [b.name, "%" + b.percent, cash(b.cents)]),
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
      ["Tahsil edilen net komisyon", cash(result.baseCents)],
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
        "<p>İşlemi tamamlayan departman: <strong>" +
        esc(result.departmentName) +
        "</strong></p>" +
        breakdown(result) +
        "</div>",
      "Bu dağıtım, kesinleştirildiği tarihteki kaynak ve hak sahibi bilgilerini korur.",
    );
    return;
  }
  formDialog(
    "Komisyon dağıtımı",
    context(result) +
      '<label class="form-field">İşlemi tamamlayan dağıtım departmanı<select class="control" name="departmentKey">' +
      options(
        result.organization.departments.map((d) => [d.key, d.name]),
        result.departmentKey,
        "Departman seçin",
      ) +
      "</select></label>" +
      '<p class="muted small">Bu departman %2 dayanışma payı almaz; diğer dört departman alır. Kaynakları değiştirmek için müşteri veya portföy kaydını düzenleyin.</p>' +
      '<div id="distribution-preview">' +
      breakdown(result) +
      "</div>",
    async (_, values) => {
      const saved = await api(
        "/finance/" + encodeURIComponent(id) + "/distribution",
        {
          method: "POST",
          body: {
            departmentKey: values.get("departmentKey"),
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
    "Paylar yalnızca ofise fiilen giren net komisyon üzerinden hesaplanır.",
    result.canFinalize ? "Dağıtımı kesinleştir" : "Taslağı kaydet",
  );
  const form = document.getElementById("record-form");
  const saveButton = form.querySelector('[type="submit"]');
  let request = 0;
  form.elements.departmentKey.addEventListener("change", async (event) => {
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
export async function financeView() {
  if (!manager()) return "<p>Broker yetkisi gereklidir.</p>";
  const { sales, accounting } = await api("/finance");
  const summary = accounting || {
    totals: {},
    beneficiaries: [],
    organization: { departments: [] },
  };
  const metrics = [
    ["Tahsil edilen net komisyon", summary.totals.collected || 0],
    ["Kesinleşen dağıtım", summary.totals.finalized || 0],
    ["Dağıtım bekleyen tahsilat", summary.totals.pending || 0],
    ["Şirket payı ve işletme rezervi", summary.totals.company || 0],
  ];
  const transactions =
    '<div class="table-wrap"><table><thead><tr>' +
    [
      "İşlem",
      "Müşteriyi getiren",
      "Net tahsilat",
      "Alınacak ücret",
      "Toplam ücret",
      "Kredili işlem",
      "Dağıtım",
      "İncele",
    ]
      .map((h) => "<th>" + esc(h) + "</th>")
      .join("") +
    "</tr></thead><tbody>" +
    sales
      .map((sale) => {
        const result = sale.distribution;
        return (
          "<tr><td><strong>" +
          esc(sale.propertyTitle) +
          '</strong><small class="accounting-cell-note">' +
          esc(
            (result?.customerName || sale.customerName) +
              " · " +
              date(sale.createdAt),
          ) +
          "</small></td><td>" +
          esc(
            result
              ? sourceName(result.customerSource)
              : label(sale.customerLeadSource),
          ) +
          "</td><td>" +
          esc(cash(sale.receivedAmount)) +
          "</td><td>" +
          esc(cash(sale.receivableAmount)) +
          "</td><td>" +
          esc(cash(sale.totalAmount ?? sale.gross)) +
          "</td><td>" +
          (sale.isCredit === undefined
            ? "—"
            : sale.isCredit
              ? "Evet"
              : "Hayır") +
          "</td><td>" +
          status(result) +
          '<small class="accounting-cell-note">%' +
          esc(result?.totalPercent ?? 0) +
          "</small></td><td>" +
          btn("Dağıtım detayı", "commission-detail", sale.id, "small") +
          "</td></tr>"
        );
      })
      .join("") +
    "</tbody></table></div>";
  return (
    '<div class="page-heading"><div><h1>Muhasebe</h1><p>Payidar Emlak · Net komisyon ve katkı dağılımı</p></div></div>' +
    '<div class="accounting-metrics">' +
    metrics
      .map(
        ([title, value]) =>
          '<div class="accounting-metric"><span>' +
          esc(title) +
          "</span><strong>" +
          esc(cash(value)) +
          "</strong></div>",
      )
      .join("") +
    "</div>" +
    '<p class="notice">Dağıtım yalnızca tahsil edilen net komisyondan yapılır. Alınacak ' +
    esc(cash(summary.totals.receivable || 0)) +
    " tahsil edilene kadar dağıtıma girmez. Kesinleşen paylar hak ediştir; ödeme yapıldığını göstermez.</p>" +
    '<section class="panel"><div class="panel-head"><h2>İşlem bazında komisyon dağılımı</h2></div>' +
    (sales.length
      ? transactions
      : '<div class="panel-body"><p>Henüz tamamlanan işlem yok. Satış bitirme bölümünde tamamlanan işlemler burada görünür.</p></div>') +
    "</section>" +
    '<section class="panel"><div class="panel-head"><h2>Kesinleşen hak sahibi toplamları</h2></div>' +
    (summary.beneficiaries.length
      ? table(
          ["Hak sahibi", "İşlem sayısı", "Toplam hak ediş"],
          summary.beneficiaries.map((b) => [b.name, b.count, cash(b.cents)]),
        )
      : '<div class="panel-body"><p>Kesinleştirilmiş dağıtım bulunmuyor. Taslak hesaplamalar toplam hak edişe dahil edilmez.</p></div>') +
    "</section>" +
    '<details class="panel accounting-rules"><summary>Dağıtım kuralları ve organizasyon</summary>' +
    table(
      ["Katkı", "Oran"],
      [
        ["İşlemi tamamlayan danışman", "%25"],
        ["Müşteriyi bulan danışman / Emlak", "%10 / %5"],
        ["Portföyü bulan danışman / Emlak", "%10 / %5"],
        ["Şirket kurumsal payı", "%40"],
        ["Diğer dört departman", "%2 × 4 = %8"],
        ["Elanur ERİPEK · Genel koordinasyon", "%3"],
        ["Şirket katkı rezervi", "%4"],
      ],
    ) +
    '<p class="panel-body">Şirket kaynaklı tek katkıda toplam %95, iki katkıda %90 olur. Metinde kalan payın sahibi belirtilmediği için fark dağıtılmamış olarak izlenir. %100 tamamlanmadan kesinleştirme yapılmaz.</p>' +
    '<p class="panel-body">Broker: <strong>' +
    esc(summary.organization.broker || "Sıraç KOLUŞ") +
    "</strong> · Genel koordinatör: <strong>" +
    esc(summary.organization.coordinator || "Elanur ERİPEK") +
    "</strong></p>" +
    table(
      ["Dağıtım departmanı", "Sorumlu"],
      summary.organization.departments.map((d) => [d.name, d.responsible]),
    ) +
    "</details>"
  );
}
