export const state = {
  session: null,
  properties: [],
  customers: [],
  tasks: [],
  members: [],
  departments: [],
  page: "dashboard",
  filters: {},
  poolKind: "properties",
  companyTab: "members",
  matchMode: "customer",
  matchId: null,
  dataLoaded: false,
};
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const icons = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  home: "m3 10 9-7 9 7 M5 9v12h14V9 M9 21v-8h6v8",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M15 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  calendar:
    "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 M8 14h1 M15 14h1 M8 18h1",
  match: "M4 5h5l6 14h5 M4 19h5l6-14h5 M17 2l3 3-3 3 M17 16l3 3-3 3",
  network:
    "M12 3v6 M5 21v-6h14v6 M12 9v6 M8 3h8v5H8z M2 21h6 M9 21h6 M16 21h6 M12 15v6",
  building:
    "M4 22V3h12v19 M16 10h4v12 M8 7h4 M8 11h4 M8 15h4 M8 22v-3h4v3 M2 22h20",
  settings:
    "m9 3-1 3-3 1v4l-2 1 2 3 2-1 3 2v3h4v-3l3-2 2 1 2-3-2-1V7l-3-1-1-3z M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  plus: "M12 5v14 M5 12h14",
  chevron: "m9 5 7 7-7 7",
  close: "m6 6 12 12 M6 18 18 6",
  check: "m5 12 4 4L19 6",
  clock: "M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  wallet: "M3 6h17v15H3z M3 6V3h15v3 M15 11h6v5h-6z M17 13h1",
  trend: "m3 17 6-6 4 4 8-11 M15 4h6v6",
  logout: "M9 4H3v16h6 M9 12h12 m-4-4 4 4-4 4",
  help: "M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 18h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z m-4 9 3 3 5-6",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  edit: "m16 3 5 5-12 12-6 1 1-6z M14 5l5 5",
  trash: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  star: "m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z",
  download: "M12 3v12 m-5-5 5 5 5-5 M4 15v6h16v-6",
  upload: "M12 16V4 m-5 5 5-5 5 5 M4 16v5h16v-5",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  phone: "M4 3h4l2 5-3 2c2 4 3 5 7 7l2-3 5 2v4c-8 3-20-9-17-17",
  map: "M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0 M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  copy: "M9 9h12v12H9z M15 9V3H3v12h6",
  archive: "M3 3h18v5H3z M5 8v13h14V8 M9 12h6",
  filter: "M3 5h18 M6 12h12 M10 19h4",
  refresh: "M20 11a8 8 0 1 0-2 6 M20 4v7h-7",
};
export const icon = (name) =>
  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
  (icons[name] || icons.grid) +
  '"/></svg>';
export const btn = (text, action, id = "", style = "", symbol = "") =>
  '<button type="button" class="btn ' +
  style +
  '" data-action="' +
  action +
  '" data-id="' +
  esc(id) +
  '">' +
  (symbol ? icon(symbol) : "") +
  esc(text) +
  "</button>";
export const iconBtn = (name, label, action, id = "", selected = false) =>
  '<button type="button" class="icon-btn' +
  (selected ? " selected" : "") +
  '" title="' +
  esc(label) +
  '" aria-label="' +
  esc(label) +
  '" data-action="' +
  action +
  '" data-id="' +
  esc(id) +
  '">' +
  icon(name) +
  "</button>";
export const labels = {
  secretary: "Sekreter",
  satilik: "Satılık",
  kiralik: "Kiralık",
  satildi: "Satıldı",
  kiralandi: "Kiralandı",
  arsiv: "Arşiv",
  yeni: "Yeni talep",
  aktif: "Görüşülüyor",
  gosterim: "Yer gösterimi",
  teklif: "Teklif aşaması",
  kapandi_basarili: "Kazanıldı",
  kaybedildi: "Kaybedildi",
  pasif: "Pasif",
  owner: "Şirket sahibi",
  admin: "Yönetici",
  agent: "Danışman",
  daire: "Daire",
  villa: "Villa",
  arsa: "Arsa",
  isyeri: "İş yeri",
  mustakil: "Müstakil ev",
  residans: "Rezidans",
  dukkan: "Dükkan",
  yapilacak: "Görev",
  arama: "Arama",
  ziyaret: "Yer gösterimi",
  toplanti: "Toplantı",
  sozlesme: "Sözleşme",
  takip: "Takip",
  telefon: "Telefon",
  ilan: "İlan",
  whatsapp: "WhatsApp",
  ofis: "Ofis",
  tavsiye: "Referans",
  sosyal_medya: "Sosyal medya",
  diger: "Diğer",
  oturum: "Oturum",
  yatirim: "Yatırım",
};
export const label = (value) => labels[value] || value || "Belirtilmedi";
export const badge = (text, color = "") =>
  '<span class="badge ' + color + '">' + esc(text) + "</span>";
