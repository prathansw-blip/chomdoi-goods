// main.js — App entry + Router
import "./styles/index.css";
import {
  initStore,
  getSettings,
  getActiveShift,
  subscribe,
} from "./data/store.js";
import { formatTime, getCurrentShiftDef, formatHour } from "./utils/utils.js";
import { getCurrentUser, isAdmin, logout } from "./utils/auth.js";
import { renderLogin } from "./pages/login.js";

import { renderPOS, destroyPOS } from "./pages/pos.js";
import { renderStock, destroyStock } from "./pages/stock.js";
import { renderRestock, destroyRestock } from "./pages/restock.js";
import { renderShift, destroyShift } from "./pages/shift.js";
import { renderHotelSupply, destroyHotelSupply } from "./pages/hotelSupply.js";
import { renderSettings, destroySettings } from "./pages/settings.js";
import { NavIcons } from "./utils/icons.js";

const allTabs = [
  {
    id: "pos",
    icon: NavIcons.pos,
    label: "ขาย",
    render: renderPOS,
    destroy: destroyPOS,
    adminOnly: false,
  },
  {
    id: "stock",
    icon: NavIcons.stock,
    label: "Stock",
    render: renderStock,
    destroy: destroyStock,
    adminOnly: true,
  },
  {
    id: "restock",
    icon: NavIcons.restock,
    label: "เติมของ",
    render: renderRestock,
    destroy: destroyRestock,
    adminOnly: false,
  },
  {
    id: "shift",
    icon: NavIcons.shift,
    label: "สรุปกะ",
    render: renderShift,
    destroy: destroyShift,
    adminOnly: false,
  },
  {
    id: "hotel",
    icon: NavIcons.hotel,
    label: "ของใช้",
    render: renderHotelSupply,
    destroy: destroyHotelSupply,
    adminOnly: false,
  },
  {
    id: "settings",
    icon: NavIcons.settings,
    label: "ตั้งค่า",
    render: renderSettings,
    destroy: destroySettings,
    adminOnly: true,
  },
];

let activeTab = "pos";

// ─── Apply Theme & Favicon ───
export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme || "dark-gold");
}

export function updateAppFavicon(logoUrl) {
  let fav = document.getElementById("app-favicon");
  if (fav) {
    fav.remove();
  }
  fav = document.createElement("link");
  fav.id = "app-favicon";
  fav.rel = "icon";
  if (logoUrl) {
    fav.href = logoUrl;
    if (logoUrl.startsWith("data:image/png")) fav.type = "image/png";
    else if (logoUrl.startsWith("data:image/jpeg") || logoUrl.startsWith("data:image/jpg")) fav.type = "image/jpeg";
    else if (logoUrl.startsWith("data:image/svg")) fav.type = "image/svg+xml";
  } else {
    fav.type = "image/svg+xml";
    fav.href =
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏨</text></svg>";
  }
  document.head.appendChild(fav);
}

// ─── Modal observer: toggle body class to prevent flicker ───
const modalObserver = new MutationObserver(() => {
  const hasModal = document.querySelector(".modal-overlay");
  document.body.classList.toggle("modal-open", !!hasModal);
});
modalObserver.observe(document.body, { childList: true, subtree: true });

async function boot() {
  await initStore();

  // Apply saved theme & favicon immediately
  const s = getSettings();
  applyTheme(s.theme || "dark-gold");
  updateAppFavicon(s.companyLogo);

  const user = getCurrentUser();
  if (!user) {
    renderLogin(onLoginSuccess);
  } else {
    renderApp();
  }
  subscribe(() => {
    const newSettings = getSettings();
    // ถ้ามี modal เปิดอยู่ ไม่ต้อง re-render header เพราะจะทำให้หน้ากระพริบ
    if (!document.querySelector(".modal-overlay")) {
      updateHeader();
    }
    // Re-apply theme & favicon when settings change
    applyTheme(newSettings.theme || "dark-gold");
    updateAppFavicon(newSettings.companyLogo);

    // ถ้าอยู่หน้า login → re-render เพื่อให้ logo/ชื่อ update ตาม Firestore
    const loginPage = document.querySelector(".login-page");
    if (loginPage) {
      const titleEl = loginPage.querySelector(".login-title");
      const logoContainer = loginPage.querySelector(".login-logo");
      if (
        titleEl &&
        titleEl.textContent !== (newSettings.companyName || "Chomdoi Goods")
      ) {
        titleEl.textContent = newSettings.companyName || "Chomdoi Goods";
      }
      if (logoContainer && newSettings.companyLogo) {
        const currentImg = logoContainer.querySelector("img");
        if (!currentImg || currentImg.src !== newSettings.companyLogo) {
          logoContainer.innerHTML = `<img src="${newSettings.companyLogo}" alt="logo" class="login-logo-img">`;
        }
      }
    }
  });
}

