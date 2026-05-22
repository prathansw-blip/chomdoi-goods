// shift.js — หน้าสรุปกะ (3 กะ/วัน + ประวัติย้อนหลัง)
import {
  getShifts,
  getTransactions,
  getProducts,
  getActiveShift,
  startShift,
  closeShift,
  deleteShift,
  subscribe,
  getSettings,
  getUsers,
} from "../data/store.js";
import { isAdmin, getCurrentUser } from "../utils/auth.js";
import {
  generateId,
  formatCurrency,
  formatDate,
  formatTime,
  formatDateTime,
  showToast,
  getBusinessDate,
  formatBusinessDate,
  getCurrentShiftDef,
  formatHour,
} from "../utils/utils.js";
import {
  sendShiftReport,
  sendDailySummary,
  sendShiftOpenNotification,
} from "../utils/lineNotify.js";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

let unsub = null;
let chartInstance = null;
let viewMode = "current";
let selectedDate = null;

// Helper: สรุปยอดแยกตามวิธีชำระเงิน
function paymentBreakdown(txns) {
  const cash = txns
    .filter((t) => (t.paymentMethod || "cash") === "cash")
    .reduce((s, t) => s + t.total, 0);
  const transfer = txns
    .filter((t) => t.paymentMethod === "transfer")
    .reduce((s, t) => s + t.total, 0);
  const free = txns
    .filter((t) => t.paymentMethod === "free")
    .reduce((s, t) => s + t.total, 0);
  return {
    cash,
    transfer,
    free,
    total: cash + transfer,
    grandTotal: cash + transfer + free,
  };
}
function paymentBadges(pb, currency) {
  return `<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem;font-size:0.85rem">
    <span class="badge badge-success">💵 เงินสด ${formatCurrency(pb.cash, currency)}</span>
    <span class="badge badge-info">📱 โอน ${formatCurrency(pb.transfer, currency)}</span>
    ${pb.free > 0 ? `<span class="badge badge-warning">🎁 ฟรี ${formatCurrency(pb.free, currency)}</span>` : ""}
  </div>`;
}

export function renderShift(container) {
  if (unsub) unsub();
  viewMode = "current";
  selectedDate = null;
  draw(container);
  unsub = subscribe(() => {
    if (!document.querySelector(".modal-overlay")) draw(container);
  });
}

function draw(container) {
  const settings = getSettings();
  const currency = settings.currency || "฿";
  const shiftDefs = settings.shiftDefinitions || [];
  const startHour = settings.businessDayStartHour || 8;
  const active = getActiveShift();
  const now = new Date();
  const currentDef = getCurrentShiftDef(shiftDefs, now);
  const todayBiz = getBusinessDate(now, startHour);

  container.innerHTML = `
    <div style="display:flex;gap:0.75rem;margin-bottom:1.25rem;flex-wrap:wrap;align-items:center">
      <button class="btn ${viewMode === "current" ? "btn-primary" : "btn-outline"}" id="btn-view-current">📊 กะปัจจุบัน</button>
      <button class="btn ${viewMode === "history" ? "btn-primary" : "btn-outline"}" id="btn-view-history">📅 ประวัติย้อนหลัง</button>
      <div style="flex:1"></div>
      <div style="font-size:0.85rem;color:var(--text-muted)">
        วันทำงาน: <strong style="color:var(--text-primary)">${formatBusinessDate(todayBiz)}</strong>
        &nbsp;|&nbsp; กะปัจจุบัน: <strong style="color:var(--gold)">${currentDef?.icon || ""} ${currentDef?.name || "—"}</strong>
        (${formatHour(currentDef?.startHour)}-${formatHour(currentDef?.endHour)})
      </div>
    </div>
    <div id="shift-body"></div>
  `;

  document.getElementById("btn-view-current").onclick = () => {
    viewMode = "current";
    draw(container);
  };
  document.getElementById("btn-view-history").onclick = () => {
    viewMode = "history";
    selectedDate = null;
    draw(container);
  };

  if (viewMode === "current")
    drawCurrent(
      document.getElementById("shift-body"),
      settings,
      currency,
      active,
      currentDef,
      todayBiz,
    );
  else drawHistory(document.getElementById("shift-body"), settings, currency);
}

