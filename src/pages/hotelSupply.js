// hotelSupply.js — เช็คของใช้ในโรงแรม (Daily Supply Check)
import {
  getHotelSupplies,
  getSupplyChecks,
  getSupplyRestocks,
  addHotelSupply,
  updateHotelSupply,
  deleteHotelSupply,
  addSupplyCheck,
  deleteSupplyCheck,
  addSupplyRestock,
  getUsers,
  subscribe,
  getSettings,
} from "../data/store.js";
import { generateId, showToast, formatDate, escapeHtml } from "../utils/utils.js";
import { isAdmin, getCurrentUser } from "../utils/auth.js";
import { sendSupplyCheckNotification } from "../utils/lineNotify.js";

let unsub = null;
let viewMode = "check"; // 'check' | 'manage' | 'history' | 'restock'

export function renderHotelSupply(container) {
  if (unsub) unsub();
  draw(container);
  unsub = subscribe(() => {
    if (!document.querySelector(".modal-overlay")) draw(container);
  });
}

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatThaiDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    weekday: "short",
  });
}

function draw(container) {
  const supplies = getHotelSupplies();
  const checks = getSupplyChecks();
  const today = getToday();

  container.innerHTML = `
    <div style="display:flex;gap:0.75rem;margin-bottom:1.25rem;flex-wrap:wrap">
      <button class="btn ${viewMode === "check" ? "btn-primary" : "btn-outline"}" data-view="check">📋 เช็คของวันนี้</button>
      <button class="btn ${viewMode === "restock" ? "btn-primary" : "btn-outline"}" data-view="restock">➕ เติมของใช้</button>
      <button class="btn ${viewMode === "history" ? "btn-primary" : "btn-outline"}" data-view="history">📜 ประวัติย้อนหลัง</button>
      ${isAdmin() ? `<button class="btn ${viewMode === "manage" ? "btn-primary" : "btn-outline"}" data-view="manage">⚙️ จัดการรายการ</button>` : ""}
    </div>
    <div id="supply-body"></div>
  `;

  container.querySelectorAll("[data-view]").forEach((btn) => {
    btn.onclick = () => {
      viewMode = btn.dataset.view;
      draw(container);
    };
  });

  const body = document.getElementById("supply-body");
  if (viewMode === "check") drawCheck(body, supplies, checks, today);
  else if (viewMode === "restock") drawRestock(body, supplies);
  else if (viewMode === "history") drawHistory(body, supplies, checks);
  else if (viewMode === "manage") drawManage(body, supplies, container);
}