async function onLoginSuccess(user) {
  // Now that we are authenticated, re-initialize the store to get fresh data from Firebase
  await initStore();
  renderApp();
}

function getTabs() {
  return isAdmin() ? allTabs : allTabs.filter((t) => !t.adminOnly);
}

function renderApp() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <header class="app-header" id="app-header"></header>
    <nav class="tab-nav" id="tab-nav"></nav>
    <main class="page-content fade-in" id="page-content"></main>
  `;
  updateHeader();
  renderNav();
  // If current tab is settings but user is not admin, redirect to pos
  const tabs = getTabs();
  if (!tabs.find((t) => t.id === activeTab)) activeTab = "pos";
  navigateTo(activeTab);
}

function updateHeader() {
  const header = document.getElementById("app-header");
  if (!header) return;
  const s = getSettings();
  const shift = getActiveShift();
  const shiftDefs = s.shiftDefinitions || [];
  const currentDef = getCurrentShiftDef(shiftDefs);
  const user = getCurrentUser();
  const initials = user
    ? user.displayName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  const newHTML = `
    <div class="header-brand">
      ${
        s.companyLogo
          ? `<img class="header-logo" src="${s.companyLogo}" alt="logo">`
          : `<div class="header-logo-placeholder">🏨</div>`
      }
      <span class="header-company">${s.companyName || "Chomdoi Goods"}</span>
    </div>
    <div class="header-shift">
      ${
        shift
          ? `<span class="dot"></span> ${shift.icon || ""} ${shift.name} — เริ่ม ${formatTime(shift.startTime)}`
          : `${currentDef ? `${currentDef.icon} ${currentDef.name} (${formatHour(currentDef.startHour)}-${formatHour(currentDef.endHour)})` : ""} · ยังไม่เปิดกะ`
      }
    </div>
    <div class="header-actions">
      <div class="header-user">
        <div class="header-user-avatar">${initials}</div>
        <span>${user?.displayName || "Guest"}</span>
        ${user?.role === "admin" ? '<span style="font-size:0.7rem;color:var(--gold)">⭐Admin</span>' : ""}
      </div>
      <button class="btn-logout" id="btn-logout">🚪 ออก</button>
    </div>
  `;

  // Only replace DOM if content actually changed — prevents hover/transition flicker
  if (
    header.innerHTML.replace(/\s+/g, " ").trim() !==
    newHTML.replace(/\s+/g, " ").trim()
  ) {
    header.innerHTML = newHTML;
    document.getElementById("btn-logout")?.addEventListener("click", doLogout);
  }
}

function doLogout() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:360px;text-align:center">
      <div class="modal-title">🚪 ออกจากระบบ</div>
      <p style="color:var(--text-muted);margin-bottom:1.5rem">ต้องการออกจากระบบ?</p>
      <div class="modal-actions" style="justify-content:center">
        <button class="btn btn-outline" id="lo-cancel">ยกเลิก</button>
        <button class="btn btn-danger" id="lo-confirm">🚪 ออกจากระบบ</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("#lo-cancel").onclick = () => overlay.remove();
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  overlay.querySelector("#lo-confirm").onclick = () => {
    logout();
    overlay.remove();
    const app = document.getElementById("app");
    app.innerHTML = "";
    renderLogin(onLoginSuccess);
  };
}

function renderNav() {
  const tabs = getTabs();
  const s = getSettings();
  const customLabels = s.tabLabels || {};
  const nav = document.getElementById("tab-nav");
  if (!nav) return;
  const newHTML = tabs
    .map(
      (t) =>
        `<button class="tab-btn ${t.id === activeTab ? "active" : ""}" data-tab="${t.id}">
      <span class="tab-icon">${t.icon}</span>
      <span>${customLabels[t.id] || t.label}</span>
    </button>`,
    )
    .join("");

  // Only replace DOM if content actually changed — prevents hover flicker
  if (
    nav.innerHTML.replace(/\s+/g, " ").trim() !==
    newHTML.replace(/\s+/g, " ").trim()
  ) {
    nav.innerHTML = newHTML;
    nav.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.onclick = () => navigateTo(btn.dataset.tab);
    });
  }
}

function navigateTo(tabId) {
  const current = allTabs.find((t) => t.id === activeTab);
  if (current?.destroy) current.destroy();
  activeTab = tabId;
  renderNav();
  const content = document.getElementById("page-content");
  content.innerHTML = "";
  content.className = "page-content fade-in";
  const tab = allTabs.find((t) => t.id === tabId);
  if (tab?.render) tab.render(content);
}

boot();
