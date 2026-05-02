// pos.js — หน้าขายสินค้า (POS)
import { getProducts, addTransaction, getActiveShift, subscribe, getSettings } from '../data/store.js';
import { generateId, formatCurrency, showToast, getCategoryLabels, getStockStatus, getProductIcon, getBusinessDate } from '../utils/utils.js';
import { sendLowStockAlert, sendSaleNotification } from '../utils/lineNotify.js';

let cart = [];
let activeFilter = 'all';
let unsub = null;
let _alertedStockIds = new Set(); // throttle: ส่งแค่ครั้งเดียวต่อ session ต่อสินค้า
let _initialAlertDone = false;   // เช็คครั้งแรกที่เปิดหน้า POS

export function renderPOS(container) {
  if (unsub) unsub();
  cart = [];
  activeFilter = 'all';
  draw(container);
  unsub = subscribe(() => draw(container));

  // เช็ค stock ต่ำทีแรกเดียว (session)
  if (!_initialAlertDone) {
    _initialAlertDone = true;
    setTimeout(() => checkAndAlertLowStock(), 3000); // รอ 3 วิ หลังโหลดเสร็จ
  }
}

// ส่ง LINE alert เมื่อ stock ต่ำ (ใช้ throttle ไม่ส่งซ้ำต่อ session)
function checkAndAlertLowStock() {
  const products = getProducts();
  const newLow = products.filter(p =>
    p.stock > 0 &&
    p.stock <= (p.lowStockThreshold || 5) &&
    !_alertedStockIds.has(p.id)
  );
  if (newLow.length) {
    newLow.forEach(p => _alertedStockIds.add(p.id));
    sendLowStockAlert(newLow);
  }
  // Reset IDs ถ้า stock เติมใหม่แล้ว (สินค้าที่เคยแจ้งแล้ว stock กลับมา จะแจ้งได้ใหม่)
  products.forEach(p => {
    if (p.stock > (p.lowStockThreshold || 5)) _alertedStockIds.delete(p.id);
  });
}

function draw(container) {
  const products = getProducts();
  const settings = getSettings();
  const currency = settings.currency || '฿';
  const filtered = activeFilter === 'all' ? products : products.filter(p => p.category === activeFilter);
  const cartTotal = cart.reduce((sum, c) => sum + c.subtotal, 0);

  container.innerHTML = `
    <div class="pos-layout">
      <div class="pos-products">
        <div class="category-filter">
          ${Object.entries(getCategoryLabels(settings)).map(([key, label]) =>
            `<button class="filter-btn ${activeFilter === key ? 'active' : ''}" data-cat="${key}">${label}</button>`
          ).join('')}
        </div>
        <div class="product-grid">
          ${filtered.map(p => {
            const ss = getStockStatus(p);
            return `
              <div class="product-card ${p.stock <= 0 ? 'out-of-stock' : ''}" data-id="${p.id}">
                ${p.photo
                  ? `<img src="${p.photo}" alt="${p.name}" style="width:56px;height:56px;border-radius:8px;object-fit:cover;margin-bottom:0.4rem">`
                  : `<div class="product-emoji">${getProductIcon(p, settings)}</div>`
                }
                <div class="product-name">${p.name}</div>
                <div class="product-price">${formatCurrency(p.price, currency)}</div>
                <div class="product-stock ${ss.class}">${ss.label}</div>
              </div>`;
          }).join('')}
          ${filtered.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">ไม่มีสินค้าในหมวดนี้</div></div>' : ''}
        </div>
      </div>
      <div class="cart card">
        <div class="card-header">🧾 ตะกร้า</div>
        ${cart.length === 0 ? '<div class="cart-empty">ยังไม่มีสินค้าในตะกร้า<br>กดที่สินค้าเพื่อเพิ่ม</div>' : `
          <div class="cart-items">
            ${cart.map((c, i) => `
              <div class="cart-item">
                <div class="cart-item-info">
                  <span>${c.image}</span>
                  <span class="cart-item-name">${c.name}</span>
                </div>
                <div class="cart-qty-controls">
                  <button class="cart-qty-btn" data-action="dec" data-idx="${i}">−</button>
                  <span class="cart-qty">${c.qty}</span>
                  <button class="cart-qty-btn" data-action="inc" data-idx="${i}">+</button>
                </div>
                <span class="cart-item-subtotal">${formatCurrency(c.subtotal, currency)}</span>
                <button class="cart-qty-btn" data-action="remove" data-idx="${i}" style="color:var(--red);border-color:var(--red);margin-left:0.3rem;">✕</button>
              </div>
            `).join('')}
          </div>
          <div class="cart-total">
            <span>รวมทั้งหมด</span>
            <span class="cart-total-amount">${formatCurrency(cartTotal, currency)}</span>
          </div>
          <button class="btn btn-primary btn-lg btn-block" id="btn-confirm-sale" style="margin-top:1rem;">✅ ยืนยันการขาย</button>
        `}
      </div>
    </div>
  `;

  if (!document.getElementById('pos-style')) {
    const s = document.createElement('style');
    s.id = 'pos-style';
    s.textContent = `.pos-layout{display:grid;grid-template-columns:1fr 380px;gap:1.25rem;align-items:start}@media(max-width:900px){.pos-layout{grid-template-columns:1fr}.cart{position:sticky;bottom:0}}.pay-option{display:flex;gap:0.75rem;margin-bottom:1rem}.pay-btn{flex:1;padding:1rem;border-radius:var(--radius);border:2px solid var(--border);background:var(--bg-input);color:var(--text-primary);font-size:1rem;cursor:pointer;text-align:center;transition:var(--transition);font-family:'Inter',sans-serif}.pay-btn:hover{border-color:var(--gold)}.pay-btn.selected{border-color:var(--gold);background:rgba(245,158,11,0.15)}.pay-btn .pay-icon{font-size:1.5rem;display:block;margin-bottom:0.3rem}`;
    document.head.appendChild(s);
  }

  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => { activeFilter = btn.dataset.cat; draw(container); };
  });
  container.querySelectorAll('.product-card:not(.out-of-stock)').forEach(card => {
    card.onclick = () => addToCart(card.dataset.id, container);
  });
  container.querySelectorAll('.cart-qty-btn').forEach(btn => {
    btn.onclick = () => {
      const idx = +btn.dataset.idx;
      if (btn.dataset.action === 'inc') {
        const p = getProducts().find(x => x.id === cart[idx].productId);
        if (p && cart[idx].qty < p.stock) { cart[idx].qty++; cart[idx].subtotal = cart[idx].qty * cart[idx].price; }
        else showToast('สินค้าไม่พอ', 'warning');
      } else if (btn.dataset.action === 'dec') {
        cart[idx].qty--; if (cart[idx].qty <= 0) cart.splice(idx, 1); else cart[idx].subtotal = cart[idx].qty * cart[idx].price;
      } else if (btn.dataset.action === 'remove') { cart.splice(idx, 1); }
      draw(container);
    };
  });
  const confirmBtn = document.getElementById('btn-confirm-sale');
  if (confirmBtn) confirmBtn.onclick = () => showPaymentModal(container);
}

