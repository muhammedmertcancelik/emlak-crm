import {
  staffForm,
  saleForm,
  networkKeyForm,
  networkConnectForm,
} from "./office.js";
import { distributionForm, rulesForm, paymentForm } from "./accounting.js";
import { state, esc, icon, btn, api, loadData, toast, empty } from "./core.js";
import { pages, shell, renderers, authView } from "./views.js";
import {
  receiptForm,
  expenseForm,
  voidExpense,
  correctSale,
} from "./broker.js";
import {
  closeDialog,
  showDialog,
  openForm,
  submitRecord,
  propertyDetail,
  customerDetail,
  quickAdd,
  passwordForm,
  inviteForm,
  shareForm,
  restoreForm,
  isActiveForm,
} from "./forms.js";
const root = document.getElementById("root");
let renderVersion = 0,
  authMode = "login",
  inviteInfo = null,
  inviteToken =
    new URLSearchParams(location.search).get("inviteToken") ||
    new URLSearchParams(location.search).get("invite"),
  searchTimer;
function auth(mode = "login") {
  authMode = mode;
  root.innerHTML = authView(mode, inviteInfo);
  document.title = "Payidar CRM · Giriş";
}
async function render() {
  if (!state.session) return;
  const version = ++renderVersion;
  const main = document.getElementById("main");
  if (!main) return;
  const focus = document.activeElement?.id;
  const position = document.activeElement?.selectionStart;
  main.setAttribute("aria-busy", "true");
  try {
    const markup = await (renderers[state.page] || renderers.dashboard)();
    if (version !== renderVersion || !state.session) return;
    main.innerHTML = markup;
    document.title = pages[state.page][0] + " · Payidar CRM";
    document.querySelectorAll(".nav-link").forEach((a) => {
      const active = a.hash === "#" + state.page;
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (focus === "list-search") {
      const input = document.getElementById(focus);
      input?.focus();
      if (input?.setSelectionRange) input.setSelectionRange(position, position);
    }
  } catch (error) {
    if (version !== renderVersion || !state.session) return;
    main.innerHTML = empty(
      "Ekran yüklenemedi",
      error.message,
      btn("Tekrar dene", "retry", "", "primary", "refresh"),
    );
  } finally {
    main.removeAttribute("aria-busy");
  }
}
async function refresh() {
  await loadData();
  if (!state.session) return;
  root.innerHTML = shell();
  await render();
}
function navigate(page) {
  document.getElementById("dialog").close();
  document.querySelector(".shell")?.classList.remove("nav-open");
  if (state.page === page) {
    render();
    return;
  }
  location.hash = page;
}
async function enter() {
  state.session = await api("/auth/me");
  state.page = pages[location.hash.slice(1)]
    ? location.hash.slice(1)
    : "dashboard";
  if (state.session.user.mustChangePassword) {
    state.page = "settings";
    root.innerHTML = shell();
    await render();
    passwordForm();
    return;
  }
  await refresh();
}
async function downloadBackup() {
  const result = await api("/backup");
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download =
    "payidar-yedek-" + new Date().toISOString().slice(0, 10) + ".json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Şirket yedeği indirildi.");
}
async function mutate(
  path,
  method = "POST",
  body = {},
  message = "İşlem tamamlandı.",
) {
  await api(path, { method, body });
  closeDialog();
  await refresh();
  toast(message);
}
const actions = {
  receipt: receiptForm,
  "new-expense": expenseForm,
  "void-expense": voidExpense,
  "correct-sale": correctSale,
  "cancel-sale": (id) => correctSale(id, true),
  "audit-page": (page) => {
    state.filters.auditPage = Number(page);
    return render();
  },
  "list-page": (page) => {
    state.filters.page = Number(page);
    return render();
  },
  "read-task": (id) =>
    mutate(
      "/followups/" + encodeURIComponent(id) + "/read",
      "POST",
      {},
      "Okundu olarak işaretlendi.",
    ),
  "network-key": networkKeyForm,
  "network-connect": networkConnectForm,
  "network-revoke": (id) => mutate("/network/revoke", "POST", { id }),
  "new-staff": staffForm,
  "new-sale": saleForm,
  "commission-detail": distributionForm,
  "distribution-rules": rulesForm,
  "distribution-paid": (id) => paymentForm(id),
  "distribution-undo": (id) => paymentForm(id, true),
  "close-dialog": () => closeDialog(),
  menu: () => document.querySelector(".shell")?.classList.toggle("nav-open"),
  navigate: (id) => {
    closeDialog();
    navigate(id);
  },
  "auth-login": () => auth("login"),
  "auth-register": () => auth("register"),
  "toggle-password": () => {
    const el = document.getElementById("auth-password");
    el.type = el.type === "password" ? "text" : "password";
  },
  logout: async () => {
    await api("/auth/logout", { method: "POST", body: {} });
    state.session = null;
    state.dataLoaded = false;
    state.properties = [];
    state.customers = [];
    state.tasks = [];
    state.members = [];
    state.departments = [];
    state.filters = {};
    closeDialog();
    auth();
  },
  "quick-add": () => quickAdd(),
  "new-property": () => openForm("property"),
  "new-customer": () => openForm("customer"),
  "new-task": () => openForm("task"),
  "edit-property": (id) => openForm("property", id),
  "edit-customer": (id) => openForm("customer", id),
  "new-department": () => openForm("department"),
  "edit-department": (id) => openForm("department", id),
  "edit-company": () => openForm("company"),
  "property-detail": (id) => propertyDetail(id),
  "customer-detail": (id) => customerDetail(id),
  "task-property": (id) => openForm("task", "", { relatedPropertyId: id }),
  "edit-task": (id) => openForm("task", id),
  "task-customer": (id) => openForm("task", "", { relatedCustomerId: id }),
  "match-customer": (id) => {
    state.matchMode = "customer";
    state.matchId = id;
    navigate("matching");
  },
  "match-property": (id) => {
    state.matchMode = "property";
    state.matchId = id;
    navigate("matching");
  },
  "match-mode": (id) => {
    state.matchMode = id;
    state.matchId = null;
    return render();
  },
  "match-select": (id) => {
    state.matchId = id;
    return render();
  },
  "filter-status": (id) => {
    state.filters.status = id;
    return render();
  },
  "filter-day": (id) => {
    state.filters.day = state.filters.day === id ? "" : id;
    return render();
  },
  "clear-filters": () => {
    state.filters = {};
    return render();
  },
  "pool-kind": (id) => {
    state.poolKind = id;
    return render();
  },
  "pool-scope": (id) => {
    state.filters.scope = id;
    return render();
  },
  "company-tab": (id) => {
    state.companyTab = id;
    return render();
  },
  "team-select": (id) => {
    state.teamMemberId = id;
    state.teamRecords = "selected";
    return render();
  },
  "team-records": (id) => {
    state.teamRecords = id === "all" ? "all" : "selected";
    return render();
  },
  "complete-task": (id) =>
    mutate(
      "/followups/" + encodeURIComponent(id) + "/complete",
      "POST",
      {},
      "Görev güncellendi.",
    ),
  "delete-task": (id) => {
    if (confirm("Bu görevi kalıcı olarak silmek istiyor musunuz?"))
      return mutate(
        "/followups/" + encodeURIComponent(id),
        "DELETE",
        {},
        "Görev silindi.",
      );
  },
  "delete-property": (id) => {
    if (
      confirm(
        "Bu portföyü kalıcı olarak silmek istiyor musunuz? Arşivlemek isterseniz iptal edip Arşivle işlemini kullanın.",
      )
    )
      return mutate(
        "/properties/" + encodeURIComponent(id),
        "DELETE",
        {},
        "Portföy silindi.",
      );
  },
  "delete-customer": (id) => {
    if (
      confirm(
        "Bu müşteriyi ve kayıtlı talep bilgilerini kalıcı olarak silmek istiyor musunuz?",
      )
    )
      return mutate(
        "/customers/" + encodeURIComponent(id),
        "DELETE",
        {},
        "Müşteri silindi.",
      );
  },
  "delete-advisor": (id) => {
    if (
      confirm(
        "Danışmanı ekipten silmek istiyor musunuz? Danışmanın bu şirkete erişimi kapanır. Portföyleri, müşterileri ve görevleri size devredilir.",
      )
    )
      return mutate(
        "/staff/" + encodeURIComponent(id),
        "DELETE",
        undefined,
        "Danışman silindi.",
      );
  },
  "delete-department": (id) => {
    if (confirm("Departmanı silmek istiyor musunuz? Ekip üyeleri silinmez."))
      return mutate(
        "/departments/" + encodeURIComponent(id),
        "DELETE",
        {},
        "Departman silindi.",
      );
  },
  "favorite-property": (id) =>
    mutate("/properties/" + encodeURIComponent(id) + "/toggle-favorite"),
  "archive-property": (id) =>
    mutate(
      "/properties/" + encodeURIComponent(id) + "/toggle-archive",
      "POST",
      {},
      "Portföyün arşiv durumu güncellendi.",
    ),
  "share-property": (id) => shareForm("property", id),
  "share-customer": (id) => shareForm("customer", id),
  "unshare-property": (id) =>
    mutate(
      "/properties/" + encodeURIComponent(id) + "/share",
      "POST",
      { action: "revoke" },
      "Portföy paylaşımı kapatıldı.",
    ),
  "unshare-customer": (id) =>
    mutate(
      "/customers/" + encodeURIComponent(id) + "/share",
      "POST",
      { action: "revoke" },
      "Müşteri paylaşımı kapatıldı.",
    ),
  invite: () => inviteForm(),
  "revoke-invite": (id) => {
    if (confirm("Bu davet bağlantısını iptal etmek istiyor musunuz?"))
      return mutate(
        "/companies/invitations/" + encodeURIComponent(id),
        "DELETE",
        {},
        "Davet iptal edildi.",
      );
  },
  "copy-invite": async () => {
    const input = document.getElementById("invite-link");
    try {
      await navigator.clipboard.writeText(input.value);
      toast("Davet bağlantısı kopyalandı.");
    } catch {
      input.select();
      toast("Bağlantıyı kopyalamak için Ctrl+C tuşlarına basın.");
    }
  },
  password: () => passwordForm(),
  backup: () => downloadBackup(),
  restore: () => restoreForm(),
  retry: () => refresh(),
};
document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target || target.disabled) return;
  const action = actions[target.dataset.action];
  if (!action) return;
  event.preventDefault();
  target.disabled = true;
  try {
    await action(target.dataset.id, target);
  } catch (error) {
    toast(error.message, true);
  } finally {
    if (target.isConnected) target.disabled = false;
  }
});
document.addEventListener("submit", async (event) => {
  const form = event.target;
  event.preventDefault();
  if (form.id === "global-search-form") {
    state.filters = { q: form.elements.q.value.trim() };
    navigate("search");
    return;
  }
  const submit = form.querySelector('[type="submit"]');
  if (!submit || submit.disabled) return;
  const errorNode = form.querySelector(".form-error");
  submit.disabled = true;
  if (errorNode) errorNode.textContent = "";
  try {
    if (form.id === "auth-form") {
      const data = Object.fromEntries(new FormData(form));
      if (authMode === "register")
        await api("/auth/register", { method: "POST", body: data });
      else if (authMode === "invite") {
        await api("/auth/accept-invitation", {
          method: "POST",
          body: { ...data, token: inviteToken },
        });
        inviteToken = null;
        history.replaceState(null, "", location.pathname);
      } else await api("/auth/login", { method: "POST", body: data });
      await enter();
    }
    if (form.id === "record-form") {
      await submitRecord(form);
      if (isActiveForm()) closeDialog();
      await refresh();
      toast("Kayıt başarıyla kaydedildi.");
    }
  } catch (error) {
    if (errorNode?.isConnected) {
      errorNode.textContent = error.message;
      errorNode.scrollIntoView({ block: "nearest" });
    } else toast(error.message, true);
  } finally {
    if (submit.isConnected) submit.disabled = false;
  }
});
document.addEventListener("change", async (event) => {
  const el = event.target;
  try {
    if (el.id === "company-switch") {
      el.disabled = true;
      await api("/auth/switch-company", {
        method: "POST",
        body: { targetCompanyId: el.value },
      });
      state.filters = {};
      state.matchId = null;
      await enter();
      toast("Çalışma alanı değiştirildi.");
    } else if (el.dataset.memberDept) {
      await api(
        "/companies/members/" +
          encodeURIComponent(el.dataset.memberDept) +
          "/department",
        { method: "PUT", body: { departmentId: el.value || null } },
      );
      await refresh();
      toast("Departman güncellendi.");
    } else if (el.dataset.recordAssign) {
      el.disabled = true;
      const path =
        el.dataset.recordAssign === "property" ? "properties" : "customers";
      await api("/" + path + "/" + encodeURIComponent(el.dataset.id), {
        method: "PUT",
        body: { assignedToUserId: el.value },
      });
      await refresh();
      toast("Kayıt sorumlusu güncellendi.");
    } else if (el.dataset.filter && el.id !== "list-search") {
      state.filters.page = 1;
      state.filters.auditPage = 1;
      state.filters[el.dataset.filter] =
        el.type === "checkbox" ? el.checked : el.value;
      state.filters.advanced =
        document.getElementById("advanced-filters")?.open;
      await render();
    }
  } catch (error) {
    toast(error.message, true);
    if (el.dataset.recordAssign) await render();
  } finally {
    el.disabled = false;
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id !== "list-search") return;
  state.filters.q = event.target.value;
  state.filters.page = 1;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(render, 250);
});
window.addEventListener("hashchange", () => {
  if (!state.session) return;
  const page = location.hash.slice(1);
  if (!pages[page]) return;
  if (page !== state.page && page !== "search") state.filters = {};
  state.page = page;
  document.querySelector(".shell")?.classList.remove("nav-open");
  render();
  window.scrollTo(0, 0);
});
window.addEventListener("session-expired", () => {
  renderVersion++;
  document.getElementById("dialog").close();
  auth();
  toast("Oturumunuz sona erdi. Lütfen tekrar giriş yapın.", true);
});
setInterval(async () => {
  if (!state.session || document.hidden) return;
  const session = state.session;
  try {
    const tasks = await api("/followups?onlyMine=true");
    if (state.session !== session) return;
    const known = new Set(state.tasks.map((task) => task.id));
    const fresh = tasks.filter((task) => !known.has(task.id) && !task.readAt);
    const ownIds = new Set(tasks.map((task) => task.id));
    state.tasks = [
      ...state.tasks.filter(
        (task) =>
          task.assignedToUserId !== session.user.id && !ownIds.has(task.id),
      ),
      ...tasks,
    ];
    if (fresh.length) toast(fresh.length + " yeni görev atandı.");
    const link = document.querySelector('a[href="#inbox"]');
    if (link) {
      const unread = tasks.filter((task) => !task.readAt).length;
      link.setAttribute("title", unread + " okunmamış görev");
      const badge = link.querySelector(".nav-count");
      if (badge) badge.textContent = unread;
    }
    if (state.page === "inbox" && !document.getElementById("dialog").open)
      await render();
  } catch {}
}, 30000);
document.addEventListener("keydown", (event) => {
  if (
    event.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(
      document.activeElement?.tagName,
    ) &&
    !document.getElementById("dialog").open
  ) {
    event.preventDefault();
    document.getElementById("global-search")?.focus();
  }
  if (event.key === "Escape")
    document.querySelector(".shell")?.classList.remove("nav-open");
});
window.addEventListener("offline", () =>
  toast(
    "İnternet bağlantısı kesildi. Kaydetmeden önce bağlantınızı kontrol edin.",
    true,
  ),
);
window.addEventListener("online", () => toast("Bağlantı yeniden kuruldu."));
let checkingAppVersion = false;
async function refreshIfUpdated() {
  if (
    checkingAppVersion ||
    isActiveForm() ||
    document.getElementById("dialog")?.open
  )
    return;
  checkingAppVersion = true;
  try {
    const currentScript = document.querySelector(
      'script[type="module"][src^="/js/app.js"]',
    );
    const currentVersion = new URL(
      currentScript?.src || "",
      location.href,
    ).searchParams.get("v");
    if (!currentVersion) return;
    const response = await fetch("/?check=" + Date.now(), {
      cache: "no-store",
    });
    if (!response.ok) return;
    const latestVersion = (await response.text()).match(
      /\/js\/app\.js\?v=([^"&]+)/,
    )?.[1];
    if (
      latestVersion &&
      latestVersion !== currentVersion &&
      !isActiveForm() &&
      !document.getElementById("dialog")?.open
    )
      location.reload();
  } catch {
    // An offline or interrupted check should not affect the current page.
  } finally {
    checkingAppVersion = false;
  }
}
window.addEventListener("focus", refreshIfUpdated);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshIfUpdated();
});
async function boot() {
  try {
    localStorage.removeItem("emlak_crm_token");
    localStorage.removeItem("emlak_crm_active_comp_id");
  } catch {}
  if ("serviceWorker" in navigator)
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  if (inviteToken) {
    try {
      inviteInfo = await api(
        "/auth/invitation-info?token=" + encodeURIComponent(inviteToken),
      );
      auth("invite");
    } catch (error) {
      auth();
      toast(error.message, true);
    }
    return;
  }
  try {
    state.session = await api("/auth/me");
    await enter();
  } catch (error) {
    if (error.status === 401) auth();
    else
      root.innerHTML =
        '<div class="boot">' +
        empty(
          "Sunucuya ulaşılamadı",
          error.message,
          btn("Tekrar dene", "reload", "", "primary"),
        ) +
        "</div>";
  }
}
actions.reload = () => location.reload();
boot();