// ═══════════════════════════════════════
// กะปัจจุบัน
// ═══════════════════════════════════════
function drawCurrent(el, settings, currency, active, currentDef, todayBiz) {
  const transactions = getTransactions();
  const products = getProducts();
  const shiftDefs = settings.shiftDefinitions || [];
  const startHour = settings.businessDayStartHour || 8;

  // Stats for active shift
  let shiftTxns = [],
    shiftTotal = 0,
    shiftBills = 0,
    itemSales = {};
  if (active) {
    shiftTxns = transactions.filter((t) => t.shiftId === active.id);
    const shiftPb = paymentBreakdown(shiftTxns);
    shiftTotal = shiftPb.total;
    shiftBills = shiftTxns.length;
    shiftTxns.forEach((t) =>
      t.items.forEach((item) => {
        if (!itemSales[item.name]) itemSales[item.name] = { qty: 0, total: 0 };
        itemSales[item.name].qty += item.qty;
        itemSales[item.name].total += item.subtotal;
      }),
    );
  }
  const sortedItems = Object.entries(itemSales).sort(
    (a, b) => b[1].qty - a[1].qty,
  );
  const topProduct = sortedItems[0]
    ? `${sortedItems[0][0]} (${sortedItems[0][1].qty} ชิ้น)`
    : "—";

  // Today's shifts summary
  const todayShifts = getShifts().filter((s) => {
    const bd = getBusinessDate(s.startTime, startHour);
    return bd === todayBiz;
  });
  const todayTxns = transactions.filter((t) => {
    const bd = t.businessDate || getBusinessDate(t.timestamp, startHour);
    return bd === todayBiz;
  });
  const todayPb = paymentBreakdown(todayTxns);
  const todayTotal = todayPb.total;

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">สถานะกะ</div>
        <div class="stat-value" style="font-size:1.1rem;color:${active ? "var(--emerald)" : "var(--text-muted)"}">
          ${active ? `🟢 ${active.name}` : "⚪ ยังไม่เปิดกะ"}
        </div>
        ${active ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.3rem">เริ่ม ${formatTime(active.startTime)}</div>` : ""}
        <div class="stat-icon">⏰</div>
      </div>
      <div class="stat-card"><div class="stat-label">ยอดขายกะนี้</div><div class="stat-value" style="color:var(--gold)">${formatCurrency(shiftTotal, currency)}</div>${active ? paymentBadges(paymentBreakdown(shiftTxns), currency) : ""}<div class="stat-icon">💰</div></div>
      <div class="stat-card"><div class="stat-label">Bills กะนี้</div><div class="stat-value">${shiftBills}</div><div class="stat-icon">🧾</div></div>
      <div class="stat-card"><div class="stat-label">ยอดรวมวันนี้</div><div class="stat-value" style="color:var(--emerald)">${formatCurrency(todayTotal, currency)}</div>${paymentBadges(paymentBreakdown(todayTxns), currency)}<div class="stat-icon">📈</div></div>
    </div>

    <!-- Shift Controls -->
    <div class="card" style="margin-bottom:1.25rem">
      <div class="card-header">🔄 จัดการกะ</div>
      <div style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:center">
        ${
          !active
            ? shiftDefs
                .map(
                  (def) => `
              <button class="btn btn-success btn-start-shift" data-def-id="${def.id}">
                ${def.icon} เปิด${def.name} (${formatHour(def.startHour)}-${formatHour(def.endHour)})
              </button>
            `,
                )
                .join("")
            : `<button class="btn btn-danger" id="btn-close-shift">🔴 ปิด${active.name}</button>`
        }
      </div>
      ${!active ? `<div style="margin-top:0.75rem;font-size:0.85rem;color:var(--text-muted)">💡 แนะนำ: ตอนนี้ควรเปิด <strong style="color:var(--gold)">${currentDef?.icon} ${currentDef?.name}</strong></div>` : ""}
      ${isAdmin() ? `<div style="margin-top:0.75rem"><button class="btn btn-outline" id="btn-send-daily-summary" style="font-size:0.85rem">📋 ส่งสรุปยอดวันนี้ทาง LINE</button></div>` : ""}
    </div>

    <!-- Today's Shifts Overview -->
    <div class="card" style="margin-bottom:1.25rem">
      <div class="card-header">📋 กะวันนี้ (${formatBusinessDate(getBusinessDate(new Date(), startHour))})</div>
      ${todayShifts.length === 0 ? '<div style="color:var(--text-muted);font-size:0.9rem;padding:0.5rem 0">ยังไม่มีกะในวันนี้</div>' : ""}
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>กะ</th><th>เวลา</th><th>สถานะ</th><th>ยอดขาย</th><th>💵 สด</th><th>📱 โอน</th><th>🎁 ฟรี</th><th>Bills</th>${isAdmin() ? "<th></th>" : ""}</tr></thead>
          <tbody>
          ${todayShifts
            .map((s) => {
              const sTxns = transactions.filter((t) => t.shiftId === s.id);
              const sPb = paymentBreakdown(sTxns);
              const sTotal = sPb.total;
              return `<tr>
              <td><strong>${s.name}</strong></td>
              <td>${formatTime(s.startTime)}${s.endTime ? " → " + formatTime(s.endTime) : ""}</td>
              <td>${s.status === "active" ? '<span class="badge badge-success">🟢 เปิดอยู่</span>' : '<span class="badge badge-info">✅ ปิดแล้ว</span>'}</td>
              <td style="color:var(--gold);font-weight:600">${formatCurrency(sTotal, currency)}</td>
              <td>${formatCurrency(sPb.cash, currency)}</td>
              <td>${formatCurrency(sPb.transfer, currency)}</td>
              <td>${sPb.free > 0 ? formatCurrency(sPb.free, currency) : "—"}</td>
              <td><button class="btn-view-bills" data-sid="${s.id}" data-sname="${s.name}" style="background:none;border:1px solid var(--border);color:var(--gold);font-weight:700;font-size:0.9rem;padding:0.25rem 0.7rem;border-radius:var(--radius-sm);cursor:pointer;transition:var(--transition);font-family:'Inter',sans-serif" title="กดเพื่อดูรายละเอียด">${sTxns.length} 🧾</button></td>
              ${isAdmin() ? `<td><button class="btn btn-outline btn-del-shift" data-sid="${s.id}" data-sname="${s.name}" data-stotal="${sTotal}" data-sbills="${sTxns.length}" style="padding:0.2rem 0.5rem;font-size:0.75rem;color:var(--red)" title="ลบกะนี้">🗑️</button></td>` : ""}
            </tr>`;
            })
            .join("")}
          </tbody>
        </table>
      </div>
    </div>

    ${
      active && shiftTxns.length > 0
        ? `
      <div class="chart-container">
        <div class="card-header">📈 ยอดขายรายชั่วโมง (${active.name})</div>
        <canvas id="shift-chart" height="200"></canvas>
      </div>
      <div class="card">
        <div class="card-header">🛒 สินค้าที่ขาย (${active.name})</div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>สินค้า</th><th>จำนวน</th><th>ยอดรวม</th></tr></thead>
            <tbody>
              ${sortedItems.map(([name, data]) => `<tr><td>${name}</td><td>${data.qty} ชิ้น</td><td>${formatCurrency(data.total, currency)}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `
        : ""
    }
  `;

  // Chart
  if (active && shiftTxns.length > 0) buildChart(shiftTxns);

  // Event: manual send daily summary
  const dailySummaryBtn = document.getElementById("btn-send-daily-summary");
  if (dailySummaryBtn) {
    dailySummaryBtn.onclick = async () => {
      const dayPb = paymentBreakdown(todayTxns);
      const dayShiftsAll = getShifts().filter(
        (s) =>
          (s.businessDate || getBusinessDate(s.startTime, startHour)) ===
          todayBiz,
      );
      dailySummaryBtn.disabled = true;
      dailySummaryBtn.textContent = "📤 กำลังส่ง...";
      const ok = await sendDailySummary({
        date: formatBusinessDate(todayBiz),
        totalSales: dayPb.total,
        cash: dayPb.cash,
        transfer: dayPb.transfer,
        free: dayPb.free,
        totalBills: todayTxns.length,
        totalShifts: dayShiftsAll.length,
      });
      if (ok) showToast("ส่งสรุปยอดประจำวันทาง LINE สำเร็จ", "success");
      else showToast("ส่งไม่สำเร็จ กรุณาเช็คการตั้งค่า LINE", "error");
      dailySummaryBtn.disabled = false;
      dailySummaryBtn.textContent = "📋 ส่งสรุปยอดวันนี้ทาง LINE";
    };
  }

  // Events: start shift
  el.querySelectorAll(".btn-start-shift").forEach((btn) => {
    btn.onclick = () => {
      const defId = btn.dataset.defId;
      const def = shiftDefs.find((d) => d.id === defId);
      if (!def) return;
      const users = getUsers().filter(
        (u) => u.active !== false && u.role !== "admin",
      );
      const currentUser = getCurrentUser();
      // Show opener picker modal
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal" style="max-width:400px">
          <div class="modal-title">${def.icon} เปิด${def.name}</div>
          <div class="form-group">
            <label class="form-label">👤 ผู้เปิดกะ</label>
            <select class="form-select" id="opener-select">
              ${users.map((u) => `<option value="${u.id}" ${u.id === currentUser?.id ? "selected" : ""}>${u.displayName}${u.role === "admin" ? " ⭐" : ""}</option>`).join("")}
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn btn-outline" id="open-cancel">ยกเลิก</button>
            <button class="btn btn-primary" id="open-confirm">🟢 เปิดกะ</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector("#open-cancel").onclick = () => overlay.remove();
      overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
      };
      overlay.querySelector("#open-confirm").onclick = () => {
        const openerId = document.getElementById("opener-select").value;
        const opener = users.find((u) => u.id === openerId);
        startShift({
          id: generateId("shift"),
          defId: def.id,
          name: def.name,
          icon: def.icon,
          startTime: new Date().toISOString(),
          endTime: null,
          status: "active",
          businessDate: getBusinessDate(new Date(), startHour),
          openedBy: opener
            ? { id: opener.id, displayName: opener.displayName }
            : null,
        });
        sendShiftOpenNotification({
          name: `${def.icon} ${def.name}`,
          date: formatBusinessDate(getBusinessDate(new Date(), startHour)),
          startTime: formatTime(new Date().toISOString()),
          openedBy: opener?.displayName,
        });
        showToast(
          `เปิด ${def.icon} ${def.name} โดย ${opener?.displayName || "Unknown"}`,
          "success",
        );
        overlay.remove();
        draw(el.closest(".page-content"));
      };
    };
  });

  // Event: close shift
  const closeBtn = document.getElementById("btn-close-shift");
  if (closeBtn) {
    closeBtn.onclick = () => {
      const users = getUsers().filter(
        (u) => u.active !== false && u.role !== "admin",
      );
      const currentUser = getCurrentUser();
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal" style="max-width:420px">
          <div class="modal-title">🔴 ปิด${active.name}</div>
          <div style="text-align:center;margin:1rem 0">
            <div style="font-size:0.9rem;color:var(--text-muted)">ยอดขายกะนี้</div>
            <div style="font-size:1.8rem;font-weight:700;color:var(--gold)">${formatCurrency(shiftTotal, currency)}</div>
            <div style="font-size:0.85rem;color:var(--text-muted);margin-top:0.3rem">${shiftBills} bills</div>
          </div>
          <div class="form-group">
            <label class="form-label">👤 ผู้ปิดกะ</label>
            <select class="form-select" id="closer-select">
              ${users.map((u) => `<option value="${u.id}" ${u.id === currentUser?.id ? "selected" : ""}>${u.displayName}</option>`).join("")}
            </select>
          </div>
          <div class="modal-actions" style="margin-top:1rem">
            <button class="btn btn-outline" id="cs-cancel">ยกเลิก</button>
            <button class="btn btn-danger" id="cs-confirm">🔴 ปิดกะ</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector("#cs-cancel").onclick = () => overlay.remove();
      overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
      };
      overlay.querySelector("#cs-confirm").onclick = () => {
        const closerId = document.getElementById("closer-select").value;
        const closer = users.find((u) => u.id === closerId);
        closeShift(
          active.id,
          closer ? { id: closer.id, displayName: closer.displayName } : null,
        );
        const prods = getProducts();
        const lowStockItems = prods.filter(
          (p) => p.stock > 0 && p.stock <= (p.lowStockThreshold || 5),
        );
        const shiftPbReport = paymentBreakdown(shiftTxns);
        sendShiftReport({
          name: active.name,
          date: formatBusinessDate(
            getBusinessDate(active.startTime, startHour),
          ),
          startTime: formatTime(active.startTime),
          endTime: formatTime(new Date().toISOString()),
          totalSales: shiftTotal,
          cash: shiftPbReport.cash,
          transfer: shiftPbReport.transfer,
          free: shiftPbReport.free,
          totalBills: shiftBills,
          topProduct,
          lowStockItems,
          closedBy: closer?.displayName,
        });

        // เช็คว่าเป็นกะสุดท้ายของวันหรือไม่ → ส่งสรุปยอดประจำวัน
        const lastShiftDef = shiftDefs[shiftDefs.length - 1];
        if (lastShiftDef && active.defId === lastShiftDef.id) {
          const todayBizDate = getBusinessDate(active.startTime, startHour);
          const allTransactions = getTransactions();
          const dayTxns = allTransactions.filter(
            (t) =>
              (t.businessDate || getBusinessDate(t.timestamp, startHour)) ===
              todayBizDate,
          );
          const dayPb = paymentBreakdown(dayTxns);
          const dayShiftsAll = getShifts().filter(
            (s) =>
              (s.businessDate || getBusinessDate(s.startTime, startHour)) ===
              todayBizDate,
          );
          sendDailySummary({
            date: formatBusinessDate(todayBizDate),
            totalSales: dayPb.total,
            cash: dayPb.cash,
            transfer: dayPb.transfer,
            free: dayPb.free,
            totalBills: dayTxns.length,
            totalShifts: dayShiftsAll.length,
          });
        }

        showToast(
          `ปิด${active.name} โดย ${closer?.displayName || "Unknown"}`,
          "success",
        );
        overlay.remove();
        draw(el.closest(".page-content"));
      };
    };
  }

  // Event: delete shift (admin only)
  el.querySelectorAll(".btn-del-shift").forEach((btn) => {
    btn.onclick = () => {
      const sid = btn.dataset.sid;
      const sname = btn.dataset.sname;
      const stotal = btn.dataset.stotal;
      const sbills = btn.dataset.sbills;
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal" style="max-width:420px;text-align:center">
          <div class="modal-title">🗑️ ลบกะ "${sname}"</div>
          <div style="margin:1rem 0">
            <p style="font-size:0.95rem;color:var(--text-primary)">ต้องการลบกะนี้?</p>
            <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-sm);padding:0.75rem;margin-top:0.75rem">
              <p style="color:var(--red);font-weight:600;font-size:0.9rem">⚠️ ยอดขาย ${formatCurrency(+stotal, currency)} (${sbills} bills) จะหายไปด้วย</p>
              <p style="color:var(--text-muted);font-size:0.8rem;margin-top:0.3rem">การลบนี้ไม่สามารถยกเลิกได้</p>
            </div>
          </div>
          <div class="modal-actions" style="justify-content:center">
            <button class="btn btn-outline" id="dsh-cancel">ยกเลิก</button>
            <button class="btn btn-danger" id="dsh-confirm">🗑️ ลบกะ</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector("#dsh-cancel").onclick = () => overlay.remove();
      overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
      };
      overlay.querySelector("#dsh-confirm").onclick = () => {
        deleteShift(sid);
        showToast(`ลบกะ "${sname}" + ${sbills} bills แล้ว`, "info");
        overlay.remove();
        draw(el.closest(".page-content"));
      };
    };
  });

  // Event: view bills detail
  el.querySelectorAll(".btn-view-bills").forEach((btn) => {
    btn.onmouseenter = () => {
      btn.style.borderColor = "var(--gold)";
      btn.style.background = "rgba(245,158,11,0.1)";
    };
    btn.onmouseleave = () => {
      btn.style.borderColor = "var(--border)";
      btn.style.background = "none";
    };
    btn.onclick = () => {
      const sid = btn.dataset.sid;
      const sname = btn.dataset.sname;
      showBillsModal(sid, sname, currency);
    };
  });
}

