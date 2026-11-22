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
  manager,
  canEdit,
  safeImage,
  options,
  api,
  field,
  toast,
} from "./core.js";
let activeForm = null,
  returnFocus = null;
const dialog = () => document.getElementById("dialog");
export function closeDialog() {
  dialog().close();
  activeForm = null;
  returnFocus?.focus();
}
export function showDialog(title, body, description = "", footer = "") {
  returnFocus = document.activeElement;
  const d = dialog();
  activeForm = null;
  d.innerHTML =
    '<div class="dialog-head"><div><h2 id="dialog-title">' +
    esc(title) +
    "</h2>" +
    (description ? "<p>" + esc(description) + "</p>" : "") +
    "</div>" +
    iconBtn("close", "Pencereyi kapat", "close-dialog") +
    "</div>" +
    body +
    (footer ? '<div class="dialog-footer">' + footer + "</div>" : "");
  if (!d.open) d.showModal();
}
const kinds = {
  property: ["Portföy", "/properties"],
  customer: ["Müşteri", "/customers"],
  task: ["Görev", "/followups"],
  department: ["Departman", "/departments"],
  company: ["Şirket", "/companies/current"],
};
const pBasic = [
  ["title", "Portföy başlığı", "text", true],
  ["portfolioCode", "Portföy kodu"],
  ["status", "İlan durumu", ["satilik", "kiralik", "satildi", "kiralandi"]],
  [
    "type",
    "Gayrimenkul türü",
    ["daire", "villa", "mustakil", "residans", "arsa", "isyeri", "dukkan"],
  ],
  ["price", "Fiyat", "number", true],
  ["currency", "Para birimi", ["TRY", "USD", "EUR", "GBP"]],
  ["city", "Şehir", [], true],
  ["district", "İlçe", [], true],
  ["neighborhood", "Mahalle", []],
  [
    "rooms",
    "Oda sayısı",
    ["1+0", "1+1", "2+1", "3+1", "4+1", "5+1", "6+1", "7+1"],
  ],
  ["netArea", "Net alan (m²)", "number"],
  ["grossArea", "Brüt alan (m²)", "number"],
];
const pBuilding = [
  [
    "buildingAge",
    "Bina yaşı",
    Array.from({ length: 101 }, (_, i) => [
      String(i),
      i === 0 ? "Yeni bina" : i + " yaş",
    ]),
  ],
  ["floor", "Bulunduğu kat", "number"],
  ["totalFloors", "Toplam kat", "number"],
  ["bathrooms", "Banyo sayısı", "number"],
  [
    "heating",
    "Isıtma",
    [
      ["dogalgaz", "Doğalgaz"],
      ["merkezi", "Merkezi"],
      ["klima", "Klima"],
      ["soba", "Soba"],
      ["yok", "Yok"],
    ],
  ],
  [
    "furnishedStatus",
    "Eşya durumu",
    [
      ["esyasiz", "Eşyasız"],
      ["esyali", "Eşyalı"],
      ["kismi", "Kısmi eşyalı"],
    ],
  ],
  [
    "facade",
    "Cephe",
    ["kuzey", "guney", "dogu", "bati", "kuzey-dogu", "guney-bati"],
  ],
  ["siteName", "Site adı"],
  ["isSite", "Site içinde", "checkbox"],
  ["hasParking", "Otopark", "checkbox"],
  ["hasElevator", "Asansör", "checkbox"],
  ["hasBalcony", "Balkon", "checkbox"],
  [
    "features",
    "Diğer özellikler",
    "checks:ebeveyn-banyosu|giyinme-odasi|ankastre|teras|bahce|havuz|guvenlik|jenerator|isi-yalitimi|ses-yalitimi",
  ],
  ["address", "Açık adres", "textarea"],
  ["description", "Portföy açıklaması", "textarea"],
];
const pFinance = [
  ["estimatedRent", "Tahmini aylık kira", "number"],
  ["monthlyDues", "Aylık aidat", "number"],
  ["monthlyExpenses", "Aylık diğer giderler", "number"],
  [
    "tenantStatus",
    "Kullanım durumu",
    [
      ["bos", "Boş"],
      ["kiracili", "Kiracılı"],
      ["mal-sahibi", "Mal sahibi oturuyor"],
    ],
  ],
  [
    "deedStatus",
    "Tapu durumu",
    [
      ["kat-mulkiyeti", "Kat mülkiyeti"],
      ["kat-irtifaki", "Kat irtifakı"],
      ["arsa", "Arsa tapusu"],
      ["hisseli", "Hisseli"],
    ],
  ],
  [
    "authorizationStatus",
    "Yetki durumu",
    [
      ["yetkili", "Yetkili"],
      ["yetkisiz", "Yetkisiz"],
      ["bekliyor", "Bekleniyor"],
    ],
  ],
  ["legalEncumbrance", "Şerh / ipotek bilgisi"],
  ["saleReason", "Satış nedeni"],
  ["negotiationMargin", "Pazarlık payı (%)", "number"],
  [
    "urgencyLevel",
    "Aciliyet",
    [
      ["dusuk", "Düşük"],
      ["orta", "Orta"],
      ["yuksek", "Yüksek"],
    ],
  ],
  ["creditEligible", "Krediye uygun", "checkbox"],
  ["isSwap", "Takasa açık", "checkbox"],
];
const pPrivate = [
  ["contactName", "Mülk sahibi adı"],
  ["contactPhone", "Mülk sahibi telefonu", "tel"],
  ["notes", "Ofise özel notlar", "textarea"],
];
const cBasic = [
  ["name", "Ad soyad", "text", true],
  ["phone", "Telefon", "tel", true],
  [
    "pipelineStatus",
    "Görüşme aşaması",
    [
      "yeni",
      "aktif",
      "gosterim",
      "teklif",
      "kapandi_basarili",
      "kaybedildi",
      "pasif",
    ],
  ],
  ["minBudget", "En düşük bütçe (₺)", "number"],
  ["totalBudget", "En yüksek bütçe (₺)", "number", true],
  ["preferredDistricts", "Tercih edilen ilçeler", "list"],
  [
    "preferredRooms",
    "Tercih edilen odalar",
    "checks:1+0|1+1|2+1|3+1|4+1|5+1|6+1|7+1",
  ],
  [
    "preferredTypes",
    "İlgilendiği ürünler",
    "checks:daire|villa|mustakil|residans|arsa|isyeri|dukkan",
  ],
  ["preferredStatuses", "İşlem türleri", "checks:satilik|kiralik"],
  [
    "customerClass",
    "Öncelik",
    [
      ["A", "A · Öncelikli"],
      ["B", "B · Standart"],
      ["C", "C · Uzun vadeli"],
      ["D", "D · Düşük öncelik"],
    ],
  ],
  [
    "leadSource",
    "Talep kaynağı",
    ["telefon", "ilan", "whatsapp", "ofis", "tavsiye", "sosyal_medya", "diger"],
  ],
];
const cDetails = [
  [
    "purchaseTimeline",
    "Alım zamanı",
    [
      ["hemen", "Hemen"],
      ["1-3-ay", "1–3 ay"],
      ["3-6-ay", "3–6 ay"],
      ["6-ay-uzeri", "6 ay ve sonrası"],
    ],
  ],
  ["purpose", "Alım amacı", ["oturum", "yatirim"]],
  ["downPayment", "Peşinat (₺)", "number"],
  ["creditAmount", "Kredi miktarı (₺)", "number"],
  ["minNetArea", "En az net alan (m²)", "number"],
  ["maxBuildingAge", "En fazla bina yaşı", "number"],
  ["maxMonthlyDues", "En yüksek aidat (₺)", "number"],
  ["usesCredit", "Kredi kullanacak", "checkbox"],
  ["requiresSite", "Site içinde istiyor", "checkbox"],
  ["requiresParking", "Otopark istiyor", "checkbox"],
  ["notes", "Görüşme notları", "textarea"],
];
const cConsent = [
  ["kvkkConsent", "Kişisel veri işleme onayı kaydedildi", "checkbox"],
  ["contactPermission", "İletişim izni alındı", "checkbox"],
];
function control(spec, data) {
  const [key, title, type = "text", required = false] = spec;
  let value = data[key] ?? "";
  let html = "";
  const id = "field-" + key;
  const attr =
    ' id="' + id + '" name="' + key + '"' + (required ? " required" : "");
  const caption =
    esc(title) + (required ? ' <span class="required">*</span>' : "");
  if (typeof type === "string" && type.startsWith("checks:"))
    return (
      '<fieldset class="form-field"><legend>' +
      esc(title) +
      "</legend>" +
      type
        .slice(7)
        .split("|")
        .map(
          (v) =>
            '<label class="check-label"><input type="checkbox" name="' +
            key +
            '" value="' +
            esc(v) +
            '"' +
            ((data[key] || []).includes(v) ? " checked" : "") +
            ">" +
            esc(label(v)) +
            "</label>",
        )
        .join("") +
      "</fieldset>"
    );
  if (type === "checkbox")
    return (
      '<label class="check-label"><input type="checkbox" name="' +
      key +
      '"' +
      (value ? " checked" : "") +
      ">" +
      esc(title) +
      "</label>"
    );
  if (Array.isArray(type)) {
    let list = [...type];
    if (
      value &&
      !list.some((x) => String(Array.isArray(x) ? x[0] : x) === String(value))
    )
      list.push([value, label(value)]);
    html =
      '<select class="control"' +
      attr +
      ">" +
      options(list, value) +
      "</select>";
  } else if (["textarea", "list", "lines"].includes(type)) {
    if (Array.isArray(value))
      value = value.join(type === "lines" ? "\n" : ", ");
    html =
      (type === "list"
        ? '<input type="text" class="control"' +
          attr +
          ' value="' +
          esc(value) +
          '" placeholder="Virgülle ayırın">'
        : '<textarea class="control"' +
          attr +
          ' rows="3"' +
          (type === "lines"
            ? ' placeholder="Her satıra bir HTTPS fotoğraf adresi"'
            : "") +
          ">" +
          esc(value) +
          "</textarea>") +
      (type === "lines"
        ? "<small>Fotoğrafları HTTPS adresiyle ekleyin. Her satırda bir adres.</small>"
        : type === "list"
          ? "<small>Birden fazla değeri virgülle ayırın.</small>"
          : "");
  } else
    html =
      '<input class="control"' +
      attr +
      ' type="' +
      type +
      '" value="' +
      esc(value) +
      '"' +
      (type === "number"
        ? ' min="' + (key === "floor" ? "-10" : "0") + '" step="any"'
        : ' maxlength="' + (type === "password" ? "256" : "500") + '"') +
      ">";
  return (
    '<label class="form-field ' +
    (["textarea", "lines"].includes(type) ? "wide" : "") +
    '" for="' +
    id +
    '"><span>' +
    caption +
    "</span>" +
    html +
    "</label>"
  );
}
const group = (specs, data) =>
  '<div class="form-grid">' +
  specs.map((f) => control(f, data)).join("") +
  "</div>";
