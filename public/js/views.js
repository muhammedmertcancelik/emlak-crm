import { reportsView, networkView } from "./office.js";
import { salesView, financeView } from "./accounting.js";
import { auditView } from "./broker.js";
import {
  state,
  esc,
  icon,
  btn,
  iconBtn,
  badge,
  statusBadge,
  label,
  money,
  date,
  dateKey,
  today,
  initials,
  norm,
  manager,
  canEdit,
  canTask,
  thumb,
  empty,
  options,
  api,
  field,
} from "./core.js";
export const pages = {
  audit: ["İşlem geçmişi", "Kayıt ve ödeme değişiklikleri.", "clock"],
  inbox: ["Mesaj kutusu", "Size atanan görevler.", "users"],
  sales: ["Satış bitirme", "Tamamlanan satış ve kiralama işlemleri.", "home"],
  finance: [
    "Muhasebe",
    "Aylık kazanç, tahsilatlar ve işlem geçmişi.",
    "building",
  ],
  network: ["Ortak ağ API", "Sunucular arası ortak ağ.", "network"],
  reports: ["Özetler", "Portföy, müşteri ve satış özeti.", "grid"],
  dashboard: [
    "Genel bakış",
    "İşinizin bugünkü görünümü. Önceliklerinizi buradan yönetin.",
    "grid",
  ],
  properties: [
    "Portföy",
    "Gayrimenkullerinizi takip edin, doğru alıcıyla buluşturun.",
    "home",
  ],
  customers: [
    "Müşteriler",
    "İlk görüşmeden sözleşmeye, her ilişkinin bir sonraki adımı.",
    "users",
  ],
  tasks: [
    "Ajanda",
    "Görüşmeler, randevular ve takip edilecek işler.",
    "calendar",
  ],
  matching: [
    "Eşleştirme",
    "Müşteri beklentilerini portföyünüzle karşılaştırın.",
    "match",
  ],
  pool: [
    "Ortak ağ",
    "Diğer ofislerle paylaşılan portföyleri ve talepleri keşfedin.",
    "network",
  ],
  company: [
    "Şirket ve ekip",
    "Ofis bilgileri, ekip üyeleri ve departmanlar.",
    "building",
  ],
  team: [
    "Departmanlar ve ekip",
    "Ekip üyelerinin departmanlarını, portföylerini ve müşteri atamalarını yönetin.",
    "users",
  ],
  settings: [
    "Hesap ve veriler",
    "Hesabınızı ve şirket verilerinizi yönetin.",
    "settings",
  ],
  guide: [
    "Kullanım rehberi",
    "İlk kaydınızdan başarılı bir satışa, adım adım Payidar.",
    "help",
  ],
  search: [
    "Arama sonuçları",
    "Portföy, müşteri ve ajanda kayıtlarınızda arayın.",
    "search",
  ],
};
const link = (key, count = "") =>
  '<a class="nav-link ' +
  (state.page === key ? "active" : "") +
  '" href="#' +
  key +
  '"' +
  (state.page === key ? ' aria-current="page"' : "") +
  ">" +
  icon(pages[key][2]) +
  pages[key][0] +
  (count !== "" ? '<span class="nav-count">' + esc(count) + "</span>" : "") +
  "</a>";
export function shell() {
  const s = state.session;
  pages.customers[0] = s.role === "agent" ? "Müşterilerim" : "Müşteriler";
  pages.properties[0] = s.role === "agent" ? "Portföylerim" : "Portföy";
  return (
    '<div class="shell"><button class="nav-scrim" data-action="menu" aria-label="Menüyü kapat"></button><aside class="sidebar" aria-label="Ana menü"><a class="brand" href="#dashboard"><span class="brand-mark">P</span><span>payidar<small>GAYRİMENKUL CRM</small></span></a><div class="nav-section">ÇALIŞMA ALANI</div><nav>' +
    link("dashboard") +
    link("properties", state.properties.filter((p) => !p.isArchived).length) +
    link("customers", state.customers.length) +
    link("tasks", state.tasks.filter((t) => !t.isCompleted).length) +
    link(
      "inbox",
      state.tasks.filter(
        (t) => t.assignedToUserId === state.session.user.id && !t.readAt,
      ).length,
    ) +
    link("matching") +
    link("pool") +
    '<div class="nav-section">YÖNETİM</div>' +
    (manager()
      ? link("team") +
        link("sales") +
        link("finance") +
        link("reports") +
        link("audit") +
        link("network")
      : "") +
    link("company") +
    link("settings") +
    '</nav><div class="sidebar-bottom">' +
    link("guide") +
    '<button class="nav-link" data-action="logout">' +
    icon("logout") +
    'Güvenli çıkış</button><div class="workspace-note">Daha düzenli bir ofis.<br>Daha güçlü müşteri ilişkileri.</div></div></aside><header class="topbar">' +
    iconBtn("menu", "Menüyü aç", "menu", "", "") +
    '<form class="global-search" id="global-search-form" role="search">' +
    icon("search") +
    '<input id="global-search" name="q" placeholder="Portföy, müşteri veya görev ara…" aria-label="Tüm kayıtlarda ara" autocomplete="off"><span class="keycap">/</span></form><div class="topbar-right"><select class="company-select" id="company-switch" aria-label="Aktif şirket">' +
    options(
      (s.memberships?.length
        ? s.memberships
        : [{ companyId: s.company.id, companyName: s.company.name }]
      ).map((m) => [m.companyId, m.companyName]),
      s.company.id,
    ) +
    '</select><button class="user-chip" data-action="navigate" data-id="settings" aria-label="Hesap ayarları"><span class="avatar">' +
    esc(initials(s.user.fullName)) +
    '</span><span class="user-text"><strong>' +
    esc(s.user.fullName) +
    "</strong><small>" +
    esc(label(s.role)) +
    "</small></span></button>" +
    btn("Çıkış yap", "logout", "", "small", "logout") +
    '</div></header><main id="main" class="main" tabindex="-1"></main></div>'
  );
}
export function heading(actions = "") {
  const [title, description] = pages[state.page] || pages.dashboard;
  return (
    '<div class="page-heading"><div>' +
    (state.page === "dashboard"
      ? '<div class="eyebrow">ÇALIŞMA ALANINIZ</div>'
      : "") +
    "<h1>" +
    (state.page === "dashboard"
      ? manager()
        ? "Broker paneli"
        : state.session.role === "secretary"
          ? "Sekreter paneli"
          : "Danışman paneli"
      : title) +
    "</h1><p>" +
    description +
    '</p></div><div class="actions">' +
    actions +
    "</div></div>"
  );
}
export const footer = () =>
  '<footer class="footer"><span>Payidar CRM · ' +
  esc(state.session.company.name) +
  "</span><span>" +
  date(new Date(), { day: "numeric", month: "long", year: "numeric" }) +
  "</span></footer>";
const metric = (title, value, note, symbol) =>
  '<div class="metric"><div class="metric-top"><span>' +
  title +
  '</span><span class="metric-icon">' +
  icon(symbol) +
  '</span></div><div class="metric-value">' +
  esc(value) +
  '</div><div class="metric-note">' +
  note +
  "</div></div>";