// ═══════════════════════════════════════
// Modal: ดูรายละเอียด Bills
// ═══════════════════════════════════════
function showBillsModal(shiftId, shiftName, currency) {
  const transactions = getTransactions().filter((t) => t.shiftId === shiftId);
  const payLabels = {
    cash: "💵 เงินสด",
    transfer: "📱 เงินโอน",
    free: "🎁 ฟรี",
  };

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:600px;max-height:85vh;overflow-y:auto">
      <div class="modal-title">🧾 รายละเอียด Bills — ${shiftName}</div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem">
        ทั้งหมด ${transactions.length} bills · ยอดรวม <strong style="color:var(--gold)">${formatCurrency(paymentBreakdown(transactions).total, currency)}</strong>
      </div>
      ${
        transactions.length === 0
          ? '<div class="empty-state" style="padding:2rem"><div class="empty-state-icon">🧾</div><div class="empty-state-text">ไม่มี bills ในกะนี้</div></div>'
          : transactions
              .map(
                (txn, idx) => `
          <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:0.85rem;margin-bottom:0.65rem;transition:var(--transition)" onmouseenter="this.style.borderColor='var(--gold)'" onmouseleave="this.style.borderColor='var(--border)'">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
              <div style="display:flex;align-items:center;gap:0.5rem">
                <span style="background:var(--bg-input);padding:0.2rem 0.5rem;border-radius:var(--radius-sm);font-size:0.75rem;font-weight:600;color:var(--text-muted)">#${idx + 1}</span>
                <span style="font-size:0.8rem;color:var(--text-muted)">${formatDateTime(txn.timestamp)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:0.5rem">
                <span class="badge ${txn.paymentMethod === "cash" ? "badge-success" : txn.paymentMethod === "transfer" ? "badge-info" : "badge-warning"}" style="font-size:0.72rem">${payLabels[txn.paymentMethod || "cash"]}</span>
                <strong style="color:var(--gold);font-size:1rem">${formatCurrency(txn.total, currency)}</strong>
              </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:0.4rem">
              ${txn.items
                .map(
                  (item) => `
                <span style="background:var(--bg-input);padding:0.25rem 0.6rem;border-radius:12px;font-size:0.8rem;color:var(--text-secondary);display:inline-flex;align-items:center;gap:0.3rem">
                  ${item.name} <strong>×${item.qty}</strong> <span style="color:var(--text-muted)">${formatCurrency(item.subtotal, currency)}</span>
                </span>
              `,
                )
                .join("")}
            </div>
            ${txn.paymentMethod === "free" && txn.freeReason ? `<div style="margin-top:0.4rem;font-size:0.78rem;color:var(--orange)">💬 เหตุผล: ${txn.freeReason}</div>` : ""}
          </div>
        `,
              )
              .join("")
      }
      <div class="modal-actions" style="position:sticky;bottom:0;background:var(--bg-card);padding:0.75rem 0 0">
        <button class="btn btn-outline" id="bills-close" style="width:100%;justify-content:center">ปิด</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("#bills-close").onclick = () => overlay.remove();
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
}

