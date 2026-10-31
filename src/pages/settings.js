// settings.js — หน้าตั้งค่า
import {
  getSettings,
  updateSettings,
  subscribe,
  getUsers,
  getSyncStatus,
  waitForSync,
} from "../data/store.js";
import { showToast, showWriteError, formatHour, escapeHtml } from "../utils/utils.js";
import { NavIcons } from "../utils/icons.js";
import { testConnection } from "../utils/lineNotify.js";
import { fetchLineQuota, sendTelegramMessage } from "../utils/notificationTransport.js";
import {
  exportData,
  loadData,
} from "../data/db.js";

function applyTheme(theme) {
  let activeTheme = theme || "graphite-gold";
  if (activeTheme === "dark-gold") activeTheme = "graphite-gold";
  if (activeTheme === "dark-blue") activeTheme = "slate-blue";
  if (
    activeTheme !== "graphite-gold" &&
    activeTheme !== "slate-blue" &&
    activeTheme !== "warm-stone"
  ) {
    activeTheme = "graphite-gold";
  }
  document.documentElement.setAttribute("data-theme", activeTheme);
}

let unsub = null;
let quotaCache = null;
let telegramTestPending = false;

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
    if (!document.querySelector(".modal-overlay") && !getSyncStatus().pending) draw(container);
  });
}

