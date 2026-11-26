import {
  api,
  state,
  esc,
  field,
  options,
  btn,
  money,
  date,
  manager,
} from "./core.js";
import { formDialog } from "./forms.js";
const cash = (cents) => money(cents / 100);
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(
    new Date(),
  );
const select = (name, title, items, value = "") =>
  '<label class="form-field">' +
  esc(title) +
  '<select class="control" name="' +
  name +
  '" required>' +
  options(items, value, "Seçin") +
  "</select></label>";
export async function receiptForm(id) {
  const { sales } = await api("/finance");
  const sale = sales.find((s) => s.id === id);
  const requestId = crypto.randomUUID();
  formDialog(
    "Tahsilat ekle",
    "<p>Kalan alacak " +
      esc(cash(sale.receivableAmount || 0)) +
      "</p>" +
      field(
        "amount",
        "Tahsil edilen tutar",
        "",
        "number",
        true,
        'min="0.01" step="0.01" max="' + sale.receivableAmount / 100 + '"',
      ) +
      field("date", "Tahsilat tarihi", today(), "date", true) +
      field("note", "Açıklama"),
    async (_, values) =>
      api("/broker/sales/" + encodeURIComponent(id) + "/receipt", {
        method: "POST",
        body: {
          ...Object.fromEntries(values),
          amount: Number(values.get("amount")),
          requestId,
        },
      }),
  );
}
export function expenseForm() {
  const requestId = crypto.randomUUID();
  formDialog(
    "Gider ekle",
    select("category", "Kategori", [
      "Kira",
      "Maaş",
      "Fatura",
      "Reklam",
      "Ulaşım",
      "Diğer",
    ]) +
      field("amount", "Tutar", "", "number", true, 'min="0.01" step="0.01"') +
      field("date", "Gider tarihi", today(), "date", true) +
      field("note", "Açıklama"),
    async (_, values) =>
      api("/broker/expenses", {
        method: "POST",
        body: {
          ...Object.fromEntries(values),
          amount: Number(values.get("amount")),
          requestId,
        },
      }),
  );
}
export function voidExpense(id) {
  const requestId = crypto.randomUUID();
  formDialog(
    "Gideri iptal et",
    "<p>Bu gider mali toplamdan çıkarılacak.</p>",
    async () =>
      api("/broker/expenses/" + encodeURIComponent(id) + "/void", {
        method: "POST",
        body: { requestId },
      }),
  );
}
export async function correctSale(id, cancel = false) {
  const { sales } = await api("/finance");
  const sale = sales.find((s) => s.id === id);
  const advisors = state.members
    .filter((m) => m.role === "agent")
    .map((m) => [m.userId, m.fullName]);
  const sources = [["emlak", "Emlak"], ...advisors];
  const requestId = crypto.randomUUID();
  formDialog(
    cancel ? "Satışı iptal et" : "Satışı düzelt",
    "<p>" +
      esc(sale.propertyTitle) +
      "</p>" +
      (cancel
        ? "<p>Portföy yeniden açılır. Alınmış ücretler tahsilat geçmişinde korunur.</p>"
        : field(
            "totalAmount",
            "Toplam emlak komisyonu",
            (sale.totalAmount ?? sale.gross) / 100,
            "number",
            true,
            'min="0.01" step="0.01"',
          ) +
          select("advisorId", "Satışı bitiren", advisors, sale.advisorId) +
          select(
            "customerSourceId",
            "Müşteri kaynağı",
            sources,
            sale.customerSourceId,
          ) +
          select(
            "propertySourceId",
            "Ürün kaynağı",
            sources,
            sale.propertySourceId,
          )) +
      field("reason", "İşlem nedeni", "", "text", true),
    async (_, values) =>
      api(
        "/broker/sales/" +
          encodeURIComponent(id) +
          (cancel ? "/cancel" : "/edit"),
        {
          method: "POST",
          body: {
            ...Object.fromEntries(values),
            ...(cancel
              ? {}
              : { totalAmount: Number(values.get("totalAmount")) }),
            version: sale.version || 0,
            requestId,
          },
        },
      ),
  );
}
const table = (headers, rows) =>
  '<div class="table-wrap"><table><thead><tr>' +
  headers.map((h) => "<th>" + esc(h) + "</th>").join("") +
  "</tr></thead><tbody>" +
  rows
    .map(
      (row) =>
        "<tr>" + row.map((cell) => "<td>" + cell + "</td>").join("") + "</tr>",
    )
    .join("") +
  "</tbody></table></div>";