export function propertyTable(list, compact = false, pool = false) {
  if (!list.length)
    return empty(
      "Portföy bulunamadı",
      "Filtrelerinizi değiştirebilir veya yeni bir portföy ekleyebilirsiniz.",
      pool ? "" : btn("Portföy ekle", "new-property", "", "primary", "plus"),
    );
  return (
    '<div class="table-wrap"><table><thead><tr><th>Portföy</th><th>Durum</th><th>Fiyat</th>' +
    (!compact
      ? "<th>Özellikler</th><th>" + (pool ? "Ofis" : "Danışman") + "</th>"
      : "") +
    '<th><span class="small">İşlem</span></th></tr></thead><tbody>' +
    list
      .map(
        (p) =>
          '<tr><td><div class="record-cell">' +
          thumb(p) +
          '<div><button class="record-link" data-action="property-detail" data-id="' +
          esc(p.id) +
          '">' +
          esc(p.title) +
          '</button><span class="sub">' +
          esc([p.district, p.city].filter(Boolean).join(", ")) +
          "</span></div></div></td><td>" +
          statusBadge(p.status) +
          (p.shareStatus !== "private" && p.shareStatus
            ? '<span class="sub">Ortak ağda</span>'
            : "") +
          '</td><td class="money">' +
          money(p.price, p.currency) +
          "</td>" +
          (!compact
            ? "<td>" +
              esc(p.rooms || "—") +
              ' <span class="muted">·</span> ' +
              esc(p.netArea || "—") +
              ' m²<span class="sub">' +
              esc(label(p.type)) +
              "</span></td><td>" +
              esc(pool ? p.ownerCompanyName : p.createdByName || "Atanmamış") +
              "</td>"
            : "") +
          '<td><div class="actions">' +
          iconBtn("eye", "Portföyü incele", "property-detail", p.id) +
          (canEdit(p) && !compact
            ? iconBtn("edit", "Portföyü düzenle", "edit-property", p.id) +
              btn("Sil", "delete-property", p.id, "small danger", "trash")
            : "") +
          "</div></td></tr>",
      )
      .join("") +
    "</tbody></table></div>"
  );
}
export function taskRows(list, compact = false) {
  return list
    .map((t) => {
      const late = !t.isCompleted && Date.parse(t.dueDate) < Date.now();
      return (
        '<div class="task-row"><button class="task-check ' +
        (t.isCompleted ? "done" : "") +
        '" data-action="complete-task" data-id="' +
        esc(t.id) +
        '" aria-label="' +
        esc(t.title) +
        (t.isCompleted ? " görevini yeniden aç" : " görevini tamamla") +
        '" ' +
        (!canTask(t) ? "disabled" : "") +
        ">" +
        (t.isCompleted ? icon("check") : "") +
        '</button><div class="task-main"><strong class="' +
        (t.isCompleted ? "completed" : "") +
        '">' +
        esc(t.title) +
        "</strong><p>" +
        esc(label(t.type)) +
        (t.assignedToUserName ? " · " + esc(t.assignedToUserName) : "") +
        "</p>" +
        (t.notes && !compact ? "<p>" + esc(t.notes) + "</p>" : "") +
        '<div class="task-meta"><span class="task-time ' +
        (late ? "overdue" : "") +
        '">' +
        (late ? "Gecikmiş · " : "") +
        date(t.dueDate, {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }) +
        "</span>" +
        (!compact && t.relatedCustomerId
          ? btn(
              state.customers.find((c) => c.id === t.relatedCustomerId)?.name ||
                "Müşteri",
              "customer-detail",
              t.relatedCustomerId,
              "subtle small",
            )
          : "") +
        (!compact && t.relatedPropertyId
          ? btn(
              "İlgili portföy",
              "property-detail",
              t.relatedPropertyId,
              "subtle small",
            )
          : "") +
        "</div></div>" +
        (!compact && canTask(t)
          ? '<div class="actions">' +
            iconBtn("edit", "Görevi düzenle", "edit-task", t.id) +
            iconBtn("trash", "Görevi sil", "delete-task", t.id) +
            "</div>"
          : "") +
        "</div>"
      );
    })
    .join("");
}
export function dashboard() {
  const props = state.properties.filter((p) => !p.isArchived);
  const pending = state.tasks.filter((t) => !t.isCompleted);
  const due = pending.filter((t) => dateKey(t.dueDate) === today());
  const late = pending.filter((t) => Date.parse(t.dueDate) < Date.now());
  const week = Date.now() - 7 * 86400000;
  const newCount = state.customers.filter(
    (c) => Date.parse(c.createdAt) >= week,
  ).length;
  const currencies = [...new Set(props.map((p) => p.currency || "TRY"))];
  const total = props
    .filter((p) => (p.currency || "TRY") === "TRY")
    .reduce((sum, p) => sum + Number(p.price || 0), 0);
  const schedule = [
    ...due,
    ...pending.filter((t) => dateKey(t.dueDate) !== today()),
  ].slice(0, 4);
  return (
    heading(
      '<span class="date-label">' +
        icon("calendar") +
        date(new Date(), { weekday: "long", day: "numeric", month: "long" }) +
        "</span>" +
        btn("Yeni kayıt", "quick-add", "", "primary", "plus"),
    ) +
    '<div class="metrics">' +
    metric(
      "Aktif portföy",
      props.length,
      props.filter((p) => p.status === "satilik").length +
        " satılık · " +
        props.filter((p) => p.status === "kiralik").length +
        " kiralık",
      "home",
    ) +
    metric(
      "Toplam müşteri",
      state.customers.length,
      '<span class="positive">' + newCount + " yeni müşteri</span> · son 7 gün",
      "users",
    ) +
    metric(
      "Bugünkü plan",
      due.length,
      late.length
        ? late.length + " gecikmiş görev"
        : "Bekleyen " + pending.length + " görev",
      "calendar",
    ) +
    metric(
      "Portföy değeri",
      money(total, "TRY", true),
      currencies.length > 1
        ? "Yalnızca TL portföylerin toplamı"
        : "Aktif portföylerin ilan değeri",
      "wallet",
    ) +
    '</div><div class="welcome-banner"><div><h2>' +
    (late.length
      ? "Önceliklerinize küçük bir göz atın."
      : "Gününüzü bir adım önden planlayın.") +
    "</h2><p>" +
    (late.length
      ? late.length +
        " görevin tarihi geçmiş. Görüşmelerinizi tamamlayarak ajandanızı güncel tutun."
      : "Portföyünüzü güncelleyin, müşterilerinizi takip edin ve bir sonraki görüşmenizi planlayın.") +
    "</p></div>" +
    btn("Ajandayı aç", "navigate", "tasks", "small") +
    '</div><div class="dashboard-grid"><div class="stack"><section class="panel"><div class="panel-head"><div><h2>Son eklenen portföyler</h2><p>Ofisinizin güncel gayrimenkul listesi</p></div>' +
    btn("Tümünü gör", "navigate", "properties", "subtle small") +
    "</div>" +
    propertyTable(props.slice(0, 5), true) +
    '<div class="table-footer"><span>' +
    props.length +
    ' aktif portföy</span><span>Son eklenene göre</span></div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h2>Takip edilecek işler</h2><p>Bugün ve yaklaşan görevler</p></div>' +
    badge(pending.length + " açık", "blue") +
    "</div>" +
    (schedule.length
      ? taskRows(schedule, true)
      : empty(
          "Ajandanız açık",
          "Yeni bir görüşme planlayarak başlayın.",
          btn("Görüşme planla", "navigate", "tasks", "small"),
        )) +
    '</section><section class="panel"><div class="panel-head"><div><h2>Müşteri süreci</h2><p>Görüşmeleriniz hangi aşamada?</p></div>' +
    icon("trend") +
    '</div><div class="pipeline">' +
    ["yeni", "aktif", "gosterim", "teklif", "kapandi_basarili"]
      .map((status) => {
        const count = state.customers.filter(
          (c) => (c.pipelineStatus || c.status) === status,
        ).length;
        return (
          '<div class="pipeline-row"><span>' +
          label(status) +
          '</span><progress class="progress" max="' +
          Math.max(1, state.customers.length) +
          '" value="' +
          count +
          '" aria-label="' +
          label(status) +
          '"></progress><strong>' +
          count +
          "</strong></div>"
        );
      })
      .join("") +
    "</div></section></div></div>" +
    footer()
  );
}
export function filterProperties(list) {
  const f = state.filters;
  return list.filter(
    (p) =>
      (f.archived ? !!p.isArchived : !p.isArchived) &&
      (!f.q ||
        norm([p.title, p.city, p.district, p.portfolioCode].join(" ")).includes(
          norm(f.q),
        )) &&
      (!f.status || p.status === f.status) &&
      (!f.type || p.type === f.type) &&
      (!f.city || p.city === f.city) &&
      (!f.currency || (p.currency || "TRY") === f.currency) &&
      (!f.min || p.price >= Number(f.min)) &&
      (!f.max || p.price <= Number(f.max)) &&
      (!f.rooms || p.rooms === f.rooms) &&
      (!f.mine || p.createdById === state.session.user.id) &&
      (!f.favorite || p.isFavorite),
  );
}
const searchControl = (placeholder) =>
  '<div class="search-field">' +
  icon("search") +
  '<input class="control" id="list-search" data-filter="q" aria-label="' +
  esc(placeholder) +
  '" placeholder="' +
  esc(placeholder) +
  '" value="' +
  esc(state.filters.q || "") +
  '"></div>';