// ═══════════════════════════════════════
// ประวัติย้อนหลัง
// ═══════════════════════════════════════
function drawHistory(el, settings, currency) {
  const transactions = getTransactions();
  const shifts = getShifts();
  const startHour = settings.businessDayStartHour || 8;
  const shiftDefs = settings.shiftDefinitions || [];

  // Group shifts by business date
  const dateMap = {};
  shifts.forEach((s) => {
    const bd = s.businessDate || getBusinessDate(s.startTime, startHour);
    if (!dateMap[bd]) dateMap[bd] = [];
    dateMap[bd].push(s);
  });

  // Also include dates from transactions that might not have shifts
  transactions.forEach((t) => {
    const bd = t.businessDate || getBusinessDate(t.timestamp, startHour);
    if (!dateMap[bd]) dateMap[bd] = [];
  });

  const sortedDates = Object.keys(dateMap).sort().reverse();

  if (!selectedDate && sortedDates.length > 0) {
    // Don't auto-select, show date list
  }

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:280px 1fr;gap:1.25rem;align-items:start">
      <!-- Date list -->
      <div class="card" style="max-height:600px;overflow-y:auto">
        <div class="card-header">📅 เลือกวัน</div>
        ${sortedDates.length === 0 ? '<div style="color:var(--text-muted);font-size:0.9rem;padding:1rem 0">ยังไม่มีข้อมูล</div>' : ""}
        ${sortedDates
          .map((date) => {
            const dayTxns = transactions.filter(
              (t) =>
                (t.businessDate || getBusinessDate(t.timestamp, startHour)) ===
                date,
            );
            const dayTotal = paymentBreakdown(dayTxns).total;
            const dayShifts = dateMap[date] || [];
            return `
            <div class="history-date-item ${selectedDate === date ? "active" : ""}" data-date="${date}"
                 style="padding:0.75rem;border-radius:var(--radius-sm);cursor:pointer;border:1px solid ${selectedDate === date ? "var(--gold)" : "var(--border)"};margin-bottom:0.5rem;transition:var(--transition);background:${selectedDate === date ? "rgba(245,158,11,0.1)" : "transparent"}">
              <div style="font-weight:600;font-size:0.9rem">${formatBusinessDate(date)}</div>
              <div style="display:flex;justify-content:space-between;margin-top:0.3rem">
                <span style="font-size:0.8rem;color:var(--text-muted)">${dayShifts.length} กะ · ${dayTxns.length} bills</span>
                <span style="font-size:0.85rem;font-weight:700;color:var(--gold)">${formatCurrency(dayTotal, currency)}</span>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
      <!-- Detail -->
      <div id="history-detail">
        ${selectedDate ? "" : '<div class="card"><div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-text">เลือกวันที่ด้านซ้ายเพื่อดูรายละเอียด</div></div></div>'}
      </div>
    </div>
  `;

  // Responsive
  if (!document.getElementById("history-style")) {
    const s = document.createElement("style");
    s.id = "history-style";
    s.textContent = `@media(max-width:768px){#shift-body [style*="grid-template-columns: 280px"]{grid-template-columns:1fr !important}}`;
    document.head.appendChild(s);
  }

  // Date click
  el.querySelectorAll(".history-date-item").forEach((item) => {
    item.onmouseenter = () => {
      if (item.dataset.date !== selectedDate)
        item.style.borderColor = "var(--gold)";
    };
    item.onmouseleave = () => {
      if (item.dataset.date !== selectedDate)
        item.style.borderColor = "var(--border)";
    };
    item.onclick = () => {
      selectedDate = item.dataset.date;
      draw(el.closest(".page-content"));
    };
  });

  // Render detail if selected
  if (selectedDate) {
    drawDayDetail(
      document.getElementById("history-detail"),
      selectedDate,
      settings,
      currency,
    );
  }
}

function drawDayDetail(el, date, settings, currency) {
  const transactions = getTransactions();
  const shifts = getShifts();
  const startHour = settings.businessDayStartHour || 8;
  const shiftDefs = settings.shiftDefinitions || [];

  const dayShifts = shifts.filter(
    (s) => (s.businessDate || getBusinessDate(s.startTime, startHour)) === date,
  );
  const dayTxns = transactions.filter(
    (t) => (t.businessDate || getBusinessDate(t.timestamp, startHour)) === date,
  );
  const dayTotal = paymentBreakdown(dayTxns).total;

  // Item breakdown
  const itemSales = {};
  dayTxns.forEach((t) =>
    t.items.forEach((item) => {
      if (!itemSales[item.name]) itemSales[item.name] = { qty: 0, total: 0 };
      itemSales[item.name].qty += item.qty;
      itemSales[item.name].total += item.subtotal;
    }),
  );
  const sortedItems = Object.entries(itemSales).sort(
    (a, b) => b[1].qty - a[1].qty,
  );

  el.innerHTML = `
    <div class="card" style="margin-bottom:1.25rem">
      <div class="card-header">📊 สรุปวัน ${formatBusinessDate(date)}</div>
      <div class="stats-grid" style="margin-bottom:0">
        <div class="stat-card"><div class="stat-label">ยอดขายรวม</div><div class="stat-value" style="color:var(--gold)">${formatCurrency(dayTotal, currency)}</div>${paymentBadges(paymentBreakdown(dayTxns), currency)}</div>
        <div class="stat-card"><div class="stat-label">จำนวน Bills</div><div class="stat-value">${dayTxns.length}</div></div>
        <div class="stat-card"><div class="stat-label">จำนวนกะ</div><div class="stat-value">${dayShifts.length}</div></div>
      </div>
    </div>

    <!-- Per-shift breakdown -->
    <div class="card" style="margin-bottom:1.25rem">
      <div class="card-header">📋 รายละเอียดแต่ละกะ</div>
      ${dayShifts.length === 0 ? '<div style="color:var(--text-muted);font-size:0.9rem;padding:0.5rem 0">ไม่มีกะในวันนี้ (อาจเป็น transactions ที่ไม่ได้ผูกกับกะ)</div>' : ""}
      ${dayShifts
        .map((s) => {
          const sTxns = transactions.filter((t) => t.shiftId === s.id);
          const sPb = paymentBreakdown(sTxns);
          const sTotal = sPb.total;
          const sItems = {};
          sTxns.forEach((t) =>
            t.items.forEach((i) => {
              if (!sItems[i.name])
                sItems[i.name] = {
                  qty: 0,
                  total: 0,
                  cash: 0,
                  transfer: 0,
                  free: 0,
                };
              sItems[i.name].qty += i.qty;
              sItems[i.name].total += i.subtotal;
              if (t.paymentMethod === "cash") sItems[i.name].cash += i.subtotal;
              else if (t.paymentMethod === "transfer")
                sItems[i.name].transfer += i.subtotal;
              else if (t.paymentMethod === "free")
                sItems[i.name].free += i.subtotal;
            }),
          );
          const sSorted = Object.entries(sItems).sort(
            (a, b) => b[1].qty - a[1].qty,
          );
          return `
          <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:1rem;margin-bottom:0.75rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
              <div>
                <strong style="font-size:1.05rem">${s.icon || "⏰"} ${s.name}</strong>
                <span style="font-size:0.8rem;color:var(--text-muted);margin-left:0.5rem">${formatTime(s.startTime)} → ${s.endTime ? formatTime(s.endTime) : "ยังเปิดอยู่"}</span>
              </div>
              <div style="text-align:right">
                <span style="color:var(--gold);font-weight:700;font-size:1.1rem">${formatCurrency(sTotal, currency)}</span>
                <span style="font-size:0.8rem;color:var(--text-muted);margin-left:0.5rem">${sTxns.length} bills</span>
              </div>
            </div>
            ${
              sSorted.length > 0
                ? `
              <div class="table-wrap">
              <table class="table" style="font-size:0.85rem">
                <thead><tr><th>สินค้า</th><th>จำนวน</th><th>💵 สด</th><th>📱 โอน</th><th>🎁 ฟรี</th><th>ยอด</th></tr></thead>
                <tbody>${sSorted
                  .map(
                    ([name, data]) => `<tr>
                  <td>${name}</td>
                  <td>${data.qty}</td>
                  <td>${data.cash > 0 ? formatCurrency(data.cash, currency) : "—"}</td>
                  <td>${data.transfer > 0 ? formatCurrency(data.transfer, currency) : "—"}</td>
                  <td>${data.free > 0 ? formatCurrency(data.free, currency) : "—"}</td>
                  <td style="font-weight:600">${formatCurrency(data.total, currency)}</td>
                </tr>`,
                  )
                  .join("")}</tbody>
              </table>
              </div>
            `
                : '<div style="color:var(--text-muted);font-size:0.85rem">ไม่มียอดขาย</div>'
            }
          </div>
        `;
        })
        .join("")}
    </div>

    <!-- All items for the day -->
    ${
      sortedItems.length > 0
        ? `
      <div class="card" style="margin-bottom:1.25rem">
        <div class="card-header">🛒 สินค้าทั้งวัน</div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>สินค้า</th><th>จำนวนรวม</th><th>ยอดรวม</th></tr></thead>
            <tbody>
              ${sortedItems.map(([name, data]) => `<tr><td>${name}</td><td>${data.qty} ชิ้น</td><td style="color:var(--gold);font-weight:600">${formatCurrency(data.total, currency)}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="chart-container">
        <div class="card-header">📈 ยอดขายรายชั่วโมง</div>
        <canvas id="shift-chart" height="200"></canvas>
      </div>
    `
        : ""
    }
  `;

  // Chart for the day
  if (dayTxns.length > 0) buildChart(dayTxns);
}

function buildChart(txns) {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  const canvas = document.getElementById("shift-chart");
  if (!canvas) return;
  const hourlyData = {};
  txns.forEach((t) => {
    const h = new Date(t.timestamp).getHours();
    hourlyData[h] = (hourlyData[h] || 0) + t.total;
  });
  const hours = Object.keys(hourlyData).sort((a, b) => +a - +b);
  chartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: hours.map((h) => `${String(h).padStart(2, "0")}:00`),
      datasets: [
        {
          label: "ยอดขาย (฿)",
          data: hours.map((h) => hourlyData[h]),
          backgroundColor: "rgba(245,158,11,0.6)",
          borderColor: "#f59e0b",
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => `฿${ctx.raw.toLocaleString()}` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(42,53,80,0.5)" },
          ticks: { color: "#94a3b8" },
        },
        x: { grid: { display: false }, ticks: { color: "#94a3b8" } },
      },
    },
  });
}

export function destroyShift() {
  if (unsub) {
    unsub();
    unsub = null;
  }
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}