// ─── DAILY CHECK ───
function drawCheck(el, supplies, checks, today, isEditing = false) {
  if (supplies.length === 0) {
    el.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-state-icon">🏨</div><div class="empty-state-text">ยังไม่มีรายการของใช้<br>กด "จัดการรายการ" เพื่อเพิ่มรายการ</div></div></div>`;
    return;
  }

  const todayCheck = checks.find((c) => c.date === today);
  // หาวันเช็คล่าสุดก่อนวันนี้
  const pastChecks = checks
    .filter((c) => c.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));
  const prevCheck = pastChecks[0] || null;
  // หา restocks — ถ้ามี prevCheck ดึงตั้งแต่วันนั้น ถ้าไม่มี ดึงทั้งหมด
  const restocks = getSupplyRestocks();
  const restocksSincePrev = prevCheck
    ? restocks.filter((r) => r.date > prevCheck.date && r.date <= today)
    : restocks.filter((r) => r.date <= today);

  const now = new Date();
  const currentHour = now.getHours();
  const isCheckTime = currentHour >= 16 && currentHour < 17;
  const isFirstTime = checks.length === 0;

  const isInteractive = !todayCheck || isEditing;

  el.innerHTML = `
    <div class="card" style="margin-bottom:1.25rem">
      <div class="card-header">
        📋 เช็คของใช้ประจำวัน — ${formatThaiDate(today)}
        ${isCheckTime ? '<span class="badge badge-success" style="margin-left:0.5rem">🟢 เวลาเช็คของ (16:00-17:00)</span>' : `<span class="badge badge-info" style="margin-left:0.5rem">⏰ เวลาเช็ค: 16:00-17:00</span>`}
      </div>
      ${
        isFirstTime && !todayCheck
          ? `
        <div style="padding:0.75rem;border:1px solid rgba(245,158,11,0.3);border-radius:var(--radius-sm);margin-bottom:1rem;background:rgba(245,158,11,0.08);font-size:0.85rem;color:var(--text-secondary)">
          💡 <strong>เช็คครั้งแรก:</strong> กรอกจำนวนคงเหลือปัจจุบันของแต่ละรายการ ระบบจะใช้เป็นฐานเพื่อคำนวณยอดใช้ในวันถัดไป
        </div>
      `
          : ""
      }
      ${
        todayCheck
          ? `
        <div style="padding:0.75rem;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:1rem;background:${isEditing ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)"};display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
          <div>
            <strong>${isEditing ? "✏️ กำลังแก้ไขยอดเช็ควันนี้" : "✅ เช็คแล้ววันนี้"}</strong>
            <span style="font-size:0.85rem;color:var(--text-muted);margin-left:0.5rem">โดย ${todayCheck.checkedBy?.displayName || "-"} เวลา ${new Date(todayCheck.timestamp).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            ${
              !isEditing
                ? `
              <button class="btn btn-outline" id="btn-edit-check" style="font-size:0.8rem;padding:0.35rem 0.7rem">✏️ แก้ไขจำนวน</button>
              <button class="btn btn-danger" id="btn-reset-check" style="font-size:0.8rem;padding:0.35rem 0.7rem" title="ล้างค่านับใหม่ทั้งหมด">🔄 ล้างค่านับใหม่ (Reset)</button>
            `
                : `<button class="btn btn-outline" id="btn-cancel-edit-check" style="font-size:0.8rem;padding:0.35rem 0.7rem">ยกเลิกการแก้ไข</button>`
            }
          </div>
        </div>
      `
          : ""
      }
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>รายการ</th>
              <th>ยอดครั้งก่อน</th>
              <th>เติม</th>
              <th>ยอดวันนี้</th>
              <th>ใช้ไป</th>
            </tr>
          </thead>
          <tbody>
            ${supplies
              .map((s) => {
                const prevCount = prevCheck
                  ? (prevCheck.items.find((i) => i.supplyId === s.id)?.count ?? "—")
                  : "—";
                const todayCount = todayCheck
                  ? (todayCheck.items.find((i) => i.supplyId === s.id)?.count ?? "")
                  : "";
                const restockQty = restocksSincePrev
                  .filter((r) => r.supplyId === s.id)
                  .reduce((sum, r) => sum + r.qty, 0);
                const threshold = s.lowStockThreshold ?? 10;
                let usage = "—";
                if (prevCount !== "—" && todayCount !== "") {
                  usage = prevCount + restockQty - todayCount;
                }
                const isLow = todayCheck && todayCount !== "" && +todayCount <= threshold;
                return `<tr${isLow && !isInteractive ? ' style="background:rgba(239,68,68,0.08)"' : ""}>
                <td><span style="display:inline-flex;align-items:center;gap:0.5rem"><span style="font-size:1.2rem">${s.icon}</span>${s.name}</span>${isLow && !isInteractive ? ' <span style="color:var(--red);font-size:0.75rem">⚠️ ต่ำ</span>' : ""}</td>
                <td>${prevCount !== "—" ? prevCount + " " + s.unit : '<span style="color:var(--text-muted)">ยังไม่เคยเช็ค</span>'}</td>
                <td>${restockQty > 0 ? `<span style="color:var(--green);font-weight:600">+${restockQty} ${s.unit}</span>` : "—"}</td>
                <td>${
                  isInteractive
                    ? `<input type="number" min="0" class="form-input supply-count-input" data-sid="${s.id}" style="width:90px;padding:0.3rem;text-align:center" value="${todayCount !== "" ? todayCount : ""}" placeholder="0">`
                    : `<strong style="${isLow ? "color:var(--red)" : ""}">${todayCount}</strong> ${s.unit}${isLow ? ` <span style="font-size:0.7rem;color:var(--text-muted)">(เตือน≤${threshold})</span>` : ""}`
                }</td>
                <td>${
                  !isInteractive && usage !== "—" && usage >= 0
                    ? `<span style="color:${usage > 0 ? "var(--orange)" : "var(--green)"};font-weight:700">${usage > 0 ? "-" + usage : "0"} ${s.unit}</span>`
                    : "—"
                }</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      ${
        isInteractive
          ? `
        <div style="margin-top:1rem;display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap">
          <div class="form-group" style="margin:0;flex:1;min-width:200px;max-width:250px">
            <select class="form-select" id="check-user-select">
              <option value="">— เลือกผู้เช็ค —</option>
              ${getUsers()
                .filter((u) => u.active !== false && u.role !== "admin")
                .map((u) => {
                  const selectedUser = todayCheck?.checkedBy?.id || getCurrentUser()?.id;
                  return `<option value="${u.id}" ${u.id === selectedUser ? "selected" : ""}>${u.displayName}</option>`;
                })
                .join("")}
            </select>
          </div>
          <button class="btn btn-primary" id="btn-save-check">${todayCheck ? "💾 บันทึกการแก้ไข" : "💾 บันทึกการเช็ค"}</button>
        </div>
      `
          : ""
      }
    </div>

    ${
      prevCheck
        ? `
      <div class="card">
        <div class="card-header">📊 สรุปการเช็คครั้งก่อน (${formatThaiDate(prevCheck.date)})</div>
        <div class="table-wrap">
          <table class="table" style="font-size:0.85rem">
            <thead><tr><th>รายการ</th><th>ยอดที่เช็ค</th><th>ผู้เช็ค</th></tr></thead>
            <tbody>
              ${prevCheck.items
                .map((item) => {
                  const supply = supplies.find((s) => s.id === item.supplyId);
                  return `<tr><td>${supply?.icon || "📦"} ${supply?.name || "ลบแล้ว"}</td><td>${item.count} ${supply?.unit || ""}</td><td>${prevCheck.checkedBy?.displayName || "-"}</td></tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `
        : ""
    }
  `;

  // Bind Reset button
  const resetBtn = document.getElementById("btn-reset-check");
  if (resetBtn) {
    resetBtn.onclick = () => {
      const confirmReset = confirm("ต้องการล้างค่านับของวันนี้ทั้งหมด เพื่อเริ่มกรอกใหม่ใช่หรือไม่?");
      if (confirmReset) {
        deleteSupplyCheck(today);
        showToast("ล้างค่านับของวันนี้เรียบร้อยแล้ว คุณสามารถกรอกตัวเลขใหม่ได้ทันที", "success");
        drawCheck(el, supplies, getSupplyChecks(), today, false);
      }
    };
  }

  // Bind Edit button
  const editBtn = document.getElementById("btn-edit-check");
  if (editBtn) {
    editBtn.onclick = () => {
      drawCheck(el, supplies, getSupplyChecks(), today, true);
    };
  }

  // Bind Cancel Edit button
  const cancelEditBtn = document.getElementById("btn-cancel-edit-check");
  if (cancelEditBtn) {
    cancelEditBtn.onclick = () => {
      drawCheck(el, supplies, getSupplyChecks(), today, false);
    };
  }

  // Save check event
  const saveBtn = document.getElementById("btn-save-check");
  if (saveBtn) {
    saveBtn.onclick = () => {
      const userSelect = document.getElementById("check-user-select");
      if (!userSelect.value) {
        showToast("กรุณาเลือกผู้เช็ค", "error");
        return;
      }
      const user = getUsers().find((u) => u.id === userSelect.value);
      const items = [];
      let hasEmpty = false;
      document.querySelectorAll(".supply-count-input").forEach((input) => {
        const val = input.value.trim();
        if (val === "") {
          hasEmpty = true;
          return;
        }
        items.push({ supplyId: input.dataset.sid, count: +val });
      });
      if (hasEmpty || items.length !== supplies.length) {
        showToast("กรุณากรอกจำนวนให้ครบทุกรายการ", "error");
        return;
      }
      addSupplyCheck({
        id: generateId("scheck"),
        date: today,
        items,
        checkedBy: user ? { id: user.id, displayName: user.displayName } : null,
        timestamp: new Date().toISOString(),
      });

      // Send LINE notification
      const prevCheck = checks
        .filter((c) => c.date < today)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      const restocks = getSupplyRestocks();
      const notifyItems = items.map((item) => {
        const supply = supplies.find((s) => s.id === item.supplyId);
        const prevCount = prevCheck
          ? (prevCheck.items.find((i) => i.supplyId === item.supplyId)?.count ??
            null)
          : null;
        const restockQty = prevCheck
          ? restocks
              .filter(
                (r) =>
                  r.supplyId === item.supplyId &&
                  r.date > prevCheck.date &&
                  r.date <= today,
              )
              .reduce((sum, r) => sum + r.qty, 0)
          : 0;
        let usage = null;
        if (prevCount !== null) usage = prevCount + restockQty - item.count;
        return {
          icon: supply?.icon || "📦",
          name: supply?.name || "-",
          count: item.count,
          unit: supply?.unit || "",
          usage,
          threshold: supply?.lowStockThreshold ?? 10,
        };
      });
      sendSupplyCheckNotification({
        date: formatThaiDate(today),
        checkedBy: user?.displayName || "-",
        items: notifyItems,
      });

      showToast(todayCheck ? "บันทึกการแก้ไขสำเร็จ ✅" : "บันทึกการเช็คสำเร็จ ✅", "success");
      drawCheck(el, supplies, getSupplyChecks(), today, false);
    };
  }
}

// ─── RESTOCK SUPPLIES ───
function drawRestock(el, supplies) {
  if (supplies.length === 0) {
    el.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">ยังไม่มีรายการของใช้</div></div></div>`;
    return;
  }

  const restocks = getSupplyRestocks()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 20);
  const users = getUsers().filter(
    (u) => u.active !== false && u.role !== "admin",
  );

  el.innerHTML = `
    <div class="card" style="margin-bottom:1.25rem">
      <div class="card-header">➕ เติมของใช้ในโรงแรม</div>
      <div style="display:grid;grid-template-columns:1fr 120px 180px auto;gap:0.75rem;align-items:end">
        <div class="form-group" style="margin:0">
          <label class="form-label">เลือกของ</label>
          <select class="form-select" id="rs-supply">
            ${supplies.map((s) => `<option value="${s.id}">${s.icon} ${s.name} (${s.unit})</option>`).join("")}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">จำนวน</label>
          <input type="number" class="form-input" id="rs-qty" min="1" value="1">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">เติมโดย</label>
          <select class="form-select" id="rs-user">
            <option value="">— เลือก —</option>
            ${users.map((u) => `<option value="${u.id}">${u.displayName}</option>`).join("")}
          </select>
        </div>
        <button class="btn btn-success" id="btn-restock-supply" style="margin-bottom:0">💾 บันทึก</button>
      </div>
    </div>

    ${
      restocks.length > 0
        ? `
      <div class="card">
        <div class="card-header">📜 ประวัติเติมของล่าสุด</div>
        <div class="table-wrap">
          <table class="table" style="font-size:0.85rem">
            <thead><tr><th>วันที่</th><th>รายการ</th><th>จำนวน</th><th>เติมโดย</th></tr></thead>
            <tbody>
              ${restocks
                .map((r) => {
                  const supply = supplies.find((s) => s.id === r.supplyId);
                  return `<tr>
                  <td>${formatThaiDate(r.date)}</td>
                  <td>${supply?.icon || "📦"} ${supply?.name || "ลบแล้ว"}</td>
                  <td style="color:var(--green);font-weight:600">+${r.qty} ${supply?.unit || ""}</td>
                  <td>${r.restocker || "-"}</td>
                </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `
        : ""
    }
  `;

  document.getElementById("btn-restock-supply").onclick = () => {
    const supplyId = document.getElementById("rs-supply").value;
    const qty = +document.getElementById("rs-qty").value;
    const userId = document.getElementById("rs-user").value;
    if (!userId) {
      showToast("กรุณาเลือกผู้เติม", "error");
      return;
    }
    if (qty <= 0) {
      showToast("กรุณากรอกจำนวน", "error");
      return;
    }
    const user = getUsers().find((u) => u.id === userId);
    const supply = supplies.find((s) => s.id === supplyId);
    addSupplyRestock({
      id: generateId("srestock"),
      supplyId,
      qty,
      date: getToday(),
      restocker: user?.displayName || "-",
      timestamp: new Date().toISOString(),
    });
    showToast(`เติม ${supply?.name} +${qty} ${supply?.unit} สำเร็จ`, "success");
  };
}

// ─── HISTORY ───
function drawHistory(el, supplies, checks) {
  const sorted = [...checks].sort((a, b) => b.date.localeCompare(a.date));
  const restocks = getSupplyRestocks();

  el.innerHTML = `
    <div class="card">
      <div class="card-header">📜 ประวัติการเช็คของใช้</div>
      ${sorted.length === 0 ? '<div style="color:var(--text-muted);padding:1rem;text-align:center">ยังไม่มีประวัติ</div>' : ""}
      ${sorted
        .map((check, idx) => {
          const nextCheck = sorted[idx + 1]; // previous day check (older)
          return `
          <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:1rem;margin-bottom:0.75rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
              <div>
                <strong style="font-size:1rem">📅 ${formatThaiDate(check.date)}</strong>
                <span style="font-size:0.8rem;color:var(--text-muted);margin-left:0.5rem">โดย ${check.checkedBy?.displayName || "-"} เวลา ${new Date(check.timestamp).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
            <div class="table-wrap">
              <table class="table" style="font-size:0.85rem">
                <thead><tr><th>รายการ</th><th>ยอดวันก่อน</th><th>เติม</th><th>ยอดเช็ค</th><th>ใช้ไป</th></tr></thead>
                <tbody>
                  ${check.items
                    .map((item) => {
                      const supply = supplies.find(
                        (s) => s.id === item.supplyId,
                      );
                      const prevCount = nextCheck
                        ? (nextCheck.items.find(
                            (i) => i.supplyId === item.supplyId,
                          )?.count ?? null)
                        : null;
                      const restockQty = nextCheck
                        ? restocks
                            .filter(
                              (r) =>
                                r.supplyId === item.supplyId &&
                                r.date > nextCheck.date &&
                                r.date <= check.date,
                            )
                            .reduce((sum, r) => sum + r.qty, 0)
                        : 0;
                      let usage = "—";
                      if (prevCount !== null)
                        usage = prevCount + restockQty - item.count;
                      return `<tr>
                      <td>${supply?.icon || "📦"} ${supply?.name || "ลบแล้ว"}</td>
                      <td>${prevCount !== null ? prevCount : "—"}</td>
                      <td>${restockQty > 0 ? `<span style="color:var(--green)">+${restockQty}</span>` : "—"}</td>
                      <td><strong>${item.count}</strong> ${supply?.unit || ""}</td>
                      <td>${usage !== "—" ? `<span style="color:${usage > 0 ? "var(--orange)" : "var(--green)"};font-weight:600">${usage > 0 ? "-" + usage : "0"}</span>` : "—"}</td>
                    </tr>`;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>
        `;
        })
        .join("")}
    </div>
  `;
}

// ─── MANAGE SUPPLIES (Admin) ───
function drawManage(el, supplies, container) {
  // หายอดคงเหลือล่าสุดจาก check ล่าสุด + restocks หลัง check
  const checks = getSupplyChecks();
  const latestCheck =
    [...checks].sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  const restocks = getSupplyRestocks();

  function getLatestRemaining(supplyId, unit, threshold) {
    if (!latestCheck) return { text: "—", isLow: false };
    const checkItem = latestCheck.items.find((i) => i.supplyId === supplyId);
    if (!checkItem) return { text: "—", isLow: false };
    const restockSinceCheck = restocks
      .filter((r) => r.supplyId === supplyId && r.date > latestCheck.date)
      .reduce((sum, r) => sum + r.qty, 0);
    const remaining = checkItem.count + restockSinceCheck;
    const isLow = remaining <= threshold;
    return { text: `${remaining} ${unit}`, isLow, remaining };
  }

  el.innerHTML = `
    <div class="card" style="margin-bottom:1.25rem">
      <div class="card-header">⚙️ จัดการรายการของใช้ในโรงแรม</div>
      <button class="btn btn-primary" id="btn-add-supply" style="margin-bottom:1rem">➕ เพิ่มรายการ</button>
      ${supplies.length === 0 ? '<div style="color:var(--text-muted);padding:1rem;text-align:center">ยังไม่มีรายการ กดปุ่มด้านบนเพื่อเพิ่ม</div>' : ""}
      ${latestCheck ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.75rem">📅 ยอดจากเช็คล่าสุด: ${formatThaiDate(latestCheck.date)}</div>` : ""}
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Icon</th><th>ชื่อ</th><th>หน่วย</th><th>คงเหลือ</th><th>เตือนเมื่อ≤</th><th>จัดการ</th></tr></thead>
          <tbody>
            ${supplies
              .map((s) => {
                const threshold = s.lowStockThreshold ?? 10;
                const { text: remainText, isLow } = getLatestRemaining(
                  s.id,
                  s.unit,
                  threshold,
                );
                return `<tr${isLow ? ' style="background:rgba(239,68,68,0.08)"' : ""}>
              <td style="font-size:1.3rem">${s.icon}</td>
              <td>${s.name}</td>
              <td>${s.unit}</td>
              <td><span style="font-weight:700;${isLow ? "color:var(--red)" : "color:var(--green)"}">${remainText}</span>${isLow ? ' <span style="font-size:0.7rem;color:var(--red)">⚠️</span>' : ""}</td>
              <td><span style="color:var(--orange)">${threshold}</span> ${s.unit}</td>
              <td>
                <button class="btn btn-outline" style="padding:0.3rem 0.6rem;font-size:0.8rem" data-edit-supply="${s.id}">✏️</button>
                <button class="btn btn-outline" style="padding:0.3rem 0.6rem;font-size:0.8rem;color:var(--red)" data-del-supply="${s.id}">🗑️</button>
              </td>
            </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-add-supply").onclick = () =>
    showSupplyModal(container);
  el.querySelectorAll("[data-edit-supply]").forEach((btn) => {
    btn.onclick = () => showSupplyModal(container, btn.dataset.editSupply);
  });
  el.querySelectorAll("[data-del-supply]").forEach((btn) => {
    btn.onclick = () => {
      const s = supplies.find((x) => x.id === btn.dataset.delSupply);
      if (s && confirm(`ลบ "${s.name}" ?`)) {
        deleteHotelSupply(s.id);
        showToast(`ลบ "${s.name}" แล้ว`, "info");
      }
    };
  });
}

function showSupplyModal(container, editId = null) {
  const existing = editId
    ? getHotelSupplies().find((s) => s.id === editId)
    : null;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px">
      <div class="modal-title">${existing ? "✏️ แก้ไขรายการ" : "➕ เพิ่มรายการใหม่"}</div>
      <div class="form-group"><label class="form-label">Emoji</label><input class="form-input" id="ms-icon" value="${existing?.icon || "📦"}" maxlength="4"></div>
      <div class="form-group"><label class="form-label">ชื่อรายการ</label><input class="form-input" id="ms-name" value="${existing?.name || ""}" placeholder="เช่น สบู่"></div>
      <div class="form-group"><label class="form-label">หน่วยนับ</label><input class="form-input" id="ms-unit" value="${existing?.unit || "ชิ้น"}" placeholder="เช่น ก้อน, ม้วน, ขวด"></div>
      <div class="form-group"><label class="form-label">จุดเตือน stock ต่ำ</label><input class="form-input" id="ms-threshold" type="number" min="0" value="${existing?.lowStockThreshold ?? 10}" placeholder="เช่น 10"></div>
      <div class="modal-actions">
        <button class="btn btn-outline" id="ms-cancel">ยกเลิก</button>
        <button class="btn btn-primary" id="ms-save">${existing ? "บันทึก" : "เพิ่มรายการ"}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("#ms-cancel").onclick = () => overlay.remove();
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  overlay.querySelector("#ms-save").onclick = () => {
    const name = document.getElementById("ms-name").value.trim();
    const unit = document.getElementById("ms-unit").value.trim();
    const icon = document.getElementById("ms-icon").value.trim() || "📦";
    const lowStockThreshold =
      +document.getElementById("ms-threshold").value || 10;
    if (!name) {
      showToast("กรุณากรอกชื่อรายการ", "error");
      return;
    }
    if (existing) {
      updateHotelSupply(editId, { name, unit, icon, lowStockThreshold });
      showToast("แก้ไขสำเร็จ", "success");
    } else {
      addHotelSupply({
        id: generateId("hsupply"),
        name,
        unit,
        icon,
        lowStockThreshold,
      });
      showToast("เพิ่มรายการสำเร็จ", "success");
    }
    overlay.remove();
  };
}

export function destroyHotelSupply() {
  if (unsub) {
    unsub();
    unsub = null;
  }
}
