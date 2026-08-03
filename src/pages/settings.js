// settings.js — หน้าตั้งค่า
import {
  getSettings,
  updateSettings,
  subscribe,
  getUsers,
  addUser,
  updateUser,
  deleteUser,
} from "../data/store.js";
import { showToast, formatHour } from "../utils/utils.js";
import { testConnection } from "../utils/lineNotify.js";
import {
  exportData,
  clearAllData,
  initFirebase,
  loadData,
  FIREBASE_CONFIG,
} from "../data/db.js";
import { initStore } from "../data/store.js";
import { hashPassword } from "../utils/auth.js";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme || "dark-gold");
}

let unsub = null;

// ═══ Icon Picker Data ═══
const iconGroups = [
  {
    label: "🧃 เครื่องดื่ม",
    icons: [
      "💧",
      "🧃",
      "🧉",
      "🧋",
      "☕",
      "🍵",
      "🧂",
      "🍼",
      "🥛",
      "🍺",
      "🥤",
      "🍹",
      "🧀",
      "🥃",
    ],
  },
  {
    label: "🍔 อาหาร",
    icons: [
      "🍚",
      "🍜",
      "🍝",
      "🍔",
      "🍕",
      "🌮",
      "🌯",
      "🍳",
      "🍲",
      "🥩",
      "🥚",
      "🥪",
      "🍣",
      "🍱",
      "🍞",
      "🥨",
      "🥙",
      "🥗",
    ],
  },
  {
    label: "🍪 ขนม & ของหวาน",
    icons: [
      "🍪",
      "🍫",
      "🍬",
      "🍭",
      "🍩",
      "🍰",
      "🎂",
      "🍦",
      "🍧",
      "🧁",
      "🥐",
      "🍿",
      "🥜",
      "🍟",
      "🥨",
    ],
  },
  {
    label: "🍎 ผัก & ผลไม้",
    icons: [
      "🍎",
      "🍊",
      "🍌",
      "🍓",
      "🍇",
      "🍉",
      "🍍",
      "🥝",
      "🍑",
      "🍒",
      "🥭",
      "🍋",
      "🍐",
      "🧭",
      "🥑",
    ],
  },
  {
    label: "🍺 แอลกอฮอล์",
    icons: ["🍺", "🍻", "🍷", "🍸", "🥃", "🍶", "🍹", "🥂"],
  },
  {
    label: "🧼 ของใช้ & อุปโภค",
    icons: [
      "🧼",
      "🧴",
      "🧹",
      "🧺",
      "🧷",
      "🧶",
      "🧳",
      "🧰",
      "🛡️",
      "🧤",
      "👚",
      "👕",
      "👖",
      "🩴",
      "💼",
      "🎒",
      "🧲",
      "☂️",
      "💡",
      "🔋",
      "📱",
      "💻",
    ],
  },
  {
    label: "💊 สุขภาพ & ความงาม",
    icons: [
      "💊",
      "🩹",
      "🏭",
      "🧴",
      "🧵",
      "🦋",
      "🌻",
      "🌺",
      "🌹",
      "🌾",
      "✨",
      "🌟",
    ],
  },
  {
    label: "📦 ทั่วไป & อื่นๆ",
    icons: [
      "📦",
      "🏷️",
      "🛒",
      "💰",
      "💎",
      "🏆",
      "🎮",
      "📚",
      "✍️",
      "📷",
      "🎵",
      "🎨",
      "🏖️",
      "⚽",
      "🏀",
      "🎯",
      "🚗",
      "✈️",
      "🛕",
      "🏨",
      "🏠",
      "🔑",
    ],
  },
];

function showIconPicker(currentIcon, onSelect) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px;max-height:80vh;overflow-y:auto">
      <div class="modal-title">🎨 เลือก Icon</div>
      ${iconGroups
        .map(
          (group) => `
        <div style="margin-bottom:1rem">
          <div style="font-size:0.85rem;font-weight:600;color:var(--text-muted);margin-bottom:0.5rem">${group.label}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${group.icons
              .map(
                (ic) => `
              <button class="icon-pick-btn ${ic === currentIcon ? "selected" : ""}" data-icon="${ic}"
                style="width:42px;height:42px;font-size:1.4rem;border-radius:var(--radius-sm);border:2px solid ${ic === currentIcon ? "var(--gold)" : "var(--border)"};background:${ic === currentIcon ? "rgba(245,158,11,0.15)" : "var(--bg-input)"};cursor:pointer;display:flex;align-items:center;justify-content:center;transition:var(--transition)">${ic}</button>
            `,
              )
              .join("")}
          </div>
        </div>
      `,
        )
        .join("")}
      <div class="modal-actions" style="margin-top:1rem;position:sticky;bottom:0;background:var(--bg-card);padding:0.75rem 0 0">
        <button class="btn btn-outline" id="iconpick-cancel">ยกเลิก</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Hover effect
  overlay.querySelectorAll(".icon-pick-btn").forEach((btn) => {
    btn.onmouseenter = () => {
      if (!btn.classList.contains("selected"))
        btn.style.borderColor = "var(--gold)";
    };
    btn.onmouseleave = () => {
      if (!btn.classList.contains("selected"))
        btn.style.borderColor = "var(--border)";
    };
    btn.onclick = () => {
      onSelect(btn.dataset.icon);
      overlay.remove();
    };
  });
  overlay.querySelector("#iconpick-cancel").onclick = () => overlay.remove();
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
}