export async function financeDetails(month) {
  const [{ sales }, overview] = await Promise.all([
    api("/finance"),
    api("/broker/overview"),
  ]);
  const expenses = overview.expenses.filter(
    (e) => !e.voidedAt && e.date.startsWith(month),
  );
  const selected = sales.filter(
    (s) =>
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
      }).format(new Date(s.createdAt)) === month,
  );
  const retained = selected
    .flatMap((s) => s.distribution?.lines || [])
    .filter((line) =>
      ["company", "expense", "reserve"].includes(line.recipientType),
    )
    .reduce((sum, line) => sum + line.cents, 0);
  const costs = expenses.reduce((sum, e) => sum + e.amount, 0);
  const received = overview.receipts
    .filter((r) => r.date.startsWith(month))
    .reduce((sum, r) => sum + r.amount, 0);
  const query = (state.filters.financeSearch || "").toLocaleLowerCase("tr-TR");
  const receivables = sales.filter(
    (s) =>
      s.receivableAmount > 0 &&
      (s.propertyTitle + " " + s.customerName)
        .toLocaleLowerCase("tr-TR")
        .includes(query),
  );
  const section = (title, body) =>
    '<section class="panel"><div class="panel-head"><h2>' +
    title +
    "</h2></div>" +
    body +
    "</section>";
  return (
    section(
      "Gerçek gider ve kazanç",
      '<div class="panel-body"><p>Şirket ve ofis payları eksi kayıtlı giderler: <strong>' +
        esc(cash(retained - costs)) +
        "</strong></p><p>Vergi öncesi sonuç · Kayıtlı gider " +
        esc(cash(costs)) +
        "</p><p>Bu ay gerçekleşen tahsilat " +
        esc(cash(received)) +
        "</p>" +
        btn("Gider ekle", "new-expense", "", "primary") +
        "</div>" +
        table(
          ["Tarih", "Kategori", "Açıklama", "Tutar", "İşlem"],
          expenses.map((e) => [
            esc(e.date),
            esc(e.category),
            esc(e.note),
            esc(cash(e.amount)),
            btn("İptal et", "void-expense", e.id, "small"),
          ]),
        ),
    ) +
    section(
      "Tahsil edilecek komisyonlar",
      '<div class="panel-body"><input class="control" type="search" data-filter="financeSearch" placeholder="Portföy veya müşteri ara" value="' +
        esc(state.filters.financeSearch || "") +
        '"></div>' +
        table(
          ["Portföy", "Müşteri", "Kalan alacak", "İşlem"],
          receivables.map((s) => [
            esc(s.propertyTitle),
            esc(s.customerName),
            esc(cash(s.receivableAmount)),
            btn("Tahsilat ekle", "receipt", s.id, "small"),
          ]),
        ),
    ) +
    section(
      "Danışman hak ediş hesapları",
      table(
        ["Danışman / sekreter", "Toplam hak ediş", "Ödenen", "Kalan"],
        overview.ledger.map((r) => [
          esc(r.name),
          esc(cash(r.earned)),
          esc(cash(r.paid)),
          esc(cash(r.balance)),
        ]),
      ),
    ) +
    '<details class="panel"><summary>İptal edilen satışlar</summary>' +
    table(
      ["Portföy", "İptal tarihi", "İade takibi gereken tahsilat"],
      (overview.cancelled || []).map((s) => [
        esc(s.propertyTitle),
        esc(date(s.cancelledAt)),
        esc(cash(s.receivedAmount)),
      ]),
    ) +
    '</details><details class="panel"><summary>Tahsilat geçmişi</summary>' +
    table(
      ["Tarih", "Portföy", "Tutar", "Açıklama"],
      overview.receipts
        .filter((r) => r.date.startsWith(month))
        .reverse()
        .map((r) => [
          esc(r.date),
          esc(r.propertyTitle),
          esc(cash(r.amount)),
          esc(r.note),
        ]),
    ) +
    "</details>"
  );
}
export async function auditView() {
  if (!manager()) return "<p>Broker yetkisi gereklidir.</p>";
  const page = state.filters.auditPage || 1;
  const data = await api(
    "/broker/audit?page=" +
      page +
      "&q=" +
      encodeURIComponent(state.filters.auditSearch || ""),
  );
  const actionName = (action) => {
    const names = {
      receipt_created: "Tahsilat eklendi",
      expense_created: "Gider eklendi",
      expense_voided: "Gider iptal edildi",
      sale_corrected: "Satış düzeltildi",
      sale_cancelled: "Satış iptal edildi",
      distribution_paid: "Dağıtım ödendi",
      distribution_undone: "Dağıtım geri alındı",
      commission_finalized: "Dağıtım kesinleşti",
      commission_draft_saved: "Dağıtım taslağı kaydedildi",
    };
    if (names[action]) return names[action];
    const [kind, verb] = action.split("_");
    return (
      ({
        properties: "Portföy",
        customers: "Müşteri",
        followUps: "Görev",
        sales: "Satış",
      }[kind] || kind) +
      " " +
      ({ created: "eklendi", updated: "güncellendi", deleted: "silindi" }[
        verb
      ] ||
        verb ||
        "")
    );
  };
  return (
    '<div class="page-heading"><h1>İşlem geçmişi</h1></div><input class="control" type="search" data-filter="auditSearch" placeholder="Kişi, kayıt veya işlem ara" value="' +
    esc(state.filters.auditSearch || "") +
    '">' +
    table(
      ["Tarih", "Kullanıcı", "İşlem", "Kayıt"],
      data.items.map((e) => [
        esc(date(e.createdAt)),
        esc(e.userName),
        esc(actionName(e.action)),
        esc(
          typeof e.details === "string"
            ? e.details
            : e.details?.reason || e.recordId || e.saleId || "",
        ),
      ]),
    ) +
    '<div class="actions">' +
    (page > 1 ? btn("Önceki", "audit-page", page - 1) : "") +
    "<span>" +
    data.total +
    " işlem</span>" +
    (page * 30 < data.total
      ? btn("Sonraki", "audit-page", Number(page) + 1)
      : "") +
    "</div>"
  );
}
