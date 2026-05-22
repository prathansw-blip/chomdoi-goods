// restock.js — หน้าเติมของ
import {
  getProducts,
  addRestockLog,
  subscribe,
  getSettings,
  getUsers,
} from "../data/store.js";
import {
  generateId,
  formatDateTime,
  showToast,
  getStockStatus,
  getProductIcon,
} from "../utils/utils.js";
import { getRestockLogs } from "../data/store.js";

let unsub = null;

export function renderRestock(container) {
  if (unsub) unsub();
  draw(container);
  unsub = subscribe(() => {
    if (!document.querySelector(".modal-overlay")) draw(container);
  });
}

function draw(container) {
  const products = getProducts();
  const logs = getRestockLogs().slice().reverse().slice(0, 30);
  const users = getUsers().filter(
    (u) => u.role !== "admin" && u.active !== false,
  );
  const settings = getSettings();

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;align-items:start">
      <div class="card">
        <div class="card-header">➕ เติมสินค้า</div>
        <div class="form-group">
          <label class="form-label">เลือกสินค้า</label>
          <select class="form-select" id="rs-product">
            <option value="">— เลือกสินค้า —</option>
            ${products
              .map((p) => {
                const ss = getStockStatus(p);
                return `<option value="${p.id}">${getProductIcon(p, settings)} ${p.name} (คงเหลือ: ${p.stock})</option>`;
              })
              .join("")}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">จำนวนที่เติม</label>
          <input class="form-input" id="rs-qty" type="number" min="1" value="1" placeholder="จำนวน">
        </div>
        <div class="form-group">
          <label class="form-label">เติมโดย <span style="color:var(--red)">*</span></label>
          <select class="form-select" id="rs-user">
            <option value="">— เลือกผู้เติม —</option>
            ${users.map((u) => `<option value="${u.id}">${u.displayName}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">หมายเหตุ (ไม่บังคับ)</label>
          <textarea class="form-input" id="rs-note" placeholder="เช่น เติมตอนเช้า, รับของจากซัพพลายเออร์"></textarea>
        </div>
        <button class="btn btn-success btn-block btn-lg" id="btn-restock">📦 บันทึกการเติมของ</button>
      </div>
      <div class="card">
        <div class="card-header">📋 ประวัติการเติมของล่าสุด</div>
        ${
          logs.length === 0
            ? '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">ยังไม่มีประวัติการเติมของ</div></div>'
            : `
          <div style="max-height:450px;overflow-y:auto">
            ${logs
              .map(
                (l) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0;border-bottom:1px solid var(--border)">
                <div>
                  <div style="font-weight:600;font-size:0.9rem">${l.productName || "—"}</div>
                  <div style="font-size:0.8rem;color:var(--text-muted)">${formatDateTime(l.timestamp)}${l.restockedBy ? " • 👤 " + l.restockedBy : ""}${l.note ? " • " + l.note : ""}</div>
                </div>
                <span class="badge badge-success">+${l.quantity}</span>
              </div>
            `,
              )
              .join("")}
          </div>
        `
        }
      </div>
    </div>
  `;

  // Responsive
  if (!document.getElementById("restock-style")) {
    const s = document.createElement("style");
    s.id = "restock-style";
    s.textContent = `@media(max-width:768px){.page-content > div > [style*="grid-template-columns"]{grid-template-columns:1fr !important}}`;
    document.head.appendChild(s);
  }

  document.getElementById("btn-restock").onclick = () => {
    const productId = document.getElementById("rs-product").value;
    const qty = +document.getElementById("rs-qty").value;
    const note = document.getElementById("rs-note").value.trim();
    const userId = document.getElementById("rs-user").value;
    if (!productId) {
      showToast("กรุณาเลือกสินค้า", "warning");
      return;
    }
    if (qty <= 0) {
      showToast("กรุณาใส่จำนวน", "warning");
      return;
    }
    if (!userId) {
      showToast("กรุณาเลือกผู้เติม", "warning");
      return;
    }
    const product = getProducts().find((p) => p.id === productId);
    const user = users.find((u) => u.id === userId);
    addRestockLog({
      id: generateId("rst"),
      productId,
      productName: product?.name || "",
      quantity: qty,
      timestamp: new Date().toISOString(),
      restockedBy: user?.displayName || "",
      restockedById: userId,
      note,
    });
    showToast(
      `เติม ${product?.name} จำนวน ${qty} ชิ้น โดย ${user?.displayName} สำเร็จ`,
      "success",
    );
    draw(container);
  };
}

export function destroyRestock() {
  if (unsub) {
    unsub();
    unsub = null;
  }
}
