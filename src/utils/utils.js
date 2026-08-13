// utils.js — Helpers
export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generateId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function formatCurrency(amount, symbol = "฿") {
  return `${symbol}${Number(amount).toLocaleString("th-TH")}`;
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(iso) {
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

// Toast system
const toastContainer = () => {
  let el = document.getElementById("toast-container");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast-container";
    el.className = "toast-container";
    document.body.appendChild(el);
  }
  return el;
};

export function showToast(message, type = "success", duration = 3000) {
  const container = toastContainer();
  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || ""}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(80px)";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Category labels — built from settings.categories
const defaultCategories = [
  { id: "water", name: "น้ำดื่ม", icon: "💧" },
  { id: "snack", name: "ขนม", icon: "🍪" },
  { id: "beer", name: "เบียร์", icon: "🍺" },
];

export function getCategoryLabels(settings) {
  const cats = settings?.categories || defaultCategories;
  const labels = { all: "ทั้งหมด" };
  cats.forEach((c) => {
    labels[c.id] = c.name;
  });
  return labels;
}

export function getCategoryList(settings) {
  return settings?.categories || defaultCategories;
}

// ดึง icon ของสินค้า — ถ้าไม่มีหรือเป็น 📦 ให้ใช้ icon ตามหมวดสินค้าแทน
export function getProductIcon(product, settings) {
  if (product.image && product.image !== "📦") return product.image;
  const cats = settings?.categories || defaultCategories;
  const cat = cats.find((c) => c.id === product.category);
  return cat?.icon || product.image || "📦";
}

// Keep backward compat (static fallback)
export const categoryLabels = {
  all: "ทั้งหมด",
  water: "น้ำดื่ม",
  snack: "ขนม",
  beer: "เบียร์",
};

export function getStockStatus(product) {
  if (product.stock <= 0)
    return { class: "stock-out", label: "หมด", badge: "badge-danger" };
  if (product.stock <= (product.lowStockThreshold || 5))
    return {
      class: "stock-low",
      label: `เหลือ ${product.stock}`,
      badge: "badge-warning",
    };
  return {
    class: "stock-ok",
    label: `คงเหลือ ${product.stock}`,
    badge: "badge-success",
  };
}

// ─── Business Day Helpers ───
// "วันทำงาน" จบที่ businessDayStartHour (default 08:00)
// เช่น เวลา 02:00 ของวันที่ 27 → ถือเป็นวันทำงานของวันที่ 26
// tolerance: ถ้าเปิดกะก่อน startHour ไม่เกิน 1 ชม. (เช่น 07:xx) ยังนับเป็นวันนี้
export function getBusinessDate(date, startHour = 8) {
  const d = new Date(date);
  const tolerance = 1; // ชั่วโมง
  if (d.getHours() < startHour - tolerance) {
    d.setDate(d.getDate() - 1);
  }
  // ใช้ local date แทน toISOString() (UTC) เพื่อให้ตรงกับ timezone ไทย
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatBusinessDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "short",
  });
}

// หาว่าตอนนี้อยู่กะไหนจาก shiftDefinitions
export function getCurrentShiftDef(shiftDefs, now = new Date()) {
  const h = now.getHours();
  for (const def of shiftDefs) {
    if (def.endHour > def.startHour) {
      // ปกติ เช่น 8-17
      if (h >= def.startHour && h < def.endHour) return def;
    } else {
      // ข้ามเที่ยงคืน เช่น 17-0 หรือ 0-8
      if (def.startHour === 0 && def.endHour > 0) {
        // กะดึก: 0-8
        if (h >= 0 && h < def.endHour) return def;
      } else {
        // กะบ่าย: 17-0
        if (h >= def.startHour) return def;
      }
    }
  }
  return shiftDefs[0]; // fallback
}

export function formatHour(h) {
  return `${String(h).padStart(2, "0")}:00`;
}
