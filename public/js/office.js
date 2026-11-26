import {
  state,
  api,
  esc,
  money,
  manager,
  btn,
  options,
  field,
  label,
} from "./core.js";
import { formDialog, showDialog } from "./forms.js";
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
const currency = (cents) => money(cents / 100);
const select = (name, title, items) =>
  '<label class="form-field">' +
  esc(title) +
  '<select class="control" name="' +
  name +
  '" required>' +
  options(items, "", "Seçin") +
  "</select></label>";
export function staffForm() {
  if (!manager()) return;
  formDialog(
    "Danışman oluştur",
    field("fullName", "Ad soyad", "", "text", true) +
      field("username", "Kullanıcı adı", "", "text", true) +
      field("password", "İlk parola", "", "password", true, 'minlength="12"') +
      select("role", "Panel", [
        ["agent", "Danışman"],
        ["secretary", "Sekreter"],
      ]) +
      select(
        "departmentId",
        "Departman",
        state.departments.map((d) => [d.id, d.name]),
      ),
    async (_, values) =>
      api("/staff", { method: "POST", body: Object.fromEntries(values) }),
  );
}
export function saleForm() {
  if (!manager()) return;
  const requestId = crypto.randomUUID();
  const advisors = state.members
    .filter((m) => m.role === "agent")
    .map((m) => [m.userId, m.fullName]);
  const sources = [["emlak", "Emlak"], ...advisors];
  formDialog(
    "Satış bitir",
    '<div class="form-grid">' +
      select(
        "propertyId",
        "Portföy",
        state.properties
          .filter((p) => !["satildi", "kiralandi"].includes(p.status))
          .map((p) => [p.id, p.title]),
      ) +
      select(
        "customerId",
        "Müşteri",
        state.customers.map((c) => [c.id, c.name]),
      ) +
      select("advisorId", "Satışı bitiren danışman", advisors) +
      select("customerSourceId", "Müşteri kaynağı", sources) +
      select("propertySourceId", "Ürün kaynağı", sources) +
      field(
        "receivedAmount",
        "Emlak komisyonu alınan ücret (₺)",
        "0",
        "number",
        true,
        'min="0" step="0.01"',
      ) +
      field(
        "receivableAmount",
        "Emlak komisyonu alınacak ücret (₺)",
        "0",
        "number",
        true,
        'min="0" step="0.01"',
      ) +
      field(
        "totalAmount",
        "Toplam emlak komisyonu (₺)",
        "0.00",
        "number",
        false,
        'readonly step="0.01"',
      ) +
      '<label class="check-label"><input type="checkbox" name="isCredit">Kredili işlem</label></div>',
    async (_, values) => {
      const body = {
        requestId,
        propertyId: values.get("propertyId"),
        customerId: values.get("customerId"),
        advisorId: values.get("advisorId"),
        customerSourceId: values.get("customerSourceId"),
        propertySourceId: values.get("propertySourceId"),
        receivedAmount: Number(values.get("receivedAmount")),
        receivableAmount: Number(values.get("receivableAmount")),
        isCredit: values.has("isCredit"),
      };
      await api("/sales", { method: "POST", body });
    },
    [],
    "Dağıtım, alınan ve alınacak ücretin toplamı üzerinden hesaplanır.",
  );
  document.getElementById("record-form").addEventListener("input", (event) => {
    if (!["receivedAmount", "receivableAmount"].includes(event.target.name))
      return;
    const fields = event.currentTarget.elements;
    const received = Math.round(Number(fields.receivedAmount.value || 0) * 100);
    const receivable = Math.round(
      Number(fields.receivableAmount.value || 0) * 100,
    );
    fields.totalAmount.value = ((received + receivable) / 100).toFixed(2);
  });
}
export async function reportsView() {
  if (!manager()) return "<p>Broker yetkisi gereklidir.</p>";
  const { sales } = await api("/finance");
  const recent = (items) => [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
  const formatDate = (value) => value ? new Date(value).toLocaleDateString("tr-TR") : "—";
  const creator = (record) => record.createdByName ||
    state.members.find(member => member.userId === record.createdById)?.fullName ||
    "Kayıtlı değil";
  const recordTable = (headers, rows, records, action) =>
    '<div class="table-wrap"><table><thead><tr>' +
    [...headers, "Detay"].map(header => "<th>" + esc(header) + "</th>").join("") +
    "</tr></thead><tbody>" +
    rows.map((row, index) => "<tr>" + row.map(cell => "<td>" + esc(cell) + "</td>").join("") +
      "<td>" + btn("Detayları gör", action, records[index].id, "small") + "</td></tr>").join("") +
    "</tbody></table></div>";
  const properties = recent(state.properties);
  const customers = recent(state.customers);
  const section = (title, headers, rows, records, action) =>
    '<section class="panel"><div class="panel-head"><h2>' + title + '</h2></div>' +
    (rows.length ? (action ? recordTable(headers, rows, records, action) : table(headers, rows)) : '<p class="panel-body">Henüz kayıt yok.</p>') + '</section>';
  const pending = sales.filter(s => !s.distributedAt);
  const metrics = [
    ["Toplam portföy", state.properties.length],
    ["Toplam müşteri", state.customers.length],
    ["Tamamlanan satış / kiralama", sales.length],
    ["Toplam emlak komisyonu", currency(sales.reduce((sum,s) => sum + (s.totalAmount ?? s.gross ?? 0), 0))],
    ["Dağıtılmayı bekleyen", currency(pending.reduce((sum,s) => sum + (s.distribution?.baseCents || 0), 0))],
  ];
  return '<div class="page-heading"><h1>Özetler</h1></div>' +
    '<div class="accounting-metrics">' + metrics.map(([title,value]) =>
      '<div class="accounting-metric"><span>' + esc(title) + '</span><strong>' + esc(value) + '</strong></div>'
    ).join("") + '</div>' +
    section("Yeni eklenen portföyler", ["Portföy", "Durum", "Fiyat", "Ekleyen", "Eklenme tarihi"],
      properties.map(p => [p.title, label(p.status), money(p.price,p.currency), creator(p), formatDate(p.createdAt)]), properties, "property-detail") +
    section("Yeni eklenen müşteriler", ["Müşteri", "Telefon", "Durum", "Ekleyen", "Eklenme tarihi"],
      customers.map(c => [c.name, c.phone || "—", label(c.pipelineStatus || c.status), creator(c), formatDate(c.createdAt)]), customers, "customer-detail") +
    section("Son satışlar ve kiralamalar", ["Portföy", "Müşteri", "Danışman", "Toplam komisyon", "Tarih"],
      recent(sales).map(s => [s.propertyTitle, s.customerName, s.distribution?.advisor?.name || "—", currency(s.totalAmount ?? s.gross ?? 0), formatDate(s.createdAt)]));
}

export async function networkView() {
  if (!manager()) return "<p>Ortak ağ bağlantısını broker yönetir.</p>";
  const data = await api("/network/settings");
  const result = await api("/network/sync", { method: "POST", body: {} });
  return (
    '<div class="page-heading"><h1>Ortak ağ API bağlantısı</h1>' +
    btn("Ortak ağ API oluştur", "network-key", "", "primary") +
    btn("API ekle ve kaydet", "network-connect") +
    "</div><p>Başka sunucudaki broker, bu sunucunun HTTPS adresini ve kendisine verilen anahtarı kaydederek ortak ağa katılır. Bu ekran açıldığında paylaşılan portföyler eşitlenir.</p>" +
    table(
      ["Bağlı sunucu"],
      data.connection.map((c) => [c.url]),
    ) +
    "<h2>Verilen anahtarlar</h2>" +
    data.keys
      .map(
        (k) =>
          "<p>" +
          esc(k.label) +
          " · " +
          (k.revoked
            ? "İptal edildi"
            : btn("Anahtarı iptal et", "network-revoke", k.id)) +
          "</p>",
      )
      .join("") +
    "<h2>Ağdaki portföyler</h2>" +
    table(
      ["Ofis", "Telefon", "Portföy", "İlçe", "Fiyat"],
      (result.offices || []).flatMap((o) =>
        o.properties.map((p) => [
          o.office,
          o.phone,
          p.title,
          p.district,
          money(p.price, p.currency),
        ]),
      ),
    )
  );
}
export function networkKeyForm() {
  formDialog(
    "Ortak ağ API oluştur",
    field("label", "Anahtarın verileceği ofis", "", "text", true),
    async (_, values) => {
      const result = await api("/network/keys", {
        method: "POST",
        body: Object.fromEntries(values),
      });
      showDialog(
        "Ortak ağ anahtarı",
        '<p>Bu anahtarı ve sunucunuzun HTTPS adresini ilgili brokera verin. Anahtar yalnızca bu ekranda gösterilir.</p><textarea class="control" readonly>' +
          esc(result.key) +
          "</textarea>",
      );
    },
  );
}
export function networkConnectForm() {
  formDialog(
    "API ekle ve kaydet",
    field("url", "Ortak ağ sunucusunun HTTPS adresi", "", "url", true) +
      field("key", "API anahtarı", "", "password", true),
    async (_, values) =>
      api("/network/connect", {
        method: "POST",
        body: Object.fromEntries(values),
      }),
  );
}