function addToCart(productId, container) {
  const p = getProducts().find(x => x.id === productId);
  if (!p || p.stock <= 0) return;
  const existing = cart.find(c => c.productId === productId);
  if (existing) {
    if (existing.qty >= p.stock) { showToast('สินค้าไม่พอ', 'warning'); return; }
    existing.qty++; existing.subtotal = existing.qty * existing.price;
  } else {
    cart.push({ productId: p.id, name: p.name, image: getProductIcon(p, getSettings()), qty: 1, price: p.price, subtotal: p.price });
  }
  draw(container);
}

// ═══ Payment Method Modal ═══
function showPaymentModal(container) {
  if (cart.length === 0) return;
  const currency = getSettings().currency || '฿';
  const total = cart.reduce((s, c) => s + c.subtotal, 0);
  let selectedMethod = 'cash';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">💳 เลือกวิธีชำระเงิน</div>
      <div style="text-align:center;margin-bottom:1.25rem">
        <div style="font-size:0.85rem;color:var(--text-muted)">ยอดรวม</div>
        <div style="font-size:1.8rem;font-weight:700;color:var(--gold)">${formatCurrency(total, currency)}</div>
      </div>
      <div class="pay-option">
        <div class="pay-btn selected" data-method="cash"><span class="pay-icon">💵</span>เงินสด</div>
        <div class="pay-btn" data-method="transfer"><span class="pay-icon">📱</span>เงินโอน</div>
        <div class="pay-btn" data-method="free"><span class="pay-icon">🎁</span>ฟรี</div>
      </div>
      <div id="free-reason-wrap" style="display:none">
        <div class="form-group">
          <label class="form-label">ระบุเหตุผล <span style="color:var(--red)">*</span></label>
          <input class="form-input" id="free-reason" placeholder="เช่น ลูกค้า VIP, ของแถม">
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" id="pay-cancel">ยกเลิก</button>
        <button class="btn btn-primary btn-lg" id="pay-confirm" style="flex:1">✅ ยืนยัน</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const payBtns = overlay.querySelectorAll('.pay-btn');
  const freeWrap = overlay.querySelector('#free-reason-wrap');
  payBtns.forEach(btn => {
    btn.onclick = () => {
      payBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMethod = btn.dataset.method;
      freeWrap.style.display = selectedMethod === 'free' ? 'block' : 'none';
    };
  });
  overlay.querySelector('#pay-cancel').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.querySelector('#pay-confirm').onclick = () => {
    const reason = selectedMethod === 'free' ? document.getElementById('free-reason').value.trim() : null;
    if (selectedMethod === 'free' && !reason) { showToast('กรุณาระบุเหตุผล', 'warning'); return; }
    confirmSale(container, selectedMethod, reason);
    overlay.remove();
  };
}

function confirmSale(container, paymentMethod = 'cash', freeReason = null) {
  if (cart.length === 0) return;
  const shift = getActiveShift();
  const settings = getSettings();
  const startHour = settings.businessDayStartHour || 8;
  const txn = {
    id: generateId('txn'),
    items: cart.map(c => ({ productId: c.productId, name: c.name, qty: c.qty, price: c.price, subtotal: c.subtotal })),
    total: cart.reduce((s, c) => s + c.subtotal, 0),
    paymentMethod,
    freeReason,
    timestamp: new Date().toISOString(),
    shiftId: shift?.id || null,
    businessDate: shift?.businessDate || getBusinessDate(new Date(), startHour)
  };
  addTransaction(txn);
  sendSaleNotification(txn);
  checkAndAlertLowStock();
  const labels = { cash: '💵 เงินสด', transfer: '📱 เงินโอน', free: '🎁 ฟรี' };
  showToast(`ขายสำเร็จ — ${formatCurrency(txn.total, getSettings().currency || '฿')} (${labels[paymentMethod]})`, 'success');
  cart = [];
  draw(container);
}

export function destroyPOS() { if (unsub) { unsub(); unsub = null; } }