function draw(container) {
  const s = getSettings();
  const lineEnabled = s.line?.enabled === true;

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

    <div class="settings-section">
      <div class="settings-section-title">LINE Bot</div>
      <div class="form-group">
        <label class="form-label">Channel Access Token</label>
        <div style="position:relative">
          <input class="form-input" id="s-line-token" type="password" placeholder="Long-lived token" style="padding-right:2.8rem" autocomplete="off">
          <button type="button" id="btn-toggle-line-token" style="position:absolute;right:0.75rem;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--text-muted)">👁️</button>
        </div>
      </div>
      <div class="form-group"><label class="form-label">User ID / Group ID</label><input class="form-input" id="s-line-target" placeholder="U... หรือ C..."></div>
      <label class="checkbox-label" style="margin-top:0.5rem">
        <input type="checkbox" id="s-line-enabled" ${lineEnabled ? "checked" : ""}>
        เปิดใช้งาน LINE Bot
      </label>
      <div class="checkbox-group" id="line-notifications" style="margin-top:0.75rem;padding-left:1.5rem;${lineEnabled ? "" : "display:none"}">
        <label class="checkbox-label"><input type="checkbox" id="s-line-shift" ${s.line?.notifications?.onShiftClose !== false ? "checked" : ""}> ส่งรายงานเปิดกะและปิดกะ</label>
        <label class="checkbox-label"><input type="checkbox" id="s-line-daily" ${s.line?.notifications?.dailySummary !== false ? "checked" : ""}> สรุปยอดประจำวัน</label>
        <p style="font-size:0.85rem;color:var(--text-muted)">รายการสินค้าใกล้หมด / หมด จะแนบในรายงานเปิดกะและปิดกะ ไม่ส่งแจ้งเตือนแยก</p>
        <label class="checkbox-label"><input type="checkbox" id="s-line-sale" ${s.line?.notifications?.onSale ? "checked" : ""}> แจ้งเตือนทุกครั้งที่ขายสินค้า</label>
      </div>
      <button class="btn btn-outline" id="btn-test-line" style="margin-top:0.75rem;${lineEnabled ? "" : "display:none"}">📤 ทดสอบส่งข้อความ</button>
      <div style="margin-top:1rem;padding:1rem;border:1px solid var(--border);border-radius:var(--radius-sm)">
        <strong>โควต้า LINE คงเหลือเดือนนี้</strong>
        <p id="line-quota-status" role="status" aria-live="polite" style="margin:0.75rem 0;color:var(--text-secondary)">กรอก Token แล้วกดตรวจสอบโควต้า</p>
        <button class="btn btn-outline" id="btn-line-quota" type="button">ตรวจสอบโควต้า</button>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-top:0.5rem">ค่าประมาณของทั้งบัญชี รวมข้อความที่ส่งจาก LINE Official Account Manager ไม่ใช่ยอดเฉพาะเว็บนี้</p>
      </div>
      <div class="connection-status ${lineEnabled && s.line?.channelAccessToken ? "status-connected" : "status-disconnected"}" id="line-status" style="margin-top:0.75rem">
        ${lineEnabled && s.line?.channelAccessToken ? "🟢 LINE Bot เปิดใช้งาน" : "⚪ ยังไม่ได้เปิดใช้งาน"}
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Telegram Bot</div>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem">รับรายงานแยกจาก LINE หรือเปิดทั้งสองช่องทางได้</p>
      <div class="form-group">
        <label class="form-label" for="s-telegram-token">Bot Token</label>
        <div style="display:flex;gap:0.5rem">
          <input class="form-input" id="s-telegram-token" type="password" placeholder="Token จาก @BotFather" autocomplete="off">
          <button class="btn btn-outline" id="btn-toggle-telegram-token" type="button" aria-label="แสดงหรือซ่อน Telegram Bot Token">แสดง</button>
        </div>
      </div>
      <div class="form-group"><label class="form-label" for="s-telegram-chat">Chat ID / Channel username</label><input class="form-input" id="s-telegram-chat" placeholder="เช่น -100… หรือ @ชื่อช่อง"></div>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.75rem">แชตส่วนตัว: กด Start กับบอตก่อน · กลุ่ม: เพิ่มบอตเข้ากลุ่ม · ช่อง: ให้บอตมีสิทธิ์ส่งข้อความ</p>
      <label class="checkbox-label"><input type="checkbox" id="s-telegram-enabled" ${s.telegram?.enabled ? "checked" : ""}> เปิดใช้งาน Telegram Bot</label>
      <div class="checkbox-group" id="telegram-notifications" style="margin-top:0.75rem;padding-left:1.5rem;${s.telegram?.enabled ? "" : "display:none"}">
        <label class="checkbox-label"><input type="checkbox" id="s-telegram-shift" ${s.telegram?.notifications?.onShiftClose !== false ? "checked" : ""}> ส่งรายงานเปิดกะและปิดกะ</label>
        <label class="checkbox-label"><input type="checkbox" id="s-telegram-daily" ${s.telegram?.notifications?.dailySummary !== false ? "checked" : ""}> สรุปยอดประจำวัน</label>
        <p style="font-size:0.85rem;color:var(--text-muted)">รายการสินค้าใกล้หมด / หมด จะแนบในรายงานเปิดกะและปิดกะ ไม่ส่งแจ้งเตือนแยก</p>
        <label class="checkbox-label"><input type="checkbox" id="s-telegram-sale" ${s.telegram?.notifications?.onSale ? "checked" : ""}> แจ้งเตือนทุกครั้งที่ขายสินค้า</label>
      </div>
      <button class="btn btn-outline" id="btn-test-telegram" style="margin-top:0.75rem" ${telegramTestPending ? "disabled" : ""}>ทดสอบส่ง Telegram</button>
      <p id="telegram-status" role="status" aria-live="polite" style="margin-top:0.75rem;color:var(--text-secondary)">${telegramTestPending ? "กำลังบันทึกและส่งข้อความทดสอบ..." : s.telegram?.enabled ? "เปิดใช้งาน — กดทดสอบเพื่อยืนยันการส่ง" : "ยังไม่ได้เปิดใช้งาน"}</p>
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
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem">เลือกโทนสีของระบบที่เหมาะกับการใช้งานของคุณ</p>
      <div class="theme-picker">
        ${[
          {
            id: "graphite-gold",
            title: "Graphite Gold",
            subtitle: "Luxury Hotel Admin (Default)",
            colors: ["#0D1117", "#161D2B", "#D6A928"],
          },
          {
            id: "slate-blue",
            title: "Slate Blue",
            subtitle: "Modern SaaS Dashboard",
            colors: ["#0F172A", "#172033", "#3B82F6"],
          },
          {
            id: "warm-stone",
            title: "Warm Stone",
            subtitle: "Warm Minimal Hotel",
            colors: ["#181714", "#23211D", "#C9975B"],
          },
        ]
          .map((t) => {
            const currentTheme = s.theme || "graphite-gold";
            const isMatch =
              currentTheme === t.id ||
              (t.id === "graphite-gold" &&
                (currentTheme === "dark-gold" || !currentTheme)) ||
              (t.id === "slate-blue" && currentTheme === "dark-blue");
            return `
          <button class="theme-btn ${isMatch ? "active" : ""}" data-theme-id="${t.id}">
            <div class="theme-swatch">
              ${t.colors.map((c) => `<span style="background:${c}"></span>`).join("")}
            </div>
            <div class="theme-info">
              <span class="theme-title">${t.title}</span>
              <span class="theme-subtitle">${t.subtitle}</span>
            </div>
          </button>
        `;
          })
          .join("")}
      </div>
    </div>

    <!-- Staff directory (account provisioning is administrator controlled) -->
    <div class="settings-section">
      <div class="settings-section-title">👥 ผู้ใช้งานที่ได้รับสิทธิ์</div>
      <p>บัญชีและรหัสผ่านจัดการผ่าน Firebase Auth โดยผู้ดูแลระบบ</p>
      <ul>${getUsers().map((u) => `<li>${escapeHtml(u.displayName)} (${escapeHtml(u.username)}) — ${u.role === "admin" ? "Admin" : "User"}${u.active ? "" : " — ปิดใช้งาน"}</li>`).join("")}</ul>
    </div>

    <!-- Tab Labels -->
    <div class="settings-section">
      <div class="settings-section-title">🏷️ ชื่อเมนู</div>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem">แก้ไขชื่อเมนูที่แสดงในแถบนำทาง</p>
      <div style="display:grid;grid-template-columns:60px 1fr;gap:0.5rem 0.75rem;align-items:center">
        ${[
          { id: "pos", icon: NavIcons.pos, def: "ขาย" },
          { id: "stock", icon: NavIcons.stock, def: "Stock" },
          { id: "restock", icon: NavIcons.restock, def: "เติมของ" },
          { id: "shift", icon: NavIcons.shift, def: "สรุปกะ" },
          { id: "hotel", icon: NavIcons.hotel, def: "ของใช้" },
          { id: "settings", icon: NavIcons.settings, def: "ตั้งค่า" },
        ]
          .map(
            (t) => `
          <div style="display:flex;align-items:center;justify-content:center;color:var(--gold)">${t.icon}</div>
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
      </div>
    </div>

    <button class="btn btn-primary btn-lg btn-block" id="btn-save-settings" style="margin-top:0.5rem">💾 บันทึกการตั้งค่า</button>
  `;

  // Set sensitive values as DOM properties so they never enter the HTML string.
  container.querySelector("#s-line-token").value = s.line?.channelAccessToken || "";
  container.querySelector("#s-line-target").value = s.line?.targetId || "";
  container.querySelector("#s-telegram-token").value = s.telegram?.botToken || "";
  container.querySelector("#s-telegram-chat").value = s.telegram?.chatId || "";

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
    showIconPicker("📦", async (selectedIcon) => {
      const cats = [...(s.categories || [])];
      const newId = "cat_" + Date.now();
      cats.push({ id: newId, name: "หมวดใหม่", icon: selectedIcon });
      try {
        await updateSettings({ categories: cats }, s);
        showToast("เพิ่มหมวดแล้ว", "success");
      } catch (error) {
        showWriteError(error);
      }
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
      overlay.querySelector("#catdel-confirm").onclick = async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await updateSettings({ categories: cats.filter((_, index) => index !== idx) }, s);
          showToast(`ลบหมวด "${removed?.name}" แล้ว`, "info");
          overlay.remove();
        } catch (error) {
          showWriteError(error);
          button.disabled = false;
        }
      };
    };
  });

  // Theme picker
  container.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.onclick = async () => {
      const themeId = btn.dataset.themeId;
      const themeTitle =
        btn.querySelector(".theme-title")?.textContent || themeId;
      btn.disabled = true;
      try {
        await updateSettings({ theme: themeId }, s);
      } catch (error) {
        showWriteError(error);
        btn.disabled = false;
        return;
      }
      applyTheme(themeId);
      container
        .querySelectorAll(".theme-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      showToast(`เปลี่ยนธีมเป็น "${themeTitle}" แล้ว`, "success");
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
    reader.onload = async (ev) => {
      try {
        await updateSettings({ companyLogo: ev.target.result }, s);
        showToast("อัพโหลด Logo สำเร็จ", "success");
      } catch (error) {
        showWriteError(error);
      }
    };
    reader.readAsDataURL(file);
  };
  const removeBtn = document.getElementById("btn-remove-logo");
  if (removeBtn)
    removeBtn.onclick = async () => {
      removeBtn.disabled = true;
      try {
        await updateSettings({ companyLogo: null }, s);
      } catch (error) {
        showWriteError(error);
        removeBtn.disabled = false;
      }
    };

  const toggleLineTokenBtn = container.querySelector("#btn-toggle-line-token");
  toggleLineTokenBtn.onclick = () => {
    const input = container.querySelector("#s-line-token");
    input.type = input.type === "password" ? "text" : "password";
    toggleLineTokenBtn.textContent = input.type === "password" ? "👁️" : "🙈";
  };

  container.querySelector("#s-line-enabled").onchange = (event) => {
    const enabled = event.target.checked;
    container.querySelector("#line-notifications").style.display = enabled ? "" : "none";
    container.querySelector("#btn-test-line").style.display = enabled ? "" : "none";
    const status = container.querySelector("#line-status");
    const ready = enabled && Boolean(container.querySelector("#s-line-token").value.trim());
    status.className = `connection-status ${ready ? "status-connected" : "status-disconnected"}`;
    status.textContent = ready ? "🟢 LINE Bot เปิดใช้งาน" : "⚪ ยังไม่ได้เปิดใช้งาน";
  };

  const quotaButton = container.querySelector("#btn-line-quota");
  const quotaStatus = container.querySelector("#line-quota-status");
  const refreshQuota = async (force = false) => {
    const token = container.querySelector("#s-line-token").value.trim();
    if (!token) { quotaStatus.textContent = "กรุณากรอก Channel Access Token ก่อน"; return; }
    quotaButton.disabled = true;
    quotaStatus.textContent = "กำลังตรวจสอบโควต้า...";
    try {
      const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).format(new Date());
      const cached = !force && quotaCache?.token === token && quotaCache.data.month === month && Date.now() - quotaCache.checkedAt < 60000;
      const data = cached ? quotaCache.data : await fetchLineQuota(token);
      if (!container.contains(quotaStatus) || container.querySelector("#s-line-token").value.trim() !== token) return;
      quotaCache = { token, data, checkedAt: Date.now() };
      // The quota endpoint owns the billing period; do not infer its reset time from the browser's calendar.
      const period = "รอบเดือนปัจจุบันของ LINE";
      quotaStatus.textContent = data.limit === null
        ? `${period}: ไม่กำหนดเพดานผ่าน API · ใช้แล้วประมาณ ${data.usage.toLocaleString("th-TH")} ข้อความ`
        : `${period}: เหลือประมาณ ${data.remaining.toLocaleString("th-TH")} จาก ${data.limit.toLocaleString("th-TH")} ข้อความ · ใช้แล้ว ${data.usage.toLocaleString("th-TH")}`;
      quotaStatus.textContent += ` · ตรวจเมื่อ ${new Date(data.fetchedAt).toLocaleString("th-TH")}`;
    } catch {
      if (container.contains(quotaStatus) && container.querySelector("#s-line-token").value.trim() === token) {
        quotaStatus.textContent = "ตรวจโควต้าไม่ได้ — ตรวจ Token หรือการเชื่อมต่อ แล้วลองใหม่ (ยังไม่ทราบยอดคงเหลือ)";
      }
    } finally { if (container.contains(quotaButton)) quotaButton.disabled = false; }
  };
  quotaButton.onclick = () => refreshQuota(true);
  container.querySelector("#s-line-token").addEventListener("input", () => {
    quotaStatus.textContent = "Token เปลี่ยนแล้ว กดตรวจสอบโควต้าอีกครั้ง";
  });
  if (s.line?.channelAccessToken) void refreshQuota();

  container.querySelector("#btn-toggle-telegram-token").onclick = (event) => {
    const input = container.querySelector("#s-telegram-token");
    input.type = input.type === "password" ? "text" : "password";
    event.currentTarget.textContent = input.type === "password" ? "แสดง" : "ซ่อน";
  };
  container.querySelector("#s-telegram-enabled").onchange = (event) => {
    container.querySelector("#telegram-notifications").style.display = event.target.checked ? "" : "none";
    container.querySelector("#telegram-status").textContent = event.target.checked ? "ยังไม่บันทึก — กดบันทึกหรือทดสอบ" : "ยังไม่ได้เปิดใช้งาน";
  };
  container.querySelector("#btn-test-telegram").onclick = async (event) => {
    if (telegramTestPending) return;
    const button = event.currentTarget;
    if (!container.querySelector("#s-telegram-enabled").checked) {
      showToast("กรุณาเปิดใช้งาน Telegram ก่อนทดสอบ", "warning"); return;
    }
    telegramTestPending = true;
    button.disabled = true;
    const status = container.querySelector("#telegram-status");
    status.textContent = "กำลังบันทึกและส่งข้อความทดสอบ...";
    try {
      await saveCurrentSettings(s);
      const ok = await sendTelegramMessage(getSettings().telegram, "🏨 Chomdoi Goods\n✅ เชื่อมต่อ Telegram สำเร็จ!");
      const message = ok ? "ส่งข้อความทดสอบ Telegram สำเร็จ" : "ส่งไม่สำเร็จ — ตรวจ Bot Token, Chat ID และสิทธิ์ของบอต";
      const liveStatus = container.querySelector("#telegram-status");
      if (liveStatus) liveStatus.textContent = message;
      showToast(message, ok ? "success" : "error");
    } catch (error) {
      const message = showWriteError(error);
      const liveStatus = container.querySelector("#telegram-status");
      if (liveStatus) liveStatus.textContent = message;
    }
    finally {
      telegramTestPending = false;
      const liveButton = container.querySelector("#btn-test-telegram");
      if (liveButton) liveButton.disabled = false;
    }
  };

  container.querySelector("#btn-test-line").onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "⏳ กำลังส่ง...";
    try {
      await saveCurrentSettings(s);
      const ok = await testConnection();
      showToast(ok ? "ส่งข้อความทดสอบสำเร็จ!" : "ส่งไม่สำเร็จ — ตรวจ Token/ID", ok ? "success" : "error");
    } catch (error) {
      showWriteError(error);
    } finally {
      button.disabled = false;
      button.textContent = "📤 ทดสอบส่งข้อความ";
    }
  };

  // Export
  document.getElementById("btn-export").onclick = async () => {
    const button = document.getElementById("btn-export");
    button.disabled = true;
    try {
      await waitForSync();
      await loadData();
      exportData();
      showToast("Export สำเร็จ", "success");
    } catch (error) {
      showWriteError(error);
    } finally {
      button.disabled = false;
    }
  };
  // Save all settings
  document.getElementById("btn-save-settings").onclick = async () => {
    const button = document.getElementById("btn-save-settings");
    button.disabled = true;
    try {
      await saveCurrentSettings(s);
      showToast("บันทึกการตั้งค่าสำเร็จ", "success");
    } catch (error) {
      showWriteError(error);
    } finally {
      button.disabled = false;
    }
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
    telegram: {
      ...currentSettings.telegram,
      botToken: document.getElementById("s-telegram-token").value.trim() || null,
      chatId: document.getElementById("s-telegram-chat").value.trim() || null,
      enabled: document.getElementById("s-telegram-enabled").checked,
      notifications: {
        onShiftClose: document.getElementById("s-telegram-shift").checked,
        dailySummary: document.getElementById("s-telegram-daily").checked,
        lowStockAlert: false,
        onSale: document.getElementById("s-telegram-sale").checked,
      },
    },
    line: {
      ...currentSettings.line,
      channelAccessToken: document.getElementById("s-line-token").value.trim() || null,
      targetId: document.getElementById("s-line-target").value.trim() || null,
      enabled: document.getElementById("s-line-enabled").checked,
      notifications: {
        onShiftClose: document.getElementById("s-line-shift").checked,
        dailySummary: document.getElementById("s-line-daily").checked,
        lowStockAlert: false,
        onSale: document.getElementById("s-line-sale").checked,
      },
    },
  };
  return updateSettings(updates, currentSettings);
}

export function destroySettings() {
  if (unsub) {
    unsub();
    unsub = null;
  }
}