export function renderSettings(container) {
  if (unsub) unsub();
  draw(container);
  unsub = subscribe(() => {
    if (!document.querySelector(".modal-overlay")) draw(container);
  });
}

function draw(container) {
  const s = getSettings();
  const lineEnabled = s.line?.enabled || false;
  const fbConfigured = s.firebase?.configured || false;

  container.innerHTML = `
    <!-- Company Info -->
    <div class="settings-section">
      <div class="settings-section-title">🏢 ข้อมูลบริษัท</div>
      <div style="display:flex;gap:1.25rem;align-items:start;flex-wrap:wrap">
        <div>
          <div class="logo-preview" id="logo-preview">
            ${s.companyLogo ? `<img src="${s.companyLogo}" alt="logo">` : "🏨"}
          </div>
          <input type="file" id="logo-input" accept="image/*" hidden>
          <button class="btn btn-outline" style="font-size:0.8rem" id="btn-upload-logo">📷 อัพโหลด Logo</button>
          ${s.companyLogo ? `<button class="btn btn-outline" style="font-size:0.8rem;margin-left:0.5rem;color:var(--red)" id="btn-remove-logo">✕</button>` : ""}
        </div>
        <div style="flex:1;min-width:250px">
          <div class="form-group"><label class="form-label">ชื่อบริษัท / ร้าน</label><input class="form-input" id="s-company" value="${s.companyName || ""}"></div>
        </div>
      </div>
    </div>

    <!-- Firebase -->
    <div class="settings-section">
      <div class="settings-section-title">🔥 Firebase (ฐานข้อมูลออนไลน์)</div>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem">เชื่อมต่อ Firebase Firestore เพื่อเข้าถึงข้อมูลจากทุกที่ผ่านเว็บ</p>
      <div class="connection-status ${fbConfigured ? "status-connected" : "status-disconnected"}">
        ${fbConfigured ? "🟢 เชื่อมต่อ Firebase แล้ว" : "⚪ ยังไม่ได้เชื่อมต่อ (ใช้ localStorage)"}
      </div>
      <div class="form-group" style="margin-top:1rem"><label class="form-label">API Key</label><input class="form-input" id="s-fb-apikey" value="${s.firebase?.apiKey || ""}" placeholder="AIza..."></div>
      <div class="form-group"><label class="form-label">Auth Domain</label><input class="form-input" id="s-fb-domain" value="${s.firebase?.authDomain || ""}" placeholder="xxx.firebaseapp.com"></div>
      <div class="form-group"><label class="form-label">Project ID</label><input class="form-input" id="s-fb-project" value="${s.firebase?.projectId || ""}" placeholder="my-project-id"></div>
    </div>

    <!-- LINE Bot -->
    <div class="settings-section">
      <div class="settings-section-title">💬 เชื่อมต่อ LINE Bot</div>
      <div class="form-group"><label class="form-label">Channel Access Token</label><input class="form-input" id="s-line-token" value="${s.line?.channelAccessToken || ""}" placeholder="Long-lived token"></div>
      <div class="form-group"><label class="form-label">User ID / Group ID</label><input class="form-input" id="s-line-target" value="${s.line?.targetId || ""}" placeholder="U... หรือ C..."></div>
      <label class="checkbox-label" style="margin-top:0.5rem">
        <input type="checkbox" id="s-line-enabled" ${lineEnabled ? "checked" : ""}>
        เปิดใช้งาน LINE Bot
      </label>
      ${
        lineEnabled
          ? `
        <div class="checkbox-group" style="margin-top:0.75rem;padding-left:1.5rem">
          <label class="checkbox-label"><input type="checkbox" id="s-line-shift" ${s.line?.notifications?.onShiftClose !== false ? "checked" : ""}> ส่งสรุปเมื่อปิดกะ</label>
          <label class="checkbox-label"><input type="checkbox" id="s-line-daily" ${s.line?.notifications?.dailySummary !== false ? "checked" : ""}> สรุปยอดประจำวัน</label>
          <label class="checkbox-label"><input type="checkbox" id="s-line-stock" ${s.line?.notifications?.lowStockAlert !== false ? "checked" : ""}> แจ้งเตือน stock ต่ำ</label>
          <label class="checkbox-label"><input type="checkbox" id="s-line-sale" ${s.line?.notifications?.onSale ? "checked" : ""}> แจ้งเตือนทุกครั้งที่ขายสินค้า</label>
        </div>
        <button class="btn btn-outline" id="btn-test-line" style="margin-top:0.75rem">📤 ทดสอบส่งข้อความ</button>
      `
          : ""
      }
      <div class="connection-status ${lineEnabled && s.line?.channelAccessToken ? "status-connected" : "status-disconnected"}" style="margin-top:0.75rem">
        ${lineEnabled && s.line?.channelAccessToken ? "🟢 LINE Bot เปิดใช้งาน" : "⚪ ยังไม่ได้เปิดใช้งาน"}
      </div>
    </div>

    <!-- Shift Definitions -->
    <div class="settings-section">
      <div class="settings-section-title">⏰ โครงสร้างกะ</div>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem">1 วันทำงานจบที่ 08:00 (เช่น เวลา 02:00 ของวันที่ 27 = วันทำงานของวันที่ 26)</p>
      ${(s.shiftDefinitions || [])
        .map(
          (def, i) => `
        <div style="display:grid;grid-template-columns:60px 1fr 100px 100px;gap:0.75rem;align-items:end;margin-bottom:0.75rem;padding:0.75rem;border:1px solid var(--border);border-radius:var(--radius-sm)">
          <div class="form-group" style="margin-bottom:0"><label class="form-label">Icon</label><input class="form-input" id="s-shift-icon-${i}" value="${def.icon || "⏰"}" maxlength="4" style="text-align:center"></div>
          <div class="form-group" style="margin-bottom:0"><label class="form-label">ชื่อกะ</label><input class="form-input" id="s-shift-name-${i}" value="${def.name}"></div>
          <div class="form-group" style="margin-bottom:0"><label class="form-label">เริ่ม</label>
            <select class="form-select" id="s-shift-start-${i}">
              ${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${def.startHour === h ? "selected" : ""}>${formatHour(h)}</option>`).join("")}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0"><label class="form-label">สิ้นสุด</label>
            <select class="form-select" id="s-shift-end-${i}">
              ${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${def.endHour === h ? "selected" : ""}>${formatHour(h)}</option>`).join("")}
            </select>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>

    <!-- Category Management -->
    <div class="settings-section">
      <div class="settings-section-title">🏷️ หมวดสินค้า</div>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem">เพิ่ม, ลบ, แก้ไขหมวดสินค้าที่แสดงในหน้าขายและสต็อก</p>
      <div id="cat-list">
        ${(s.categories || [])
          .map(
            (cat, i) => `
          <div style="display:grid;grid-template-columns:52px 1fr 40px;gap:0.75rem;align-items:end;margin-bottom:0.5rem;padding:0.6rem 0.75rem;border:1px solid var(--border);border-radius:var(--radius-sm)">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">Icon</label>
              <button class="btn btn-outline btn-pick-cat-icon" data-idx="${i}" style="width:100%;height:36px;font-size:1.3rem;padding:0;display:flex;align-items:center;justify-content:center" title="กดเพื่อเลือก Icon">${cat.icon || "📦"}</button>
              <input type="hidden" class="s-cat-icon" data-idx="${i}" value="${cat.icon || "📦"}">
            </div>
            <div class="form-group" style="margin-bottom:0"><label class="form-label">ชื่อหมวด</label><input class="form-input s-cat-name" data-idx="${i}" value="${cat.name}"></div>
            <button class="btn btn-outline btn-remove-cat" data-idx="${i}" style="padding:0.4rem;font-size:0.8rem;color:var(--red);height:36px" title="ลบหมวด">✕</button>
          </div>
        `,
          )
          .join("")}
      </div>
      <button class="btn btn-outline" id="btn-add-cat" style="margin-top:0.5rem">➕ เพิ่มหมวดสินค้า</button>
    </div>

    <!-- Theme Picker -->
    <div class="settings-section">
      <div class="settings-section-title">🎨 ธีม / สีระบบ</div>
      <div class="theme-picker">
        ${[
          {
            id: "dark-gold",
            label: "🌑 Dark Gold",
            colors: ["#0a0e1a", "#1a2236", "#f59e0b"],
          },
          {
            id: "dark-blue",
            label: "🌊 Dark Blue",
            colors: ["#060d1f", "#112240", "#3b82f6"],
          },
          {
            id: "dark-green",
            label: "🌿 Dark Green",
            colors: ["#061210", "#122e29", "#10b981"],
          },
          {
            id: "dark-purple",
            label: "🌸 Dark Purple",
            colors: ["#0c0a1f", "#1e1545", "#8b5cf6"],
          },
          {
            id: "light",
            label: "☀️ Light",
            colors: ["#f8fafc", "#ffffff", "#f59e0b"],
          },
        ]
          .map(
            (t) => `
          <button class="theme-btn ${s.theme === t.id ? "active" : ""}" data-theme-id="${t.id}">
            <div class="theme-swatch">
              ${t.colors.map((c) => `<span style="background:${c}"></span>`).join("")}
            </div>
            ${t.label}
          </button>
        `,
          )
          .join("")}
      </div>
    </div>

    <!-- User Management -->
    <div class="settings-section">
      <div class="settings-section-title">👥 จัดการผู้ใช้งาน</div>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem">เพิ่ม / ลบ / แก้ไข ผู้ใช้ — User ทั่วไปไม่เห็นหน้าตั้งค่า</p>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>ชื่อ</th><th>Username</th><th>Password</th><th>บทบาท</th><th>สถานะ</th><th style="width:100px"></th></tr></thead>
          <tbody>
            ${getUsers()
              .map(
                (u) => {
                  const pwVal = u.plainPassword || u.password || (u.id === "user_admin" ? "admin1234" : "");
                  return `
              <tr>
                <td>${u.displayName}</td>
                <td style="color:var(--text-muted);font-size:0.85rem">${u.username}</td>
                <td>
                  <div style="display:inline-flex;align-items:center;gap:0.35rem">
                    <span class="user-pw-text" data-uid="${u.id}" data-pw="${pwVal}" style="font-family:monospace;font-size:0.85rem;color:var(--text-muted)">••••••••</span>
                    <button class="btn btn-outline btn-toggle-show-pw" data-uid="${u.id}" style="padding:0.15rem 0.45rem;font-size:0.75rem;line-height:1" title="ดู/ซ่อน Password">👁️</button>
                  </div>
                </td>
                <td><span class="user-role-badge ${u.role === "admin" ? "user-role-admin" : "user-role-user"}">${u.role === "admin" ? "⭐ Admin" : "👤 User"}</span></td>
                <td><span style="color:${u.active !== false ? "var(--emerald)" : "var(--red)"}">${u.active !== false ? "✅ ใช้งาน" : "⛔ ปิดใช้"}</span></td>
                <td style="display:flex;gap:0.4rem">
                  <button class="btn btn-outline btn-edit-user" data-uid="${u.id}" style="padding:0.3rem 0.6rem;font-size:0.8rem">✏️</button>
                  ${u.id !== "user_admin" ? `<button class="btn btn-outline btn-del-user" data-uid="${u.id}" style="padding:0.3rem 0.6rem;font-size:0.8rem;color:var(--red)">✕</button>` : ""}
                </td>
              </tr>
            `;
                },
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <button class="btn btn-outline" id="btn-add-user" style="margin-top:0.75rem">➕ เพิ่มผู้ใช้</button>
    </div>

    <!-- Tab Labels -->
    <div class="settings-section">
      <div class="settings-section-title">🏷️ ชื่อเมนู</div>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem">แก้ไขชื่อเมนูที่แสดงในแถบนำทาง</p>
      <div style="display:grid;grid-template-columns:60px 1fr;gap:0.5rem 0.75rem;align-items:center">
        ${[
          { id: "pos", icon: "🛒", def: "ขาย" },
          { id: "stock", icon: "📦", def: "Stock" },
          { id: "restock", icon: "➕", def: "เติมของ" },
          { id: "shift", icon: "📊", def: "สรุปกะ" },
          { id: "hotel", icon: "🏨", def: "ของใช้" },
          { id: "settings", icon: "⚙️", def: "ตั้งค่า" },
        ]
          .map(
            (t) => `
          <div style="text-align:center;font-size:1.2rem">${t.icon}</div>
          <input class="form-input s-tab-label" data-tab-id="${t.id}" value="${(s.tabLabels || {})[t.id] || t.def}" placeholder="${t.def}" style="padding:0.4rem 0.6rem">
        `,
          )
          .join("")}
      </div>
    </div>

    <!-- General -->
    <div class="settings-section">
      <div class="settings-section-title">💰 ทั่วไป</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
        <div class="form-group"><label class="form-label">สกุลเงิน</label>
          <select class="form-select" id="s-currency">
            <option value="฿" ${s.currency === "฿" ? "selected" : ""}>฿ บาท</option>
            <option value="$" ${s.currency === "$" ? "selected" : ""}>$ Dollar</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">จุดเตือน stock ต่ำ</label><input class="form-input" id="s-threshold" type="number" min="1" value="${s.lowStockThreshold || 5}"></div>
      </div>
    </div>

    <!-- Data -->
    <div class="settings-section">
      <div class="settings-section-title">🗑️ จัดการข้อมูล</div>
      <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
        <button class="btn btn-outline" id="btn-export">📤 Export ข้อมูล</button>
        <button class="btn btn-danger" id="btn-reset">🔄 Reset ข้อมูลทั้งหมด</button>
      </div>
    </div>

    <button class="btn btn-primary btn-lg btn-block" id="btn-save-settings" style="margin-top:0.5rem">💾 บันทึกการตั้งค่า</button>
  `;

  // ─── Events ───
  // Category icon picker
  container.querySelectorAll(".btn-pick-cat-icon").forEach((btn) => {
    btn.onclick = () => {
      const idx = btn.dataset.idx;
      const hiddenInput = container.querySelector(
        `.s-cat-icon[data-idx="${idx}"]`,
      );
      const currentIcon = hiddenInput?.value || "📦";
      showIconPicker(currentIcon, (selectedIcon) => {
        btn.textContent = selectedIcon;
        if (hiddenInput) hiddenInput.value = selectedIcon;
      });
    };
  });

  // Category add
  document.getElementById("btn-add-cat").onclick = () => {
    // First show icon picker, then add
    showIconPicker("📦", (selectedIcon) => {
      const cats = s.categories || [];
      const newId = "cat_" + Date.now();
      cats.push({ id: newId, name: "หมวดใหม่", icon: selectedIcon });
      updateSettings({ categories: cats });
      showToast("เพิ่มหมวดแล้ว", "success");
    });
  };
  container.querySelectorAll(".btn-remove-cat").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const idx = +btn.dataset.idx;
      const cats = [...(s.categories || [])];
      const removed = cats[idx];
      if (cats.length <= 1) {
        showToast("ต้องมีอย่างน้อย 1 หมวด", "warning");
        return;
      }
      // show confirm modal
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal" style="max-width:400px">
          <div class="modal-title">🗑️ ลบหมวด</div>
          <p style="margin:1rem 0;text-align:center">ลบหมวด <strong>"${removed?.icon} ${removed?.name}"</strong> ?</p>
          <p style="text-align:center;font-size:0.85rem;color:var(--text-muted)">สินค้าในหมวดนี้จะไม่ถูกลบ แต่จะไม่มีหมวดแสดง</p>
          <div class="modal-actions" style="margin-top:1rem">
            <button class="btn btn-outline" id="catdel-cancel">ยกเลิก</button>
            <button class="btn btn-danger" id="catdel-confirm">🗑️ ลบ</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector("#catdel-cancel").onclick = () => overlay.remove();
      overlay.onclick = (ev) => {
        if (ev.target === overlay) overlay.remove();
      };
      overlay.querySelector("#catdel-confirm").onclick = () => {
        cats.splice(idx, 1);
        updateSettings({ categories: cats });
        showToast(`ลบหมวด "${removed?.name}" แล้ว`, "info");
        overlay.remove();
      };
    };
  });

  // Theme picker
  container.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.onclick = () => {
      const themeId = btn.dataset.themeId;
      updateSettings({ theme: themeId });
      applyTheme(themeId);
      showToast(`เปลี่ยน theme เป็น "${btn.textContent.trim()}"`, "success");
    };
  });

  // ── User Management Events ──
  const addUserBtn = document.getElementById("btn-add-user");
  if (addUserBtn) addUserBtn.onclick = () => showUserModal(container);
  container.querySelectorAll(".btn-edit-user").forEach((btn) => {
    btn.onclick = () => showUserModal(container, btn.dataset.uid);
  });
  container.querySelectorAll(".btn-toggle-show-pw").forEach((btn) => {
    btn.onclick = () => {
      const uid = btn.dataset.uid;
      const span = container.querySelector(`.user-pw-text[data-uid="${uid}"]`);
      if (!span) return;
      const isHidden = span.dataset.shown !== "true";
      if (isHidden) {
        const pw = span.dataset.pw;
        span.textContent = pw || "(ยังไม่ได้ตั้งใหม่)";
        span.style.color = pw ? "var(--gold)" : "var(--red)";
        span.dataset.shown = "true";
        btn.textContent = "🙈";
      } else {
        span.textContent = "••••••••";
        span.style.color = "var(--text-muted)";
        span.dataset.shown = "false";
        btn.textContent = "👁️";
      }
    };
  });
  container.querySelectorAll(".btn-del-user").forEach((btn) => {
    btn.onclick = () => {
      const uid = btn.dataset.uid;
      const users = getUsers();
      const user = users.find((u) => u.id === uid);
      if (!user) return;
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal" style="max-width:380px;text-align:center">
          <div class="modal-title">🗑️ ลบผู้ใช้</div>
          <p style="margin:1rem 0">ลบผู้ใช้ <strong>${user.displayName}</strong> (@${user.username})?</p>
          <div class="modal-actions" style="justify-content:center">
            <button class="btn btn-outline" id="udel-cancel">ยกเลิก</button>
            <button class="btn btn-danger" id="udel-confirm">🗑️ ลบ</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector("#udel-cancel").onclick = () => overlay.remove();
      overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
      };
      overlay.querySelector("#udel-confirm").onclick = () => {
        deleteUser(uid);
        showToast(`ลบผู้ใช้ ${user.displayName} แล้ว`, "info");
        overlay.remove();
      };
    };
  });

  // Logo upload
  const logoInput = document.getElementById("logo-input");
  document.getElementById("btn-upload-logo").onclick = () => logoInput.click();
  logoInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      showToast("ไฟล์ใหญ่เกินไป (สูงสุด 500KB)", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateSettings({ companyLogo: ev.target.result });
      showToast("อัพโหลด Logo สำเร็จ", "success");
      draw(container);
    };
    reader.readAsDataURL(file);
  };
  const removeBtn = document.getElementById("btn-remove-logo");
  if (removeBtn)
    removeBtn.onclick = () => {
      updateSettings({ companyLogo: null });
      draw(container);
    };

  // LINE enabled toggle
  const lineToggle = document.getElementById("s-line-enabled");
  if (lineToggle)
    lineToggle.onchange = () => {
      const lineSettings = { ...s.line, enabled: lineToggle.checked };
      updateSettings({ line: lineSettings });
      draw(container);
    };

  // Test LINE
  const testBtn = document.getElementById("btn-test-line");
  if (testBtn)
    testBtn.onclick = async () => {
      // Save first
      saveCurrentSettings(s);
      testBtn.disabled = true;
      testBtn.textContent = "⏳ กำลังส่ง...";
      const ok = await testConnection();
      showToast(
        ok ? "ส่งข้อความทดสอบสำเร็จ!" : "ส่งไม่สำเร็จ — ตรวจ Token/ID",
        ok ? "success" : "error",
      );
      testBtn.disabled = false;
      testBtn.textContent = "📤 ทดสอบส่งข้อความ";
    };

  // Export / Reset
  document.getElementById("btn-export").onclick = () => {
    exportData();
    showToast("Export สำเร็จ", "success");
  };
  document.getElementById("btn-reset").onclick = () => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" style="max-width:420px">
        <div class="modal-title">⚠️ Reset ข้อมูลทั้งหมด</div>
        <p style="margin:1rem 0;text-align:center;color:var(--text-muted)">ข้อมูลทั้งหมดจะถูกลบ!<br>รวมถึงสินค้า, ประวัติการขาย, กะ</p>
        <p style="text-align:center;font-weight:600;color:var(--red)">การกระทำนี้ไม่สามารถยกเลิกได้</p>
        <div class="modal-actions" style="margin-top:1.25rem">
          <button class="btn btn-outline" id="rst-cancel">ยกเลิก</button>
          <button class="btn btn-danger" id="rst-confirm">🗑️ ลบทั้งหมด</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#rst-cancel").onclick = () => overlay.remove();
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };
    overlay.querySelector("#rst-confirm").onclick = () => {
      clearAllData();
      location.reload();
    };
  };

  // Save all settings
  document.getElementById("btn-save-settings").onclick = async () => {
    saveCurrentSettings(s);

    // Init Firebase if config provided
    const projectId = document.getElementById("s-fb-project").value.trim();
    if (projectId) {
      try {
        initFirebase({
          apiKey: document.getElementById("s-fb-apikey").value.trim(),
          authDomain: document.getElementById("s-fb-domain").value.trim(),
          projectId,
        });
      } catch (e) {
        console.warn(e);
      }
    }

    showToast("บันทึกการตั้งค่าสำเร็จ", "success");
  };
}

function saveCurrentSettings(currentSettings) {
  // Collect shift definitions
  const shiftDefs = (currentSettings.shiftDefinitions || []).map((def, i) => ({
    ...def,
    icon: document.getElementById(`s-shift-icon-${i}`)?.value || def.icon,
    name: document.getElementById(`s-shift-name-${i}`)?.value || def.name,
    startHour: +(
      document.getElementById(`s-shift-start-${i}`)?.value ?? def.startHour
    ),
    endHour: +(
      document.getElementById(`s-shift-end-${i}`)?.value ?? def.endHour
    ),
  }));

  const updates = {
    companyName:
      document.getElementById("s-company").value.trim() || "Chomdoi Goods",
    currency: document.getElementById("s-currency").value,
    lowStockThreshold: +document.getElementById("s-threshold").value || 5,
    shiftDefinitions: shiftDefs,
    // Collect tab labels
    tabLabels: (() => {
      const labels = {};
      document.querySelectorAll(".s-tab-label").forEach((input) => {
        const id = input.dataset.tabId;
        const val = input.value.trim();
        if (val) labels[id] = val;
      });
      return labels;
    })(),
    // Collect categories from inputs
    categories: Array.from(document.querySelectorAll(".s-cat-name")).map(
      (input, i) => {
        const existingCat = (currentSettings.categories || [])[i];
        return {
          id: existingCat?.id || "cat_" + Date.now() + "_" + i,
          name: input.value.trim() || "หมวด",
          icon: document.querySelectorAll(".s-cat-icon")[i]?.value || "📦",
        };
      },
    ),
    line: {
      ...currentSettings.line,
      channelAccessToken:
        document.getElementById("s-line-token").value.trim() || null,
      targetId: document.getElementById("s-line-target").value.trim() || null,
      enabled: document.getElementById("s-line-enabled")?.checked || false,
      notifications: {
        onShiftClose: document.getElementById("s-line-shift")?.checked ?? true,
        dailySummary: document.getElementById("s-line-daily")?.checked ?? true,
        lowStockAlert: document.getElementById("s-line-stock")?.checked ?? true,
        onSale: document.getElementById("s-line-sale")?.checked ?? false,
      },
    },
    firebase: {
      apiKey: document.getElementById("s-fb-apikey").value.trim(),
      authDomain: document.getElementById("s-fb-domain").value.trim(),
      projectId: document.getElementById("s-fb-project").value.trim(),
      configured: !!document.getElementById("s-fb-project").value.trim(),
    },
  };
  updateSettings(updates);
}

export function destroySettings() {
  if (unsub) {
    unsub();
    unsub = null;
  }
}

// ─── User Modal (Add / Edit) ───
function showUserModal(container, editId = null) {
  const users = getUsers();
  const existing = editId ? users.find((u) => u.id === editId) : null;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const existingPw = existing?.plainPassword || existing?.password || (existing?.id === "user_admin" ? "admin1234" : "");
  overlay.innerHTML = `
    <div class="modal" style="max-width:440px">
      <div class="modal-title">${existing ? "✏️ แก้ไขผู้ใช้" : "➕ เพิ่มผู้ใช้ใหม่"}</div>
      <div class="form-group">
        <label class="form-label">ชื่อแสดง (Display Name)</label>
        <input class="form-input" id="um-name" value="${existing?.displayName || ""}" placeholder="เช่น สมชาย สุขใจ">
      </div>
      <div class="form-group">
        <label class="form-label">Username</label>
        <input class="form-input" id="um-username" value="${existing?.username || ""}" placeholder="เช่น somchai" ${existing?.id === "user_admin" ? "disabled" : ""}>
      </div>
      <div class="form-group">
        <label class="form-label">${existing ? "Password (เว้นว่างถ้าไม่เปลี่ยน)" : "Password"}</label>
        <div style="position:relative">
          <input class="form-input" id="um-password" type="password" value="${existingPw}" placeholder="${existing ? "เว้นว่างถ้าไม่เปลี่ยน" : "กำหนด password"}" style="padding-right:3rem">
          <button type="button" id="um-toggle-pw" style="position:absolute;right:0.75rem;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--text-muted)" title="ดู/ซ่อน Password">👁️</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">บทบาท</label>
        <select class="form-select" id="um-role" ${existing?.id === "user_admin" ? "disabled" : ""}>
          <option value="user" ${existing?.role === "user" ? "selected" : ""}>👤 User (เข้าได้ทุกหน้า ยกเว้น ตั้งค่า)</option>
          <option value="admin" ${existing?.role === "admin" ? "selected" : ""}>⭐ Admin (เข้าได้ทุกหน้า)</option>
        </select>
      </div>
      ${
        existing
          ? `
      <div class="form-group">
        <label class="form-label">สถานะ</label>
        <select class="form-select" id="um-active">
          <option value="true" ${existing.active !== false ? "selected" : ""}>✅ เปิดใช้งาน</option>
          <option value="false" ${existing.active === false ? "selected" : ""}>⛔ ปิดใช้งาน</option>
        </select>
      </div>`
          : ""
      }
      <div id="um-error" style="display:none;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-sm);padding:0.6rem;color:var(--red);font-size:0.85rem;margin-bottom:0.75rem"></div>
      <div class="modal-actions">
        <button class="btn btn-outline" id="um-cancel">ยกเลิก</button>
        <button class="btn btn-primary" id="um-save">💾 บันทึก</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const pwInput = overlay.querySelector("#um-password");
  const pwToggle = overlay.querySelector("#um-toggle-pw");
  if (pwToggle && pwInput) {
    pwToggle.onclick = () => {
      const isPw = pwInput.type === "password";
      pwInput.type = isPw ? "text" : "password";
      pwToggle.textContent = isPw ? "🙈" : "👁️";
    };
  }

  const showErr = (msg) => {
    const el = overlay.querySelector("#um-error");
    el.textContent = msg;
    el.style.display = "block";
  };

  overlay.querySelector("#um-cancel").onclick = () => overlay.remove();
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };

  overlay.querySelector("#um-save").onclick = async () => {
    const displayName = overlay.querySelector("#um-name").value.trim();
    const username = overlay
      .querySelector("#um-username")
      .value.trim()
      .toLowerCase();
    const password = overlay.querySelector("#um-password").value;
    const role = overlay.querySelector("#um-role").value;
    const activeVal = overlay.querySelector("#um-active")?.value;

    if (!displayName) return showErr("กรุณากรอกชื่อ");
    if (!existing && !username) return showErr("กรุณากรอก username");
    if (!existing && !password) return showErr("กรุณากรอก password");

    const saveBtn = overlay.querySelector("#um-save");
    saveBtn.disabled = true;
    saveBtn.textContent = "⏳ กำลังบันทึก...";

    try {
      // Check username duplicate
      if (username) {
        const dup = users.find(
          (u) =>
            u.username.toLowerCase() === username &&
            u.id !== (existing?.id || ""),
        );
        if (dup) throw new Error(`Username "${username}" มีอยู่แล้ว`);
      }

      if (existing) {
        const updates = { displayName, role, active: activeVal !== "false" };
        if (username && username !== existing.username.toLowerCase())
          updates.username = username;
        if (password) {
          updates.passwordHash = hashPassword(password);
          updates.plainPassword = password;
          updates.password = password;
        }
        updateUser(existing.id, updates);
        showToast(`อัปเดต ${displayName} สำเร็จ`, "success");
      } else {
        // Create new user in Firebase Auth using a secondary app instance to avoid signing out the current Admin
        const tempAppName = "temp_" + Date.now();
        const tempApp = initializeApp(FIREBASE_CONFIG, tempAppName);
        const tempAuth = getAuth(tempApp);

        const email = username + "@chomdoi.local";
        try {
          await createUserWithEmailAndPassword(tempAuth, email, password);
          await signOut(tempAuth);
        } catch (authErr) {
          // If email already exists in Firebase Auth (e.g. user was deleted and re-created), just skip
          if (authErr.code !== "auth/email-already-in-use") {
            throw authErr;
          }
        }

        addUser({
          id: "user_" + Date.now(),
          username,
          displayName,
          passwordHash: hashPassword(password),
          plainPassword: password,
          password: password,
          role,
          active: true,
          createdAt: new Date().toISOString(),
        });
        showToast(`เพิ่มผู้ใช้ ${displayName} สำเร็จ`, "success");
      }
      overlay.remove();
    } catch (err) {
      console.error(err);
      saveBtn.disabled = false;
      saveBtn.textContent = "💾 บันทึก";
      showErr(err.message || "เกิดข้อผิดพลาดในการสร้างผู้ใช้");
    }
  };
}