export const statusBadge = (value) =>
  badge(
    label(value),
    {
      satilik: "blue",
      kiralik: "purple",
      satildi: "green",
      kiralandi: "green",
      yeni: "blue",
      aktif: "blue",
      gosterim: "purple",
      teklif: "amber",
      kapandi_basarili: "green",
      kaybedildi: "red",
    }[value] || "",
  );
export function money(value, currency = "TRY", compact = false) {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: ["TRY", "USD", "EUR", "GBP"].includes(currency)
      ? currency
      : "TRY",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(n);
}
export function date(value, options = { day: "numeric", month: "short" }) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    ...options,
  }).format(new Date(value));
}
export const dateKey = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export const today = () => dateKey(new Date());
export const initials = (value) =>
  String(value || "K")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toLocaleUpperCase("tr-TR");
export const norm = (value) => String(value || "").toLocaleLowerCase("tr-TR");
export const manager = () => ["owner", "admin"].includes(state.session?.role);
export const canEdit = (item) =>
  item.companyId === state.session?.company?.id &&
  (manager() ||
    (item.assignedToUserId || item.createdById) === state.session?.user?.id);
export const canTask = (item) =>
  manager() || item.assignedToUserId === state.session?.user?.id;
export const safeImage = (value) =>
  typeof value === "string" &&
  (/^https:\/\//i.test(value) || /^\/[^/]/.test(value))
    ? value
    : "";
export const thumb = (p) =>
  safeImage(p.images?.[0])
    ? '<img class="record-thumb" loading="lazy" referrerpolicy="no-referrer" src="' +
      esc(p.images[0]) +
      '" alt="">'
    : '<span class="record-thumb">' + icon("building") + "</span>";
export const empty = (title, text, action = "") =>
  '<div class="empty">' +
  icon("search") +
  "<h3>" +
  esc(title) +
  "</h3><p>" +
  esc(text) +
  "</p>" +
  action +
  "</div>";
export const options = (list, selected = "", all = "") =>
  (all ? '<option value="">' + esc(all) + "</option>" : "") +
  list
    .map((x) => {
      const [v, t] = Array.isArray(x) ? x : [x, label(x)];
      return (
        '<option value="' +
        esc(v) +
        '"' +
        (String(v) === String(selected) ? " selected" : "") +
        ">" +
        esc(t) +
        "</option>"
      );
    })
    .join("");
export function toast(message, error = false) {
  const node = document.createElement("div");
  node.className = "toast" + (error ? " error" : "");
  node.textContent = message;
  document.getElementById("toasts").append(node);
  setTimeout(() => node.remove(), 6000);
}
export async function api(path, { method = "GET", body, signal } = {}) {
  const response = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    signal,
    headers: { "Content-Type": "application/json", "X-CRM-Request": "1" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "Sunucudan geçersiz yanıt alındı." }));
  if (!response.ok) {
    const error = Object.assign(
      new Error(data.error || "İşlem tamamlanamadı."),
      { status: response.status },
    );
    if (response.status === 401 && state.session) {
      state.session = null;
      window.dispatchEvent(new Event("session-expired"));
    }
    throw error;
  }
  return data;
}
export async function loadData() {
  const [properties, customers, tasks, members, departments] =
    await Promise.all([
      api("/properties?includeArchived=true"),
      api("/customers"),
      api("/followups"),
      api("/companies/members"),
      api("/departments"),
    ]);
  Object.assign(state, {
    properties,
    customers,
    tasks,
    members,
    departments,
    dataLoaded: true,
  });
}
export function field(
  name,
  title,
  value = "",
  type = "text",
  required = false,
  extra = "",
) {
  return (
    '<label class="form-field" for="field-' +
    esc(name) +
    '"><span>' +
    esc(title) +
    (required ? ' <span class="required">*</span>' : "") +
    '</span><input class="control" id="field-' +
    esc(name) +
    '" name="' +
    esc(name) +
    '" type="' +
    type +
    '" value="' +
    esc(value) +
    '"' +
    (required ? " required" : "") +
    " " +
    extra +
    "></label>"
  );
}