const section = (title, specs, data, note = "") =>
  '<details class="form-section"><summary>' +
  title +
  "</summary>" +
  (note ? '<div class="panel-body muted small">' + note + "</div>" : "") +
  group(specs, data) +
  "</details>";
export function formDialog(
  title,
  html,
  save,
  specs = [],
  description = "Yıldızlı alanlar zorunludur. Diğer bilgileri daha sonra tamamlayabilirsiniz.",
  button = "Kaydet",
) {
  showDialog(
    title,
    '<form id="record-form"><div class="dialog-body"><div class="form-error" role="alert"></div>' +
      html +
      '</div><div class="dialog-footer">' +
      btn("Vazgeç", "close-dialog") +
      '<button class="btn primary" type="submit">' +
      button +
      "</button></div></form>",
    description,
  );
  activeForm = { save, specs };
}
export async function openForm(kind, id = "", seed = {}) {
  showDialog("Form yükleniyor", "<p>Seçenekler hazırlanıyor.</p>");
  let data = {};
  let specs = [],
    html = "";
  if (id && kind !== "company")
    data =
      kind === "department"
        ? state.departments.find((d) => d.id === id)
        : await api(kinds[kind][1] + "/" + encodeURIComponent(id));
  if (kind === "property") {
    data = {
      type: "daire",
      status: "satilik",
      currency: "TRY",
      city: state.session.company.city || "",
      rooms: "3+1",
      heating: "dogalgaz",
      furnishedStatus: "esyasiz",
      tenantStatus: "bos",
      authorizationStatus: "bekliyor",
      urgencyLevel: "orta",
      ...data,
    };
    const locations = await api(
      "/locations?city=" +
        encodeURIComponent(data.city) +
        "&district=" +
        encodeURIComponent(data.district || ""),
    );
    for (const [key, values] of [
      ["city", locations.cities],
      ["district", locations.districts],
      ["neighborhood", locations.neighborhoods],
    ])
      pBasic.find((spec) => spec[0] === key)[2] = [["", "Seçin"], ...values];
    specs = [...pBasic, ...pBuilding, ...pFinance, ...pPrivate];
    html =
      group(pBasic, data) +
      section("Yapı özellikleri ve fotoğraflar", pBuilding, data) +
      section("Finansal ve hukuki bilgiler", pFinance, data) +
      section(
        "Mülk sahibi ve özel notlar",
        pPrivate,
        data,
        "Bu bilgiler ortak ağdaki diğer ofislere gösterilmez.",
      );
  }
  if (kind === "property")
    html +=
      '<details class="form-section" open><summary>Fotoğraf, video ve dosyalar</summary><p>En fazla 15 fotoğraf. Her dosya en fazla 50 MB.</p>' +
      [
        ["images", "Fotoğraflar", "image/jpeg,image/png,image/webp"],
        ["videos", "Videolar", "video/mp4"],
        ["documents", "Dosyalar", "application/pdf"],
      ]
        .map(
          ([key, title, accept]) =>
            '<label class="form-field">' +
            title +
            '<input type="file" name="upload-' +
            key +
            '" accept="' +
            accept +
            '" multiple></label>' +
            (data[key] || [])
              .map(
                (url) =>
                  '<label class="check-label"><input type="checkbox" name="keep-' +
                  key +
                  '" value="' +
                  esc(url) +
                  '" checked>Mevcut dosyayı koru · ' +
                  esc(url.split("/").pop()) +
                  "</label>",
              )
              .join(""),
        )
        .join("") +
      "</details>";
  if (kind === "customer") {
    data = {
      pipelineStatus: "yeni",
      customerClass: "B",
      leadSource: "telefon",
      purchaseTimeline: "1-3-ay",
      purpose: "oturum",
      ...data,
    };
    data.pipelineStatus = data.pipelineStatus || data.status;
    const locations = await api(
      "/locations?city=" +
        encodeURIComponent(state.session.company.city || "İstanbul"),
    );
    cBasic.find((spec) => spec[0] === "preferredDistricts")[2] =
      "checks:" + locations.districts.join("|");
    specs = [...cBasic, ...cDetails, ...cConsent];
    html =
      group(cBasic, data) +
      section("Talep ayrıntıları ve notlar", cDetails, data) +
      section(
        "İzin kayıtları",
        cConsent,
        data,
        "Yalnızca gerçekten alınmış izinleri işaretleyin. Varsayılan olarak işaretlenmez.",
      );
  }
  if (kind === "task") {
    data = {
      type: "arama",
      assignedToUserId: state.session.user.id,
      ...seed,
      ...data,
    };
    if (data.dueDate)
      data.dueDate = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
        .format(new Date(data.dueDate))
        .replace(" ", "T");
    specs = [
      ["title", "Görev başlığı", "text", true],
      [
        "type",
        "Görev türü",
        ["arama", "ziyaret", "toplanti", "sozlesme", "yapilacak"],
      ],
      ["dueDate", "Tarih ve saat (İstanbul)", "datetime-local", true],
      [
        "assignedToUserId",
        "Sorumlu",
        state.members
          .filter((m) => manager() || m.userId === state.session.user.id)
          .map((m) => [m.userId, m.fullName]),
      ],
      [
        "relatedCustomerId",
        "İlgili müşteri",
        [["", "Müşteri seçin"], ...state.customers.map((c) => [c.id, c.name])],
      ],
      [
        "relatedPropertyId",
        "İlgili portföy",
        [
          ["", "Portföy seçin"],
          ...state.properties
            .filter((p) => !p.isArchived)
            .map((p) => [p.id, p.title]),
        ],
      ],
      ["notes", "Görev notları", "textarea"],
    ];
    html = group(specs, data);
  }
  if (kind === "company") {
    data = state.session.company;
    specs = [
      ["name", "Şirket adı", "text", true],
      ["city", "Şehir"],
      ["phone", "Telefon", "tel"],
      ["taxNumber", "Vergi numarası"],
      ["address", "Adres", "textarea"],
    ];
    html = group(specs, data);
  }
  if (kind === "department") {
    data = { color: "#2864e8", ...data };
    specs = [
      ["name", "Departman adı", "text", true],
      [
        "leaderUserId",
        "Departman sorumlusu",
        [
          ["", "Sorumlu seçin"],
          ...state.members.map((m) => [m.userId, m.fullName]),
        ],
      ],
      ["description", "Açıklama", "textarea"],
    ];
    html =
      group(specs, data) +
      '<details class="form-section" open><summary>Ekip üyeleri</summary><div class="panel-body">' +
      state.members
        .map(
          (m) =>
            '<label class="check-label"><input type="checkbox" name="assignedUserIds" value="' +
            esc(m.userId) +
            '"' +
            (data.assignedUserIds?.includes(m.userId) ? " checked" : "") +
            ">" +
            esc(m.fullName) +
            "</label>",
        )
        .join("") +
      "</div></details>";
  }
  if (["property", "customer"].includes(kind) && manager()) {
    const assignment = [
      [
        "assignedToUserId",
        kind === "property" ? "Portföy ata" : "Müşteri ata",
        [
          ["", "Kendime ata"],
          ...state.members
            .filter((m) => m.role === "agent")
            .map((m) => [
              m.userId,
              m.fullName + " · " + (m.departmentName || "Departman yok"),
            ]),
        ],
      ],
    ];
    specs.push(...assignment);
    html += group(assignment, data);
  }
  if (kind === "department") {
    const criteria = [
      [
        "types",
        "Ürünler",
        "checks:daire|villa|mustakil|residans|arsa|isyeri|dukkan",
      ],
      ["statuses", "İşlem türleri", "checks:satilik|kiralik"],
      ["rooms", "Oda seçenekleri", "checks:1+0|1+1|2+1|3+1|4+1|5+1|6+1|7+1"],
    ];
    const locations = await api(
      "/locations?city=" +
        encodeURIComponent(state.session.company.city || "İstanbul"),
    );
    criteria.push([
      "districts",
      "Çalışma bölgeleri",
      "checks:" + locations.districts.join("|"),
    ]);
    html += section(
      "Departmanın çalışma kriterleri",
      criteria,
      data.customCriteria || {},
    );
    specs.push(...criteria);
  }
  formDialog(
    (id || kind === "company" ? "" : "Yeni ") +
      kinds[kind][0].toLocaleLowerCase("tr-TR") +
      (id || kind === "company" ? " düzenle" : ""),
    html,
    async (formData, values) => {
      if (kind === "property") {
        if (
          values.getAll("keep-images").length +
            values.getAll("upload-images").filter((f) => f.size).length >
          15
        )
          throw new Error("En fazla 15 fotoğraf seçin.");
        for (const [key, mediaKind] of [
          ["images", "image"],
          ["videos", "video"],
          ["documents", "document"],
        ]) {
          formData[key] = values.getAll("keep-" + key);
          for (const file of values
            .getAll("upload-" + key)
            .filter((f) => f.size)) {
            if (file.size > 50 * 1024 * 1024)
              throw new Error("Dosya en fazla 50 MB olabilir.");
            const response = await fetch("/api/media?kind=" + mediaKind, {
              method: "POST",
              headers: {
                "Content-Type": "application/octet-stream",
                "X-CRM-Request": "1",
              },
              body: file,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            formData[key].push(result.url);
          }
        }
      }
      if (kind === "property")
        formData.buildingAge =
          formData.buildingAge === "" ? null : Number(formData.buildingAge);
      if (
        ["property", "customer"].includes(kind) &&
        formData.assignedToUserId === ""
      )
        delete formData.assignedToUserId;
      if (kind === "department") {
        formData.customCriteria = {
          ...(data.customCriteria || {}),
          types: formData.types,
          statuses: formData.statuses,
          rooms: formData.rooms,
          districts: formData.districts,
        };
        delete formData.types;
        delete formData.statuses;
        delete formData.rooms;
        delete formData.districts;
      }
      if (kind === "customer") formData.maxBudget = formData.totalBudget;
      if (kind === "task") {
        formData.dueDate = new Date(
          formData.dueDate + ":00+03:00",
        ).toISOString();
        formData.relatedPropertyId = formData.relatedPropertyId || null;
        formData.relatedCustomerId = formData.relatedCustomerId || null;
      }
      if (kind === "department")
        formData.assignedUserIds = [
          ...document.querySelectorAll(
            '#record-form [name="assignedUserIds"]:checked',
          ),
        ].map((el) => el.value);
      await api(kinds[kind][1] + (id ? "/" + encodeURIComponent(id) : ""), {
        method: id || kind === "company" ? "PUT" : "POST",
        body: formData,
      });
      if (kind === "company") state.session = await api("/auth/me");
    },
    specs,
  );
}
export async function submitRecord(form) {
  if (!activeForm) return false;
  const { save, specs } = activeForm;
  const values = new FormData(form);
  const data = {};
  for (const [name, , type = "text"] of specs) {
    const raw = values.get(name);
    data[name] =
      typeof type === "string" && type.startsWith("checks:")
        ? values.getAll(name)
        : type === "checkbox"
          ? values.has(name)
          : type === "number"
            ? raw === ""
              ? null
              : Number(raw)
            : type === "list"
              ? String(raw || "")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean)
              : type === "lines"
                ? String(raw || "")
                    .split("\n")
                    .map((x) => x.trim())
                    .filter(Boolean)
                : (raw ?? "");
  }
  await save(data, values);
  return true;
}
export async function propertyDetail(id) {
  const p = await api("/properties/" + encodeURIComponent(id));
  const own = p.companyId === state.session.company.id;
  const editable = canEdit(p);
  const rent = Number(p.estimatedRent || 0),
    price = Number(p.price || 0);
  const attachments =
    (p.videos || [])
      .map(
        (url) =>
          '<video controls preload="metadata" class="detail-video" src="' +
          esc(url) +
          '"></video>',
      )
      .join("") +
    (p.documents || [])
      .map(
        (url) =>
          '<p><a href="' +
          esc(url) +
          '" target="_blank" rel="noopener">Portföy dosyasını indir</a></p>',
      )
      .join("");
  showDialog(
    p.title,
    '<div class="dialog-body">' +
      (p.images || [])
        .slice(1)
        .filter(safeImage)
        .map(
          (url) =>
            '<img class="detail-photo" src="' +
            esc(url) +
            '" alt="Portföy fotoğrafı" loading="lazy">',
        )
        .join("") +
      (safeImage(p.images?.[0])
        ? '<img class="detail-photo" src="' +
          esc(p.images[0]) +
          '" alt="' +
          esc(p.title) +
          '" referrerpolicy="no-referrer">'
        : "") +
      '<div class="task-meta">' +
      statusBadge(p.status) +
      badge(p.portfolioCode || "Portföy") +
      (p.shareStatus !== "private" ? badge("Ortak ağda", "green") : "") +
      '</div><div class="detail-price">' +
      money(p.price, p.currency) +
      '</div><dl class="info-grid">' +
      [
        [
          "Konum",
          [p.neighborhood, p.district, p.city].filter(Boolean).join(", "),
        ],
        ["Tür / Oda", label(p.type) + " · " + (p.rooms || "—")],
        [
          "Net / Brüt alan",
          (p.netArea || "—") + " / " + (p.grossArea || "—") + " m²",
        ],
        ["Bina yaşı / Kat", (p.buildingAge ?? "—") + " / " + (p.floor ?? "—")],
        ["Ekleyen danışman", p.createdByName || p.ownerCompanyName],
        [
          "Sorumlu danışman",
          state.members.find(
            (m) => m.userId === (p.assignedToUserId || p.createdById),
          )?.fullName,
        ],
        ["Eklenme tarihi", date(p.createdAt)],
        ["Düzenlenme tarihi", date(p.updatedAt)],
        [
          "Özellikler",
          [
            p.hasParking ? "Otopark" : "",
            p.hasElevator ? "Asansör" : "",
            p.hasBalcony ? "Balkon" : "",
            p.isSite ? "Site içinde" : "",
            ...(p.features || []),
          ]
            .filter(Boolean)
            .join(", "),
        ],
        ["Tahmini kira", money(p.estimatedRent, p.currency)],
        ["Aidat", money(p.monthlyDues, p.currency)],
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
      "</dl>" +
      (p.description
        ? '<p class="detail-copy">' + esc(p.description) + "</p>"
        : "") +
      (rent > 0 && price > 0
        ? '<div class="notice">Tahmini yıllık brüt kira getirisi: %' +
          (((rent * 12) / price) * 100).toFixed(1) +
          " · Basit amortisman: " +
          (price / rent / 12).toFixed(1) +
          " yıl. Masraf ve vergiler dahil değildir.</div>"
        : "") +
      (own
        ? '<details class="form-section"><summary>Mülk sahibi ve özel notlar</summary><div class="panel-body"><p>' +
          esc(p.contactName || "İsim eklenmemiş") +
          " · " +
          esc(p.contactPhone || "Telefon eklenmemiş") +
          '</p><p class="detail-copy">' +
          esc(p.address || "") +
          "\n" +
          esc(p.notes || "Not eklenmemiş") +
          "</p></div></details>"
        : '<div class="notice">İlanı paylaşan ofis: ' +
          esc(p.ownerCompanyName || "—") +
          " · " +
          esc(p.ownerCompanyPhone || "Telefon eklenmemiş") +
          "</div>") +
      attachments +
      '<div class="detail-actions">' +
      btn("Müşteri eşleştir", "match-property", p.id, "", "match") +
      (own
        ? btn("Görüşme planla", "task-property", p.id, "", "calendar")
        : "") +
      (editable
        ? btn("Düzenle", "edit-property", p.id, "primary", "edit") +
          iconBtn(
            "star",
            p.isFavorite ? "Favoriden çıkar" : "Favoriye ekle",
            "favorite-property",
            p.id,
            p.isFavorite,
          ) +
          btn(
            p.isArchived ? "Arşivden çıkar" : "Arşivle",
            "archive-property",
            p.id,
            "",
            "archive",
          ) +
          btn("Sil", "delete-property", p.id, "danger", "trash")
        : "") +
      (manager() && own && !p.isArchived
        ? btn(
            p.shareStatus === "private"
              ? "Ortak ağda paylaş"
              : "Paylaşımı kapat",
            p.shareStatus === "private" ? "share-property" : "unshare-property",
            p.id,
            "",
            "network",
          )
        : "") +
      "</div></div>",
  );
}
export async function customerDetail(id) {
  const c = await api("/customers/" + encodeURIComponent(id));
  const own = c.companyId === state.session.company.id;
  showDialog(
    c.name,
    '<div class="dialog-body"><div class="task-meta">' +
      statusBadge(c.pipelineStatus || c.status) +
      badge("Öncelik " + (c.customerClass || "B")) +
      '</div><div class="detail-price">' +
      money(c.totalBudget) +
      ' <span class="small muted">üst bütçe</span></div><dl class="info-grid">' +
      [
        ["Telefon", c.phone],
        ["Bölgeler", (c.preferredDistricts || []).join(", ")],
        ["Oda tercihleri", (c.preferredRooms || []).join(", ")],
        ["Alım amacı", label(c.purpose)],
        ["Alım zamanı", c.purchaseTimeline],
        ["En az alan", (c.minNetArea || "—") + " m²"],
        ["Peşinat", money(c.downPayment)],
      ]
        .map(
          ([k, v]) =>
            '<div class="info-row"><dt>' +
            k +
            "</dt><dd>" +
            esc(v || "Belirtilmedi / gizli") +
            "</dd></div>",
        )
        .join("") +
      '</dl><p class="detail-copy">' +
      esc(c.notes || "") +
      "</p>" +
      (!own
        ? '<div class="notice">Talebi paylaşan ofis: ' +
          esc(c.ownerCompany?.name || "—") +
          " · " +
          esc(c.ownerCompany?.phone || "") +
          "</div>"
        : '<div class="notice">Veri işleme onayı: ' +
          (c.kvkkConsent ? "Kayıtlı" : "Kayıtlı değil") +
          " · İletişim izni: " +
          (c.contactPermission ? "Kayıtlı" : "Kayıtlı değil") +
          "</div>") +
      '<div class="detail-actions">' +
      btn("Portföy eşleştir", "match-customer", c.id, "", "match") +
      (own
        ? btn("Görüşme planla", "task-customer", c.id, "", "calendar")
        : "") +
      (canEdit(c)
        ? btn("Düzenle", "edit-customer", c.id, "primary", "edit") +
          btn("Sil", "delete-customer", c.id, "danger", "trash")
        : "") +
      (manager() && own
        ? btn(
            c.shareStatus === "private" ? "Talebi paylaş" : "Paylaşımı kapat",
            c.shareStatus === "private" ? "share-customer" : "unshare-customer",
            c.id,
            "",
            "network",
          )
        : "") +
      "</div></div>",
  );
}
export function quickAdd() {
  showDialog(
    "Yeni kayıt",
    '<div class="dialog-body"><div class="stack">' +
      [
        ["home", "Portföy ekle", "new-property"],
        ["users", "Müşteri ekle", "new-customer"],
        ["calendar", "Görev ekle", "new-task"],
      ]
        .map(([i, t, a]) => btn(t, a, "", "", i))
        .join("") +
      "</div></div>",
    "Ne üzerinde çalışmak istersiniz?",
  );
}
export function passwordForm() {
  const specs = [
    ["currentPassword", "Mevcut parola", "password", true],
    ["newPassword", "Yeni parola", "password", true],
    ["confirmPassword", "Yeni parola tekrar", "password", true],
  ];
  formDialog(
    "Parolanızı değiştirin",
    '<div class="notice">Yeni parola en az 12 karakter olmalı. İşlemden sonra diğer cihazlardaki oturumlar kapanır.</div>' +
      group(specs, {}),
    async (data) => {
      if (data.newPassword !== data.confirmPassword)
        throw new Error("Yeni parolalar eşleşmiyor.");
      if (data.newPassword.length < 12)
        throw new Error("En az 12 karakter kullanın.");
      await api("/auth/change-password", {
        method: "POST",
        body: {
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        },
      });
      state.session = await api("/auth/me");
    },
    specs,
  );
}
export function inviteForm() {
  const specs = [
    ["email", "Davet edilecek e-posta", "email", true],
    [
      "role",
      "Ekip rolü",
      [
        ["agent", "Danışman · Kendi kayıtlarını düzenler"],
        ["admin", "Yönetici · Tüm şirket kayıtlarını yönetir"],
      ],
    ],
  ];
  formDialog(
    "Ekip üyesi davet et",
    group(specs, { role: "agent" }),
    async (data) => {
      const result = await api("/companies/invitations", {
        method: "POST",
        body: data,
      });
      const inviteUrl = location.origin + result.inviteLink;
      showDialog(
        "Davet bağlantısı hazır",
        '<div class="dialog-body"><div class="notice">Bağlantıyı yalnızca ' +
          esc(data.email) +
          ' ile paylaşın. 7 gün boyunca geçerlidir ve bir kez kullanılabilir.</div><label class="form-field">Davet bağlantısı<input class="control" id="invite-link" readonly value="' +
          esc(inviteUrl) +
          '"></label><div class="detail-actions">' +
          btn("Bağlantıyı kopyala", "copy-invite", "", "primary", "copy") +
          "</div></div>",
        "Bağlantı e-posta ile otomatik gönderilmez.",
      );
      return "keep";
    },
    specs,
    "Davet bağlantısını oluşturduktan sonra ekip üyenizle paylaşın.",
    "Bağlantıyı oluştur",
  );
}
export function shareForm(kind, id) {
  const customer = kind === "customer";
  const specs = customer
    ? [["legalBasisNote", "Paylaşımın dayanağı ve izin notu", "textarea", true]]
    : [
        [
          "commissionSplit",
          "Komisyon paylaşımı",
          [
            ["50-50", "%50 / %50"],
            ["60-40", "%60 / %40"],
            ["40-60", "%40 / %60"],
          ],
        ],
      ];
  formDialog(
    customer ? "Müşteri talebini paylaş" : "Portföyü ortak ağda paylaş",
    '<div class="notice">' +
      (customer
        ? "Yalnızca talep kriterleri paylaşılır. Ad maskelenir; telefon, e-posta ve özel notlar gizlenir. Kaydedilmiş veri işleme onayı gereklidir."
        : "Portföy diğer ofislere açılır. Mülk sahibi adı, telefonu, açık adres ve özel notlar paylaşılmaz.") +
      "</div>" +
      group(specs, {}),
    async (data) =>
      api(
        "/" +
          (customer ? "customers" : "properties") +
          "/" +
          encodeURIComponent(id) +
          "/share",
        {
          method: "POST",
          body: { ...data, action: "share", targetType: "all_members" },
        },
      ),
    specs,
    "Paylaşımı daha sonra kayıt detayından kapatabilirsiniz.",
    "Paylaşımı aç",
  );
}
export function restoreForm() {
  formDialog(
    "Şirket yedeğini geri yükle",
    '<div class="notice warning">Seçilen yedek bu ofisin portföy, müşteri ve ajanda kayıtlarının yerini alır. İşlemden önce mevcut verilerin otomatik kopyası sunucuda saklanır. Ortak ağ paylaşımları kapatılır.</div><label class="form-field">Yedek dosyası<input type="file" class="control" name="backupFile" accept=".json,application/json" required></label><div class="detail-actions"><label class="check-label"><input type="checkbox" name="confirmed" required>Mevcut kayıtların değişeceğini anlıyorum.</label></div>',
    async (_, values) => {
      const file = values.get("backupFile");
      if (!file?.size) throw new Error("Bir yedek dosyası seçin.");
      if (file.size > 1.8 * 1024 * 1024)
        throw new Error("Yedek dosyası en fazla 1,8 MB olabilir.");
      let backup;
      try {
        backup = JSON.parse(await file.text());
      } catch {
        throw new Error("Dosya geçerli bir JSON yedeği değil.");
      }
      const source = backup.data || backup;
      for (const key of ["properties", "customers", "followUps"])
        if (!Array.isArray(source[key]))
          throw new Error(
            "Yedekte portföy, müşteri ve ajanda listeleri bulunmalı.",
          );
      if (backup.companyId && backup.companyId !== state.session.company.id)
        throw new Error("Bu yedek başka bir şirkete ait.");
      await api("/restore", { method: "POST", body: { data: source } });
    },
    [],
    "Bu işlem yalnızca şirket sahibi tarafından yapılabilir.",
    "Yedeği geri yükle",
  );
}
export function isActiveForm() {
  return activeForm !== null;
}

if (typeof document !== "undefined")
  document.addEventListener("change", async (event) => {
    const key = event.target.id;
    if (!["field-city", "field-district"].includes(key)) return;
    const form = document.getElementById("record-form");
    if (
      !form?.elements.city ||
      !form.elements.district ||
      !form.elements.neighborhood
    )
      return;
    const city = form.elements.city.value;
    const district = key === "field-city" ? "" : form.elements.district.value;
    try {
      const data = await api(
        "/locations?city=" +
          encodeURIComponent(city) +
          "&district=" +
          encodeURIComponent(district),
      );
      if (
        !form.isConnected ||
        form.elements.city.value !== city ||
        (key === "field-district" && form.elements.district.value !== district)
      )
        return;
      if (key === "field-city")
        form.elements.district.innerHTML = options(
          data.districts,
          "",
          "İlçe seçin",
        );
      form.elements.neighborhood.innerHTML = options(
        data.neighborhoods,
        "",
        "Mahalle seçin",
      );
    } catch (error) {
      toast(error.message, true);
    }
  });
