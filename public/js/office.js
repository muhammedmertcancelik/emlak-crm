import {
  state,
  api,
  esc,
  money,
  manager,
  btn,
  options,
  field,
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
  formDialog(
    "Satış bitir",
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
      select(
        "advisorId",
        "Satışı bitiren danışman",
        state.members
          .filter((m) => m.role === "agent")
          .map((m) => [m.userId, m.fullName]),
      ) +
      field(
        "gross",
        "Ofisin brüt komisyon geliri (₺)",
        "",
        "number",
        true,
        'min="0" step="0.01"',
      ) +
      field(
        "deductions",
        "Kesintiler (₺)",
        "0",
        "number",
        true,
        'min="0" step="0.01"',
      ) +
      field(
        "distributable",
        "Dağıtılacak tutar (₺)",
        "0",
        "number",
        true,
        'min="0" step="0.01"',
      ) +
      '<output id="sale-net" class="notice">Net kazanç ₺0</output>' +
      "<p>Net kazanç, brüt komisyon gelirinden kesintiler çıkarılarak hesaplanır. Dağıtım paylarının toplamı %100 olmalıdır.</p>" +
      [{ id: "company", name: "Emlak şirketi" }, ...state.departments]
        .map((d) =>
          field(
            "share-" + d.id,
            d.name + " (%)",
            d.id === "company" ? "100" : "0",
            "number",
            true,
            'min="0" max="100" step="0.01"',
          ),
        )
        .join(""),
    async (_, values) => {
      const body = {
        requestId,
        propertyId: values.get("propertyId"),
        customerId: values.get("customerId"),
        advisorId: values.get("advisorId"),
        gross: Number(values.get("gross")),
        deductions: Number(values.get("deductions")),
        distributable: Number(values.get("distributable")),
        shares: [...values]
          .filter(([k]) => k.startsWith("share-"))
          .map(([k, v]) => k.slice(6) + "=" + v),
      };
      await api("/sales", { method: "POST", body });
    },
  );
}
export async function financeView() {
  if (!manager()) return "<p>Broker yetkisi gereklidir.</p>";
  const { sales } = await api("/finance");
  const total = (key) => currency(sales.reduce((sum, s) => sum + s[key], 0));
  return (
    '<div class="page-heading"><h1>Muhasebe</h1>' +
    btn("Satış bitir", "new-sale", "", "primary") +
    "</div>" +
    table(
      ["Net kazanç", "Dağıtılan tutar", "Şirket kasasına kalan"],
      [[total("net"), total("distributable"), total("companyNet")]],
    ) +
    table(
      [
        "Tarih",
        "Portföy",
        "Brüt komisyon",
        "Kesintiler",
        "Net kazanç",
        "Dağıtılacak tutar",
        "Şirket kasası",
      ],
      sales.map((s) => [
        new Date(s.createdAt).toLocaleDateString("tr-TR"),
        s.propertyTitle,
        currency(s.gross),
        currency(s.deductions),
        currency(s.net),
        currency(s.distributable),
        currency(s.companyNet),
      ]),
    ) +
    "<h2>Dağıtım dökümü</h2>" +
    table(
      ["Portföy", "Pay sahibi", "Yüzde", "Tutar"],
      sales.flatMap((s) =>
        s.allocations.map((a) => [
          s.propertyTitle,
          a.name,
          a.percent,
          currency(a.cents),
        ]),
      ),
    )
  );
}
export async function reportsView() {
  if (!manager()) return "<p>Broker yetkisi gereklidir.</p>";
  const report = await api(
    "/reports" +
      (state.filters.reportMonth
        ? "?month=" + encodeURIComponent(state.filters.reportMonth)
        : ""),
  );
  return (
    '<div class="page-heading"><h1>Özetler ve ayın elemanı</h1>' +
    btn("Ayın elemanını seç", "new-award", "", "primary") +
    '</div><label class="form-field">Değerlendirme ayı<input type="month" class="control" data-filter="reportMonth" value="' +
    esc(report.month) +
    '"></label>' +
    table(
      ["Dönem", "Kapanan işlem", "Şirket kasasına kalan"],
      report.periods.map((p) => [p.name, p.count, currency(p.net)]),
    ) +
    "<h2>Danışman faaliyetleri</h2>" +
    table(
      [
        "Danışman",
        "Departman",
        "Yeni portföy",
        "Tamamlanan takip",
        "Şirket kasasına katkı",
      ],
      report.ranking
        .sort((a, b) => b.revenue - a.revenue)
        .map((r) => [
          r.name,
          r.department,
          r.properties,
          r.followups,
          currency(r.revenue),
        ]),
    ) +
    "<h2>Ayın elemanları</h2>" +
    table(
      ["Kriter", "Danışman"],
      report.awards.map((a) => [
        { sales: "Satış", properties: "Portföy", followups: "Müşteri takibi" }[
          a.criterion
        ],
        state.members.find((m) => m.userId === a.userId)?.fullName || "",
      ]),
    )
  );
}
export function awardForm() {
  formDialog(
    "Ayın elemanını seç",
    field(
      "month",
      "Ay",
      state.filters.reportMonth || new Date().toISOString().slice(0, 7),
      "month",
      true,
    ) +
      select("criterion", "Değerlendirme kriteri", [
        ["sales", "Şirket kasasına en yüksek katkı"],
        ["properties", "Portföy ekleme"],
        ["followups", "Müşteri takibi"],
      ]) +
      select(
        "userId",
        "Danışman",
        state.members
          .filter((m) => m.role === "agent")
          .map((m) => [m.userId, m.fullName]),
      ),
    async (_, values) =>
      api("/awards", { method: "POST", body: Object.fromEntries(values) }),
  );
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

export async function salesView() {
  if (!manager()) return "<p>Broker yetkisi gereklidir.</p>";
  const { sales } = await api("/finance");
  return (
    '<div class="page-heading"><h1>Satış bitirme</h1>' +
    btn("Satış bitir", "new-sale", "", "primary") +
    "</div>" +
    table(
      [
        "Tarih",
        "Portföy",
        "Satışı bitiren",
        "Brüt komisyon",
        "Kesintiler",
        "Net kazanç",
      ],
      sales.map((s) => [
        new Date(s.createdAt).toLocaleDateString("tr-TR"),
        s.propertyTitle,
        state.members.find((m) => m.userId === s.advisorId)?.fullName ||
          "Eski çalışan",
        currency(s.gross),
        currency(s.deductions),
        currency(s.net),
      ]),
    )
  );
}