const selectFilter = (name, list, all) =>
  '<select class="control" data-filter="' +
  name +
  '" aria-label="' +
  all +
  '">' +
  options(list, state.filters[name] || "", all) +
  "</select>";
const pagination = (result) =>
  '<div class="actions">' +
  (result.page > 1 ? btn("Önceki", "list-page", result.page - 1) : "") +
  "<span>" +
  result.page +
  " / " +
  Math.max(1, Math.ceil(result.total / 30)) +
  "</span>" +
  (result.page * 30 < result.total
    ? btn("Sonraki", "list-page", result.page + 1)
    : "") +
  "</div>";
async function records(kind) {
  const params = new URLSearchParams(
    Object.entries(state.filters).filter(
      ([, value]) => value !== "" && value !== false && value != null,
    ),
  );
  return api("/records/" + kind + "?" + params);
}
export async function properties() {
  const f = state.filters;
  const result = await records("properties");
  const list = result.items;
  return (
    heading(btn("Portföy ekle", "new-property", "", "primary", "plus")) +
    '<div class="toolbar">' +
    searchControl("Başlık, bölge veya portföy kodu ara") +
    selectFilter(
      "status",
      ["satilik", "kiralik", "satildi", "kiralandi"],
      "Tüm durumlar",
    ) +
    selectFilter(
      "type",
      [...new Set(state.properties.map((p) => p.type).filter(Boolean))],
      "Tüm türler",
    ) +
    '</div><details class="panel filter-panel"' +
    (f.advanced ? " open" : "") +
    ' id="advanced-filters"><summary>Diğer filtreler' +
    (Object.keys(f).filter(
      (k) => !["q", "status", "type", "advanced"].includes(k) && f[k],
    ).length
      ? " · Filtre uygulanıyor"
      : "") +
    '</summary><div class="filter-grid"><label>Şehir' +
    selectFilter(
      "city",
      [...new Set(state.properties.map((p) => p.city).filter(Boolean))],
      "Tüm şehirler",
    ) +
    "</label><label>Para birimi" +
    selectFilter(
      "currency",
      ["TRY", "USD", "EUR", "GBP"],
      "Tüm para birimleri",
    ) +
    '</label><label>En düşük fiyat<input class="control" type="number" min="0" data-filter="min" value="' +
    esc(f.min || "") +
    '"></label><label>En yüksek fiyat<input class="control" type="number" min="0" data-filter="max" value="' +
    esc(f.max || "") +
    '"></label><label>Oda' +
    selectFilter(
      "rooms",
      [...new Set(state.properties.map((p) => p.rooms).filter(Boolean))],
      "Tüm odalar",
    ) +
    "</label>" +
    [
      ["mine", "Yalnızca benim kayıtlarım"],
      ["favorite", "Favoriler"],
      ["archived", "Arşiv kayıtları"],
    ]
      .map(
        ([k, t]) =>
          '<label class="check-label"><input type="checkbox" data-filter="' +
          k +
          '"' +
          (f[k] ? " checked" : "") +
          ">" +
          t +
          "</label>",
      )
      .join("") +
    '</div></details><section class="panel">' +
    propertyTable(list) +
    '<div class="table-footer"><span>' +
    result.total +
    " kayıt gösteriliyor</span>" +
    btn("Filtreleri temizle", "clear-filters", "", "subtle small") +
    "</div></section>" +
    pagination(result) +
    footer()
  );
}
export function customerTable(list, pool = false) {
  if (!list.length)
    return empty(
      "Müşteri bulunamadı",
      pool
        ? "Diğer ofislerin paylaştığı müşteri talepleri burada görünür."
        : "İlk müşteri kaydınızı ekleyin veya arama filtrelerini değiştirin.",
      pool ? "" : btn("Müşteri ekle", "new-customer", "", "primary", "plus"),
    );
  return (
    '<div class="table-wrap"><table><thead><tr><th>Müşteri</th><th>Aşama</th><th>Bütçe</th><th>Tercih edilen bölge</th><th>' +
    (pool ? "Ofis" : "Sorumlu") +
    "</th><th>İşlem</th></tr></thead><tbody>" +
    list
      .map(
        (c) =>
          '<tr><td><div class="record-cell"><span class="avatar">' +
          esc(initials(c.name)) +
          '</span><div><button class="record-link" data-action="customer-detail" data-id="' +
          esc(c.id) +
          '">' +
          esc(c.name) +
          '</button><span class="sub">' +
          esc(c.phone || "İletişim gizli") +
          "</span></div></div></td><td>" +
          statusBadge(c.pipelineStatus || c.status) +
          '</td><td class="money">' +
          money(c.totalBudget) +
          '<span class="sub">' +
          esc(label(c.purpose)) +
          "</span></td><td>" +
          esc(
            [
              c.preferredCity,
              ...(c.preferredDistricts || []),
              ...(c.preferredNeighborhoods || []),
            ]
              .filter(Boolean)
              .join(", ") || "Belirtilmedi",
          ) +
          "</td><td>" +
          esc(pool ? c.ownerCompany?.name : c.createdByName || "Atanmamış") +
          '</td><td><div class="actions">' +
          iconBtn("match", "Uygun portföyleri bul", "match-customer", c.id) +
          (canEdit(c)
            ? iconBtn("edit", "Müşteriyi düzenle", "edit-customer", c.id) +
              btn("Sil", "delete-customer", c.id, "small danger", "trash")
            : "") +
          "</div></td></tr>",
      )
      .join("") +
    "</tbody></table></div>"
  );
}
export async function customers() {
  const f = state.filters;
  const result = await records("customers");
  const list = result.items;
  return (
    heading(btn("Müşteri ekle", "new-customer", "", "primary", "plus")) +
    '<div class="tabs" role="group" aria-label="Müşteri aşamaları">' +
    [
      ["", "Tümü"],
      ...["yeni", "aktif", "gosterim", "teklif", "kapandi_basarili"].map(
        (s) => [s, label(s)],
      ),
    ]
      .map(
        ([k, t]) =>
          '<button class="tab ' +
          ((f.status || "") === k ? "active" : "") +
          '" data-action="filter-status" data-id="' +
          k +
          '">' +
          t +
          "<small>" +
          state.customers.filter(
            (c) => !k || (c.pipelineStatus || c.status) === k,
          ).length +
          "</small></button>",
      )
      .join("") +
    '</div><div class="toolbar">' +
    searchControl("Ad, telefon veya bölge ara") +
    selectFilter(
      "customerClass",
      [
        ["A", "A · Öncelikli"],
        ["B", "B · Standart"],
        ["C", "C · Uzun vadeli"],
        ["D", "D · Düşük öncelik"],
      ],
      "Tüm öncelikler",
    ) +
    selectFilter(
      "status",
      [
        "yeni",
        "aktif",
        "gosterim",
        "teklif",
        "kapandi_basarili",
        "kaybedildi",
        "pasif",
      ],
      "Tüm aşamalar",
    ) +
    '</div><section class="panel">' +
    customerTable(list) +
    '<div class="table-footer"><span>' +
    result.total +
    " müşteri gösteriliyor</span>" +
    btn("Filtreleri temizle", "clear-filters", "", "subtle small") +
    "</div></section>" +
    pagination(result) +
    footer()
  );
}
export async function inbox() {
  const tasks = (await api("/followups?onlyMine=true"))
    .filter((task) => task.assignedToUserId === state.session.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const query = norm(state.filters.inboxSearch || "");
  const status = state.filters.inboxStatus || "pending";
  const filtered = tasks.filter(
    (task) =>
      (status === "all" ||
        (status === "done" ? task.isCompleted : !task.isCompleted)) &&
      norm(task.title + " " + task.notes).includes(query),
  );
  return (
    heading() +
    '<div class="form-grid"><label class="form-field">Görev ara<input class="control" type="search" data-filter="inboxSearch" value="' +
    esc(state.filters.inboxSearch || "") +
    '"></label>' +
    '<label class="form-field">Durum<select class="control" data-filter="inboxStatus">' +
    options(
      [
        ["pending", "Bekleyen"],
        ["done", "Tamamlanan"],
        ["all", "Tümü"],
      ],
      status,
    ) +
    '</select></label></div><section class="panel">' +
    (filtered.length
      ? filtered
          .map(
            (task) =>
              '<div class="panel-body"><strong>' +
              esc(task.title) +
              "</strong>" +
              '<p style="white-space:pre-wrap">' +
              esc(task.notes || "") +
              "</p>" +
              '<p class="muted">' +
              esc(date(task.createdAt)) +
              "</p>" +
              "<p>Görevi veren: " +
              esc(
                state.members.find((m) => m.userId === task.createdById)
                  ?.fullName || "Kayıtlı değil",
              ) +
              " · " +
              (task.readAt ? "Okundu" : "Yeni görev") +
              "</p>" +
              (!task.readAt
                ? btn("Okundu", "read-task", task.id, "small")
                : "") +
              btn(
                task.isCompleted ? "Yeniden aç" : "Tamamlandı",
                "complete-task",
                task.id,
                "small",
              ) +
              "</div>",
          )
          .join("")
      : '<p class="panel-body">Bu görünümde görev yok.</p>') +
    "</section>"
  );
}
export function tasks() {
  const f = state.filters;
  const pending = state.tasks.filter((t) => !t.isCompleted);
  const list = state.tasks.filter(
    (t) =>
      (!f.q ||
        norm([t.title, t.notes, t.assignedToUserName].join(" ")).includes(
          norm(f.q),
        )) &&
      (f.status === "done" ? t.isCompleted : !t.isCompleted) &&
      (!f.day || dateKey(t.dueDate) === f.day) &&
      (f.status === "late" ? Date.parse(t.dueDate) < Date.now() : true),
  );
  const days = Array.from(
    { length: 7 },
    (_, i) => new Date(Date.now() + i * 86400000),
  );
  return (
    heading(btn("Görev ekle", "new-task", "", "primary", "plus")) +
    '<div class="week-strip">' +
    days
      .map((d) => {
        const key = dateKey(d);
        return (
          '<button class="day ' +
          (key === today() ? "today " : "") +
          (key === f.day ? "selected" : "") +
          '" data-action="filter-day" data-id="' +
          key +
          '" aria-pressed="' +
          (key === f.day) +
          '">' +
          date(d, { weekday: "short" }) +
          "<strong>" +
          date(d, { day: "numeric" }) +
          "</strong><small>" +
          pending.filter((t) => dateKey(t.dueDate) === key).length +
          " görev</small></button>"
        );
      })
      .join("") +
    '</div><div class="toolbar">' +
    searchControl("Görev veya kişi ara") +
    '<div class="segmented" role="group" aria-label="Görev durumu">' +
    [
      ["", "Bekleyen"],
      ["late", "Gecikmiş"],
      ["done", "Tamamlanan"],
    ]
      .map(
        ([k, t]) =>
          '<button class="' +
          ((f.status || "") === k ? "active" : "") +
          '" data-action="filter-status" data-id="' +
          k +
          '">' +
          t +
          "</button>",
      )
      .join("") +
    "</div>" +
    (f.day ? btn("Tüm tarihleri göster", "filter-day", "", "small") : "") +
    '</div><section class="panel"><div class="panel-head"><h2>' +
    (f.day ? date(f.day, { day: "numeric", month: "long" }) : "Görev listesi") +
    "</h2>" +
    badge(list.length + " görev", "blue") +
    "</div>" +
    (list.length
      ? taskRows(list)
      : empty(
          "Bu görünümde görev yok",
          "Yeni bir görev planlayın veya tarih ve durum filtrelerini değiştirin.",
          btn("Görev ekle", "new-task", "", "small"),
        )) +
    "</section>" +
    footer()
  );
}
export async function matching() {
  const mode = state.matchMode;
  const records =
    mode === "customer"
      ? state.customers
      : state.properties.filter((p) => !p.isArchived);
  let chosen = state.matchId;
  let result = null;
  if (chosen) {
    try {
      result = await api(
        "/matching?" +
          (mode === "customer" ? "customerId=" : "propertyId=") +
          encodeURIComponent(chosen),
      );
    } catch (error) {
      if (error.status !== 404) throw error;
      if (state.matchMode === mode && state.matchId === chosen)
        state.matchId = null;
      chosen = null;
    }
  }
  return (
    heading(
      '<label class="check-label"><input type="checkbox" data-filter="allMatches"' +
        (state.filters.allMatches ? " checked" : "") +
        ">Tüm ürünleri bul</label>",
    ) +
    '<div class="notice">Bütçe, bölge, oda ve diğer tercihlere göre puanlanır. Sonuçlar karar desteğidir; eksik bilgileri görüşmede doğrulayın.</div><div class="split-layout"><section class="panel"><div class="panel-head"><div class="segmented">' +
    ["customer", "property"]
      .map(
        (k) =>
          '<button class="' +
          (mode === k ? "active" : "") +
          '" data-action="match-mode" data-id="' +
          k +
          '">' +
          (k === "customer" ? "Müşteriden bul" : "Portföyden bul") +
          "</button>",
      )
      .join("") +
    '</div></div><div class="selector-list">' +
    (records.length
      ? records
          .map(
            (r) =>
              '<button class="selector-item ' +
              (chosen === r.id ? "selected" : "") +
              '" data-action="match-select" data-id="' +
              esc(r.id) +
              '"><strong>' +
              esc(r.name || r.title) +
              "</strong><small>" +
              money(r.totalBudget ?? r.price, r.currency) +
              " · " +
              esc(
                (r.preferredNeighborhoods?.length
                  ? r.preferredNeighborhoods
                  : r.preferredDistricts || [r.district]
                )
                  .filter(Boolean)
                  .join(", "),
              ) +
              "</small></button>",
          )
          .join("")
      : empty(
          "Önce bir kayıt ekleyin",
          mode === "customer"
            ? "Eşleştirmeye başlamak için bir müşteri ekleyin."
            : "Eşleştirmeye başlamak için bir portföy ekleyin.",
          mode === "customer"
            ? btn("Müşteri ekle", "new-customer", "", "small", "plus")
            : btn("Portföy ekle", "new-property", "", "small", "plus"),
        )) +
    '</div></section><section class="panel">' +
    (!result
      ? empty(
          "Bir kayıt seçerek başlayın",
          mode === "customer"
            ? "Uygun portföyleri görmek için bir müşteri seçin."
            : "Uygun müşterileri görmek için bir portföy seçin.",
        )
      : '<div class="panel-head"><div><h2>' +
        esc(result.target.data.name || result.target.data.title) +
        "</h2><p>" +
        result.matches.filter((m) => m.verdict !== "eliminated").length +
        " sonuç değerlendirildi</p></div>" +
        badge("Kriter karşılaştırması", "blue") +
        "</div>" +
        (result.matches.length
          ? result.matches
              .filter(
                (m) =>
                  state.filters.allMatches ||
                  (m.score >= 50 && m.verdict !== "eliminated"),
              )
              .map((m) => {
                const r = m.property || m.customer;
                return (
                  '<article class="match-card"><div class="match-score"><strong>' +
                  m.score +
                  '</strong><small>/ 100 UYUM</small></div><div class="match-info"><h3>' +
                  esc(r?.title || r?.name) +
                  '</h3><div class="task-meta">' +
                  badge(
                    {
                      high: "Yüksek uyum",
                      medium: "Orta uyum",
                      low: "Düşük uyum",
                      eliminated: "Kriter dışı",
                    }[m.verdict],
                    m.verdict === "high"
                      ? "green"
                      : m.verdict === "eliminated"
                        ? "red"
                        : "amber",
                  ) +
                  '<span class="small muted">' +
                  money(r?.price ?? r?.totalBudget, r?.currency) +
                  '</span></div><ul class="reasons">' +
                  m.reasons
                    .map(
                      (reason) =>
                        "<li>" +
                        icon(reason.type === "positive" ? "check" : "help") +
                        "<span>" +
                        esc(reason.text) +
                        "<br>" +
                        esc(reason.detail || "") +
                        "</span></li>",
                    )
                    .join("") +
                  "</ul>" +
                  btn(
                    "Kaydı incele",
                    m.property ? "property-detail" : "customer-detail",
                    r.id,
                    "small",
                  ) +
                  "</div></article>"
                );
              })
              .join("")
          : empty(
              "Karşılaştırılacak kayıt yok",
              "Portföyünüze ve müşteri listenize kayıt ekleyin.",
            ))) +
    "</section></div>" +
    footer()
  );
}
export async function pool() {
  const kind = state.poolKind;
  const own = state.filters.scope === "my_pool";
  const data = await api("/" + kind + "?scope=" + (own ? "my_pool" : "pool"));
  const list = data.filter(
    (r) =>
      !state.filters.q ||
      norm(
        [r.title, r.name, r.city, r.district, r.ownerCompanyName].join(" "),
      ).includes(norm(state.filters.q)),
  );
  return (
    heading(
      manager()
        ? btn("Ortak ağ API oluştur / ekle", "navigate", "network")
        : "",
    ) +
    '<div class="notice">Paylaşımlar ofis yöneticileri tarafından açılır. Diğer ofislerin müşteri iletişim bilgileri ve portföy sahiplerinin özel bilgileri gösterilmez.</div><div class="tabs"><button class="tab ' +
    (kind === "properties" ? "active" : "") +
    '" data-action="pool-kind" data-id="properties">Portföyler</button><button class="tab ' +
    (kind === "customers" ? "active" : "") +
    '" data-action="pool-kind" data-id="customers">Müşteri talepleri</button></div><div class="toolbar">' +
    searchControl("Ortak ağda ara") +
    '<div class="segmented"><button class="' +
    (!own ? "active" : "") +
    '" data-action="pool-scope" data-id="pool">Diğer ofisler</button><button class="' +
    (own ? "active" : "") +
    '" data-action="pool-scope" data-id="my_pool">Paylaştıklarımız</button></div></div><section class="panel">' +
    (kind === "properties"
      ? propertyTable(list, false, !own)
      : customerTable(list, !own)) +
    '<div class="table-footer">' +
    list.length +
    " kayıt</div></section>" +
    footer()
  );
}
export function team() {
  if (!manager())
    return (
      heading() + empty("Erişim yok", "Bu alan broker ve yöneticilere açıktır.")
    );
  const members = state.members;
  const selected =
    members.find((m) => m.userId === state.teamMemberId) || members[0];
  const selectedId = selected?.userId;
  const allRecords = state.teamRecords === "all";
  const properties = state.properties.filter(
    (p) => allRecords || (p.assignedToUserId || p.createdById) === selectedId,
  );
  const customers = state.customers.filter(
    (c) => allRecords || (c.assignedToUserId || c.createdById) === selectedId,
  );
  const memberOptions = members.map((m) => [m.userId, m.fullName]);
  const assignmentRows = (records, kind) =>
    records.length
      ? '<div class="table-wrap"><table><thead><tr><th>' +
        (kind === "property" ? "Portföy" : "Müşteri") +
        "</th><th>Konum / bütçe</th><th>Sorumlu</th><th>İşlem</th></tr></thead><tbody>" +
        records
          .map(
            (record) =>
              "<tr><td><strong>" +
              esc(record.title || record.name) +
              "</strong></td><td>" +
              esc(
                kind === "property"
                  ? [record.district, record.city].filter(Boolean).join(", ")
                  : money(record.totalBudget),
              ) +
              '</td><td><select class="control" data-record-assign="' +
              kind +
              '" data-id="' +
              esc(record.id) +
              '" aria-label="' +
              esc((record.title || record.name) + " sorumlusu") +
              '">' +
              options(
                memberOptions,
                record.assignedToUserId || record.createdById,
              ) +
              '</select></td><td><div class="actions">' +
              btn(
                "Aç",
                kind === "property" ? "property-detail" : "customer-detail",
                record.id,
                "small",
              ) +
              (canEdit(record)
                ? btn("Sil", "delete-" + kind, record.id, "small danger", "trash")
                : "") +
              "</div></td></tr>",
          )
          .join("") +
        "</tbody></table></div>"
      : empty("Kayıt yok", "Bu görünümde kayıt bulunmuyor.");
  return (
    heading(
      btn("Departman ekle", "new-department", "", "primary", "plus") +
        btn("Danışman oluştur", "new-staff"),
    ) +
    '<div class="team-layout"><section class="panel"><div class="panel-head"><h2>Ekip</h2>' +
    badge(members.length + " kişi") +
    '</div><div class="team-member-list">' +
    members
      .map((m) => {
        const propertyCount = state.properties.filter(
          (p) => (p.assignedToUserId || p.createdById) === m.userId,
        ).length;
        const customerCount = state.customers.filter(
          (c) => (c.assignedToUserId || c.createdById) === m.userId,
        ).length;
        return (
          '<button class="team-member ' +
          (m.userId === selectedId ? "selected" : "") +
          '" data-action="team-select" data-id="' +
          esc(m.userId) +
          '"><span class="avatar">' +
          esc(initials(m.fullName)) +
          "</span><span><strong>" +
          esc(m.fullName) +
          "</strong><small>" +
          esc(m.departmentName || "Departman yok") +
          " · " +
          propertyCount +
          " portföy · " +
          customerCount +
          " müşteri</small></span></button>"
        );
      })
      .join("") +
    '</div></section><div class="stack">' +
    (selected
      ? '<section class="panel"><div class="panel-head"><div><h2>' +
        esc(selected.fullName) +
        "</h2><p>" +
        esc(selected.email || "") +
        "</p></div>" +
        '<div class="actions">' +
        badge(label(selected.role), "blue") +
        (selected.role === "agent"
          ? btn("Sil", "delete-advisor", selected.id, "small danger", "trash")
          : "") +
        "</div>" +
        '</div><div class="panel-body"><label class="form-field">Departman<select class="control" data-member-dept="' +
        esc(selected.id) +
        '">' +
        options(
          state.departments.map((d) => [d.id, d.name]),
          selected.departmentId,
          "Departman yok",
        ) +
        "</select></label></div></section>"
      : empty("Ekip üyesi yok", "Önce danışman oluşturun veya davet edin.")) +
    '<section class="panel"><div class="panel-head"><h2>Departmanlar</h2>' +
    badge(state.departments.length) +
    '</div><div class="panel-body team-departments">' +
    (state.departments.length
      ? state.departments
          .map(
            (d) =>
              "<div><strong>" +
              esc(d.name) +
              "</strong><span>" +
              esc(d.memberCount) +
              " kişi · " +
              esc(d.propertiesCount) +
              " portföy · " +
              esc(d.customersCount) +
              " müşteri" +
              (d.permanent
                ? " · Genel danışman: " + esc(d.leader?.fullName || "Atanmamış")
                : "") +
              "</span>" +
              btn("Düzenle", "edit-department", d.id, "small") +
              (d.permanent
                ? ""
                : btn("Sil", "delete-department", d.id, "small danger", "trash")) +
              "</div>",
          )
          .join("")
      : "<p>Henüz departman eklenmemiş.</p>") +
    "</div></section></div></div>" +
    '<div class="tabs"><button class="tab ' +
    (!allRecords ? "active" : "") +
    '" data-action="team-records" data-id="selected">Seçili üyenin kayıtları</button>' +
    '<button class="tab ' +
    (allRecords ? "active" : "") +
    '" data-action="team-records" data-id="all">Tüm kayıtlar ve atamalar</button></div>' +
    '<div class="stack"><section class="panel"><div class="panel-head"><h2>Portföyler</h2>' +
    badge(properties.length) +
    "</div>" +
    assignmentRows(properties, "property") +
    '</section><section class="panel"><div class="panel-head"><h2>Müşteriler</h2>' +
    badge(customers.length) +
    "</div>" +
    assignmentRows(customers, "customer") +
    "</section></div>" +
    footer()
  );
}
export async function company() {
  const tab = state.companyTab;
  const c = state.session.company;
  const summary = manager() ? await api("/reports") : null;
  let invitations = [];
  if (manager() && tab === "members")
    invitations = await api("/companies/invitations");
  return (
    (summary
      ? '<div class="notice">Bu ay şirket kasasına kalan · ' +
        money(
          (summary.periods.find((p) => p.name === "Aylık")?.net || 0) / 100,
        ) +
        "</div>"
      : "") +
    heading(
      manager()
        ? btn(
            tab === "departments"
              ? "Departman ekle"
              : tab === "profile"
                ? "Şirketi düzenle"
                : "Ekip üyesi davet et",
            tab === "departments"
              ? "new-department"
              : tab === "profile"
                ? "edit-company"
                : "invite",
            "",
            "primary",
            "plus",
          ) + btn("Danışman oluştur", "new-staff")
        : "",
    ) +
    '<div class="tabs">' +
    [
      ["members", "Ekip üyeleri"],
      ["departments", "Departmanlar"],
      ["profile", "Şirket bilgileri"],
    ]
      .map(
        ([k, t]) =>
          '<button class="tab ' +
          (tab === k ? "active" : "") +
          '" data-action="company-tab" data-id="' +
          k +
          '">' +
          t +
          "</button>",
      )
      .join("") +
    "</div>" +
    (tab === "profile"
      ? '<section class="panel"><div class="panel-head"><h2>' +
        esc(c.name) +
        "</h2>" +
        badge("Aktif şirket", "green") +
        '</div><div class="panel-body"><dl class="info-grid">' +
        [
          ["E-posta", c.email],
          ["Telefon", c.phone],
          ["Şehir", c.city],
          ["Adres", c.address],
          ["Vergi numarası", c.taxNumber],
        ]
          .map(
            ([k, v]) =>
              '<div class="info-row"><dt>' +
              k +
              "</dt><dd>" +
              esc(v || "Belirtilmedi") +
              "</dd></div>",
          )
          .join("") +
        "</dl></div></section>"
      : tab === "departments"
        ? '<div class="settings-grid">' +
          (state.departments.length
            ? state.departments
                .map(
                  (d) =>
                    '<section class="panel"><div class="panel-head"><h2>' +
                    esc(d.name) +
                    "</h2>" +
                    badge(d.memberCount + " kişi", "blue") +
                    '</div><div class="panel-body"><p>' +
                    esc(d.description || "Departman açıklaması eklenmemiş.") +
                    '</p><dl class="info-grid"><div class="info-row"><dt>Departman sorumlusu</dt><dd>' +
                    esc(d.leader?.fullName || "Atanmamış") +
                    '</dd></div><div class="info-row"><dt>Portföy / Müşteri</dt><dd>' +
                    d.propertiesCount +
                    " / " +
                    d.customersCount +
                    "</dd></div></dl><p>" +
                    esc(
                      d.members.map((m) => m.fullName).join(", ") ||
                        "Henüz üye yok",
                    ) +
                    "</p>" +
                    (manager()
                      ? '<div class="actions">' +
                        btn(
                          "Düzenle",
                          "edit-department",
                          d.id,
                          "small",
                          "edit",
                        ) +
                        (d.permanent
                          ? ""
                          : btn(
                              "Sil",
                              "delete-department",
                              d.id,
                              "small danger",
                              "trash",
                            )) +
                        "</div>"
                      : "") +
                    "</div></section>",
                )
                .join("")
            : empty(
                "Departman eklenmemiş",
                "Ekibinizi bölge veya uzmanlık alanına göre organize edebilirsiniz.",
              )) +
          "</div>"
        : '<section class="panel"><div class="table-wrap"><table><thead><tr><th>Ekip üyesi</th><th>Rol</th><th>Departman</th><th>Katılım</th>' +
          (manager() ? "<th>İşlem</th>" : "") +
          "</tr></thead><tbody>" +
          state.members
            .map(
              (m) =>
                '<tr><td><div class="record-cell"><span class="avatar">' +
                esc(initials(m.fullName)) +
                "</span><div><strong>" +
                esc(m.fullName) +
                '</strong><span class="sub">' +
                esc(m.email) +
                "</span></div></div></td><td>" +
                badge(label(m.role), m.role === "owner" ? "blue" : "") +
                "</td><td>" +
                (manager()
                  ? '<select class="control" data-member-dept="' +
                    esc(m.id) +
                    '" aria-label="' +
                    esc(m.fullName) +
                    ' departmanı">' +
                    options(
                      state.departments.map((d) => [d.id, d.name]),
                      m.departmentId,
                      "Departman yok",
                    ) +
                    "</select>"
                  : esc(m.departmentName || "Atanmamış")) +
                "</td><td>" +
                date(m.joinedAt) +
                "</td>" +
                (manager()
                  ? "<td>" +
                    (m.role === "agent"
                      ? btn("Sil", "delete-advisor", m.id, "small danger", "trash")
                      : "") +
                    "</td>"
                  : "") +
                "</tr>",
            )
            .join("") +
          "</tbody></table></div></section>" +
          (manager()
            ? '<section class="panel"><div class="panel-head"><h2>Bekleyen davetler</h2>' +
              badge(invitations.length + " davet") +
              "</div>" +
              (invitations.length
                ? '<div class="table-wrap"><table><thead><tr><th>E-posta</th><th>Rol</th><th>Son geçerlilik</th><th>İşlem</th></tr></thead><tbody>' +
                  invitations
                    .map(
                      (i) =>
                        "<tr><td>" +
                        esc(i.email) +
                        "</td><td>" +
                        esc(label(i.role)) +
                        "</td><td>" +
                        date(i.expiresAt) +
                        "</td><td>" +
                        btn("İptal et", "revoke-invite", i.id, "small danger") +
                        "</td></tr>",
                    )
                    .join("") +
                  "</tbody></table></div>"
                : empty(
                    "Bekleyen davet yok",
                    "Yeni ekip üyelerini bir davet bağlantısıyla ofisinize ekleyebilirsiniz.",
                  )) +
              "</section>"
            : "")) +
    footer()
  );
}
export function settings() {
  return (
    heading() +
    '<div class="settings-grid"><section class="panel"><div class="panel-head"><h2>Hesap bilgileriniz</h2>' +
    icon("shield") +
    '</div><div class="panel-body"><dl class="info-grid">' +
    [
      ["Ad soyad", state.session.user.fullName],
      ["E-posta", state.session.user.email],
      ["Rol", label(state.session.role)],
      ["Ofis", state.session.company.name],
    ]
      .map(
        ([k, v]) =>
          '<div class="info-row"><dt>' +
          k +
          "</dt><dd>" +
          esc(v) +
          "</dd></div>",
      )
      .join("") +
    "</dl><p>Parolanızı değiştirdiğinizde diğer açık oturumlarınız sonlandırılır.</p>" +
    btn("Parolayı değiştir", "password", "", "", "shield") +
    "</div></section>" +
    (manager()
      ? '<section class="panel"><div class="panel-head"><h2>Şirket verileri</h2>' +
        icon("download") +
        '</div><div class="panel-body"><p>Ofisinize ait portföy, müşteri ve ajanda kayıtlarını JSON dosyası olarak indirin. Yedek dosyanız kişisel bilgiler içerir; güvenli bir yerde saklayın.</p><div class="actions">' +
        btn("Yedeği indir", "backup", "", "", "download") +
        (state.session.role === "owner"
          ? btn("Yedekten geri yükle", "restore", "", "", "upload")
          : "") +
        "</div></div></section>"
      : "") +
    '<section class="panel"><div class="panel-head"><h2>Çalışmaya başlarken</h2>' +
    icon("help") +
    '</div><div class="panel-body"><p>Temel işlemleri, müşteri aşamalarını ve ekip yetkilerini kısa rehberden öğrenin.</p>' +
    btn("Kullanım rehberi", "navigate", "guide", "", "help") +
    "</div></section></div>" +
    footer()
  );
}
export function guide() {
  const steps = [
    [
      "Portföyünüzü ekleyin",
      "Portföy sayfasındaki “Portföy ekle” ile başlık, fiyat ve konum bilgilerini girin. Ayrıntılı özellikler ve özel notlar formdaki açılır bölümlerdedir.",
      "properties",
    ],
    [
      "Müşteri talebini kaydedin",
      "Müşteriler sayfasında iletişim, bütçe ve bölge tercihlerini ekleyin. Görüşme ilerledikçe müşteri aşamasını güncelleyin.",
      "customers",
    ],
    [
      "Uygun seçenekleri karşılaştırın",
      "Eşleştirme sayfasında müşteri veya portföy seçin. Her sonuçta puanı ve hangi tercihlerin karşılandığını inceleyin.",
      "matching",
    ],
    [
      "Bir sonraki adımı planlayın",
      "Ajandaya arama, yer gösterimi veya sözleşme görevi ekleyin. İlgili müşteri ve portföyü bağlayın; iş bitince kutucuğu işaretleyin.",
      "tasks",
    ],
    [
      "Ekibinizle çalışın",
      "Şirket ve ekip bölümünden davet bağlantısı oluşturun. Yöneticiler şirket kayıtlarını, danışmanlar kendi ekledikleri kayıtları düzenler.",
      "company",
    ],
    [
      "Kontrollü paylaşın",
      "Kayıt detayındaki paylaşım işlemiyle portföyü veya onaylı müşteri talebini diğer ofislere açın. Aynı yerden paylaşımı geri çekebilirsiniz.",
      "pool",
    ],
  ];
  return (
    heading() +
    '<section class="panel"><div class="panel-body">' +
    steps
      .map(
        ([title, copy, page], i) =>
          '<div class="guide-step"><span class="step-number">' +
          (i + 1) +
          "</span><div><h3>" +
          title +
          "</h3><p>" +
          copy +
          "</p>" +
          btn(
            pages[page][0] + " sayfasını aç",
            "navigate",
            page,
            "subtle small",
          ) +
          "</div></div>",
      )
      .join("") +
    "</div></section>" +
    footer()
  );
}
export function search() {
  const q = norm(state.filters.q);
  const props = state.properties.filter((p) =>
    norm([p.title, p.city, p.district, p.portfolioCode].join(" ")).includes(q),
  );
  const customers = state.customers.filter((c) =>
    norm([c.name, c.phone, c.email].join(" ")).includes(q),
  );
  const tasks = state.tasks.filter((t) =>
    norm([t.title, t.notes].join(" ")).includes(q),
  );
  return (
    heading() +
    '<div class="toolbar">' +
    searchControl("Tüm kayıtlarda ara") +
    '</div><div class="stack"><section class="panel"><div class="panel-head"><h2>Portföyler</h2>' +
    badge(props.length) +
    "</div>" +
    propertyTable(props.slice(0, 30), true) +
    '</section><section class="panel"><div class="panel-head"><h2>Müşteriler</h2>' +
    badge(customers.length) +
    "</div>" +
    customerTable(customers.slice(0, 30)) +
    '</section><section class="panel"><div class="panel-head"><h2>Görevler</h2>' +
    badge(tasks.length) +
    "</div>" +
    (tasks.length
      ? taskRows(tasks.slice(0, 30))
      : empty("Görev bulunamadı", "Farklı bir sözcükle tekrar arayın.")) +
    "</section></div>" +
    footer()
  );
}
export const renderers = {
  audit: auditView,
  inbox,
  sales: salesView,
  finance: financeView,
  network: networkView,
  reports: reportsView,
  dashboard,
  properties,
  customers,
  tasks,
  matching,
  pool,
  company,
  team,
  settings,
  guide,
  search,
};
export function authView(mode = "login", invite = null) {
  const register = mode === "register",
    accept = mode === "invite";
  const title = accept
    ? "Ekibinize katılın"
    : register
      ? "Ofisinizi oluşturalım."
      : "Tekrar hoş geldiniz.";
  return (
    '<main class="auth" id="main"><section class="auth-story"><div class="brand"><span class="brand-mark">P</span><span>payidar<small>GAYRİMENKUL CRM</small></span></div><div><div class="eyebrow">OFİSİNİZİN ÇALIŞMA ALANI</div><h1>İlişkileri güçlendirin.<br><span>İşinizi büyütün.</span></h1><p>Portföyünüz, müşterileriniz ve günün planı. Her şey yerli yerinde, bir sonraki adım hep net.</p><div class="auth-art" aria-hidden="true"><div class="auth-art-head"><i></i><i></i><i></i><span>Ofisinize genel bakış</span></div><div class="auth-art-cards">' +
    ["home", "users", "calendar"]
      .map(
        (i) => '<div class="auth-art-card">' + icon(i) + "<b></b><i></i></div>",
      )
      .join("") +
    '</div><div class="auth-art-row">' +
    icon("check") +
    '<span></span><b>Tamamlandı</b></div><div class="auth-art-row">' +
    icon("calendar") +
    '<span></span><b>Planlandı</b></div></div></div><footer>Payidar · Gayrimenkul profesyonelleri için</footer></section><section class="auth-form-area"><div class="brand"><span class="brand-mark">P</span>payidar</div><h2>' +
    title +
    '</h2><p class="muted">' +
    (accept
      ? esc(invite?.companyName || "Ofisiniz") +
        " ekibine katılmak için bilgilerinizi tamamlayın."
      : register
        ? "Ekibiniz için düzenli bir çalışma alanı kurun."
        : "Çalışma alanınıza giriş yaparak kaldığınız yerden devam edin.") +
    '</p><form id="auth-form" data-mode="' +
    mode +
    '"><div class="form-error" role="alert"></div>' +
    (register || accept
      ? field(
          "fullName",
          "Ad soyad",
          "",
          "text",
          true,
          'autocomplete="name" maxlength="150"',
        )
      : "") +
    (accept
      ? '<div class="notice">' +
        esc(invite.email) +
        "<br><small>Bu e-posta kayıtlıysa mevcut hesap parolanızı kullanın.</small></div>"
      : field(
          "email",
          register ? "E-posta adresi" : "Kullanıcı adı veya e-posta",
          "",
          register ? "email" : "text",
          true,
          'autocomplete="username" placeholder="ad@ofisiniz.com"',
        )) +
    (register
      ? field(
          "companyName",
          "Ofis adı",
          "",
          "text",
          true,
          'autocomplete="organization"',
        )
      : "") +
    '<label class="form-field" for="auth-password"><span>Parola</span><span class="password-wrap"><input class="control" id="auth-password" name="password" type="password" required ' +
    (register ? 'minlength="12"' : "") +
    ' maxlength="256" autocomplete="' +
    (register ? "new-password" : "current-password") +
    '" placeholder="' +
    (register ? "En az 12 karakter" : "Parolanız") +
    '">' +
    iconBtn("eye", "Parolayı göster veya gizle", "toggle-password") +
    "</span>" +
    (register
      ? "<small>En az 12 karakter. Birkaç sözcükten oluşan bir parola kullanabilirsiniz.</small>"
      : "") +
    '</label><button class="btn primary" type="submit">' +
    (accept
      ? "Daveti kabul et"
      : register
        ? "Çalışma alanını oluştur"
        : "Giriş yap") +
    "</button></form>" +
    (!accept
      ? '<p class="auth-switch">' +
        (register
          ? 'Zaten hesabınız var mı? <button data-action="auth-login">Giriş yapın</button>'
          : 'Yeni bir ofis mi? <button data-action="auth-register">Hesap oluşturun</button>') +
        "</p>"
      : "") +
    '<div class="auth-trust">' +
    icon("shield") +
    "Size ve ekibinize özel çalışma alanı</div></section></main>"
  );
}
