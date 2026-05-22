// stock.js — หน้าจัดการสต็อก
import {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  subscribe,
  getSettings,
} from "../data/store.js";
import {
  generateId,
  formatCurrency,
  showToast,
  getCategoryLabels,
  getCategoryList,
  getStockStatus,
} from "../utils/utils.js";

let unsub = null;
let searchTerm = "";

// ─── Compress image to small thumbnail (ป้องกัน Firestore 1MB limit) ───
function compressImage(dataUrl, maxSize = 150, quality = 0.6) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width,
        h = img.height;
      if (w > h) {
        if (w > maxSize) {
          h = Math.round((h * maxSize) / w);
          w = maxSize;
        }
      } else {
        if (h > maxSize) {
          w = Math.round((w * maxSize) / h);
          h = maxSize;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export function renderStock(container) {
  if (unsub) unsub();
  searchTerm = "";
  draw(container);
  unsub = subscribe(() => {
    if (!document.querySelector(".modal-overlay")) draw(container);
  });
}

function draw(container) {
  // ถ้ามี modal เปิดอยู่ ไม่ต้อง re-render เพราะจะทำให้หน้ากระพริบ
  if (document.querySelector(".modal-overlay")) return;

  const products = getProducts();
  const settings = getSettings();
  const currency = settings.currency || "฿";
  const filtered = searchTerm
    ? products.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : products;

  const totalStock = products.reduce((s, p) => s + p.stock, 0);
  const lowCount = products.filter(
    (p) => p.stock > 0 && p.stock <= (p.lowStockThreshold || 5),
  ).length;
  const outCount = products.filter((p) => p.stock <= 0).length;

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">สินค้าทั้งหมด</div><div class="stat-value">${products.length}</div><div class="stat-icon">📦</div></div>
      <div class="stat-card"><div class="stat-label">จำนวน stock รวม</div><div class="stat-value">${totalStock.toLocaleString()}</div><div class="stat-icon">📊</div></div>
      <div class="stat-card"><div class="stat-label">สินค้าใกล้หมด</div><div class="stat-value" style="color:var(--orange)">${lowCount}</div><div class="stat-icon">⚠️</div></div>
      <div class="stat-card"><div class="stat-label">สินค้าหมด</div><div class="stat-value" style="color:var(--red)">${outCount}</div><div class="stat-icon">🚫</div></div>
    </div>
    <div style="display:flex;gap:0.75rem;margin-bottom:1.25rem;flex-wrap:wrap;align-items:center">
      <div class="search-bar" style="flex:1;min-width:200px;margin-bottom:0">
        <input type="text" placeholder="ค้นหาสินค้า..." id="stock-search" value="${searchTerm}">
      </div>
      <button class="btn btn-primary" id="btn-add-product">➕ เพิ่มสินค้า</button>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr>
          <th>สินค้า</th><th>หมวด</th><th>ราคา</th><th>คงเหลือ</th><th>สถานะ</th><th>จัดการ</th>
        </tr></thead>
        <tbody>
          ${filtered
            .map((p) => {
              const ss = getStockStatus(p);
              const cats = getCategoryLabels(settings);
              const catLabel = cats[p.category] || p.category;
              return `<tr>
              <td><span style="display:inline-flex;align-items:center;gap:0.5rem">${p.photo ? `<img src="${p.photo}" style="width:32px;height:32px;border-radius:6px;object-fit:cover">` : `<span>${p.image}</span>`}${p.name}</span></td>
              <td>${catLabel}</td>
              <td>${formatCurrency(p.price, currency)}</td>
              <td><strong>${p.stock}</strong></td>
              <td><span class="badge ${ss.badge}">${ss.label}</span></td>
              <td>
                <button class="btn btn-outline" style="padding:0.3rem 0.6rem;font-size:0.8rem" data-edit="${p.id}">✏️</button>
                <button class="btn btn-outline" style="padding:0.3rem 0.6rem;font-size:0.8rem;color:var(--red)" data-del="${p.id}">🗑️</button>
              </td>
            </tr>`;
            })
            .join("")}
          ${filtered.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">ไม่พบสินค้า</div></div></td></tr>` : ""}
        </tbody>
      </table>
    </div>
  `;

  // Events
  document.getElementById("stock-search").oninput = (e) => {
    searchTerm = e.target.value;
    draw(container);
  };
  document.getElementById("btn-add-product").onclick = () =>
    showProductModal(container);
  container.querySelectorAll("[data-edit]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      showProductModal(container, b.dataset.edit);
    };
  });
  container.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const p = getProducts().find((x) => x.id === b.dataset.del);
      if (!p) return;
      showDeleteConfirm(p, container);
    };
  });
}

function showDeleteConfirm(product, container) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px">
      <div class="modal-title">🗑️ ยืนยันการลบ</div>
      <p style="margin:1rem 0;text-align:center;font-size:1rem">ต้องการลบ <strong>"${product.name}"</strong> ?</p>
      <p style="text-align:center;font-size:0.85rem;color:var(--text-muted)">การลบนี้ไม่สามารถยกเลิกได้</p>
      <div class="modal-actions" style="margin-top:1.25rem">
        <button class="btn btn-outline" id="del-cancel">ยกเลิก</button>
        <button class="btn btn-danger" id="del-confirm">🗑️ ลบสินค้า</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("#del-cancel").onclick = () => overlay.remove();
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  overlay.querySelector("#del-confirm").onclick = () => {
    deleteProduct(product.id);
    showToast(`ลบ "${product.name}" แล้ว`, "info");
    overlay.remove();
    draw(container);
  };
}

function showProductModal(container, editId = null) {
  const settings = getSettings();
  const existing = editId ? getProducts().find((p) => p.id === editId) : null;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const categories = getCategoryList(settings);
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">${existing ? "✏️ แก้ไขสินค้า" : "➕ เพิ่มสินค้าใหม่"}</div>
      <div class="form-group"><label class="form-label">Emoji</label><input class="form-input" id="m-image" value="${existing?.image || "📦"}" maxlength="4"></div>
      <div class="form-group"><label class="form-label">ชื่อสินค้า</label><input class="form-input" id="m-name" value="${existing?.name || ""}" placeholder="เช่น น้ำเปล่า"></div>
      <div class="form-group"><label class="form-label">หมวด</label>
        <select class="form-select" id="m-cat">
          ${categories.map((c) => `<option value="${c.id}" ${existing?.category === c.id ? "selected" : ""}>${c.icon} ${c.name}</option>`).join("")}
        </select>
      </div>
      <div class="form-group"><label class="form-label">ราคา (฿)</label><input class="form-input" id="m-price" type="number" min="0" value="${existing?.price || ""}"></div>
      <div class="form-group"><label class="form-label">จำนวน stock</label><input class="form-input" id="m-stock" type="number" min="0" value="${existing?.stock || 0}"></div>
      <div class="form-group">
        <label class="form-label">รูปสินค้า</label>
        <div style="display:flex;gap:0.75rem;align-items:center">
          <div id="m-photo-preview" style="width:64px;height:64px;border-radius:var(--radius-sm);border:2px dashed var(--border);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;background:var(--bg-input)">
            ${existing?.photo ? `<img src="${existing.photo}" style="width:100%;height:100%;object-fit:cover">` : '<span style="color:var(--text-muted);font-size:0.75rem">ไม่มีรูป</span>'}
          </div>
          <div style="flex:1">
            <input type="file" id="m-photo-input" accept="image/*" hidden>
            <button class="btn btn-outline" style="font-size:0.8rem" id="m-photo-btn">📷 อัพโหลดรูป</button>
            ${existing?.photo ? `<button class="btn btn-outline" style="font-size:0.8rem;margin-left:0.5rem;color:var(--red)" id="m-photo-remove">✕ ลบรูป</button>` : ""}
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.25rem">รูปจะถูกย่อเป็น 150×150px อัตโนมัติ</div>
          </div>
        </div>
      </div>
      <div class="form-group"><label class="form-label">จุดเตือน stock ต่ำ</label><input class="form-input" id="m-threshold" type="number" min="0" value="${existing?.lowStockThreshold || 5}"></div>
      <div class="modal-actions">
        <button class="btn btn-outline" id="m-cancel">ยกเลิก</button>
        <button class="btn btn-primary" id="m-save">${existing ? "บันทึก" : "เพิ่มสินค้า"}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Photo upload — with auto-compression
  let pendingPhoto = existing?.photo || null;
  const photoInput = overlay.querySelector("#m-photo-input");
  overlay.querySelector("#m-photo-btn").onclick = () => photoInput.click();
  photoInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("ไฟล์ใหญ่เกินไป (สูงสุด 5MB)", "error");
      return;
    }
    document.getElementById("m-photo-preview").innerHTML =
      '<span style="color:var(--text-muted);font-size:0.75rem">กำลังย่อรูป...</span>';
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await compressImage(ev.target.result, 150, 0.6);
      if (compressed) {
        pendingPhoto = compressed;
        document.getElementById("m-photo-preview").innerHTML =
          `<img src="${pendingPhoto}" style="width:100%;height:100%;object-fit:cover">`;
        showToast("อัพโหลดรูปสำเร็จ (ย่อแล้ว)", "success");
      } else {
        showToast("ไม่สามารถอ่านรูปได้", "error");
      }
    };
    reader.readAsDataURL(file);
  };
  const removePhotoBtn = overlay.querySelector("#m-photo-remove");
  if (removePhotoBtn)
    removePhotoBtn.onclick = () => {
      pendingPhoto = null;
      document.getElementById("m-photo-preview").innerHTML =
        '<span style="color:var(--text-muted);font-size:0.75rem">ไม่มีรูป</span>';
    };

  overlay.querySelector("#m-cancel").onclick = () => overlay.remove();
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  overlay.querySelector("#m-save").onclick = () => {
    const name = document.getElementById("m-name").value.trim();
    const price = +document.getElementById("m-price").value;
    if (!name || price <= 0) {
      showToast("กรุณากรอกข้อมูลให้ครบ", "error");
      return;
    }
    const data = {
      name,
      price,
      image: document.getElementById("m-image").value || "📦",
      photo: pendingPhoto || null,
      category: document.getElementById("m-cat").value,
      stock: +document.getElementById("m-stock").value || 0,
      lowStockThreshold: +document.getElementById("m-threshold").value || 5,
    };
    if (existing) {
      updateProduct(editId, data);
      showToast("แก้ไขสินค้าแล้ว", "success");
    } else {
      addProduct({ id: generateId("prod"), ...data });
      showToast("เพิ่มสินค้าแล้ว", "success");
    }
    overlay.remove();
    draw(container);
  };
}

export function destroyStock() {
  if (unsub) {
    unsub();
    unsub = null;
  }
}
