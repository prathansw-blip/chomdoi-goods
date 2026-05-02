// lineNotify.js — LINE Messaging API via Google Apps Script proxy (bypass CORS)
import { getSettings } from '../data/store.js';
import { formatCurrency } from './utils.js';

// Google Apps Script proxy URL (ไม่มี CORS ปัญหา)
const PROXY_URL = 'https://script.google.com/macros/s/AKfycbyN65QtU8E_BlLJNx8RdXX7SLcmwPX7GbOI0v2u7mkvcOL17QALVRutlbNKxe3_vhpi0g/exec';

async function pushMessage(messages) {
  const settings = getSettings();
  const { channelAccessToken, targetId, enabled } = settings.line || {};
  if (!enabled || !channelAccessToken || !targetId) return false;

  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // text/plain ป้องกัน preflight CORS
      body: JSON.stringify({
        token: channelAccessToken,
        to: targetId,
        messages
      })
    });
    const data = await res.json();
    return data.ok === true;
  } catch (e) {
    console.error('LINE push failed:', e);
    return false;
  }
}

export async function testConnection() {
  return pushMessage([{ type: 'text', text: '🏨 Chomdoi Goods\n✅ เชื่อมต่อ LINE สำเร็จ!\n\nระบบพร้อมแจ้งเตือนแล้ว 🎉' }]);
}

export async function sendShiftOpenNotification(data) {
  const settings = getSettings();
  if (!settings.line?.notifications?.onShiftClose) return;
  const lines = [
    `🟢 เปิดกะ: ${data.name}`,
    `📅 ${data.date}`,
    `⏰ เวลา: ${data.startTime}`,
  ];
  if (data.openedBy) lines.push(`👤 เปิดโดย: ${data.openedBy}`);
  return pushMessage([{ type: 'text', text: lines.join('\n') }]);
}

export async function sendShiftReport(shiftData) {
  const settings = getSettings();
  if (!settings.line?.notifications?.onShiftClose) return;
  const currency = settings.currency || '฿';
  const lines = [
    `📊 สรุปกะ: ${shiftData.name}`,
    `📅 ${shiftData.date} | ${shiftData.startTime} → ${shiftData.endTime}`,
    `━━━━━━━━━━━━━━━━━━━`,
    `💰 ยอดรวม: ${formatCurrency(shiftData.totalSales, currency)}`,
    `💵 เงินสด: ${formatCurrency(shiftData.cash || 0, currency)}`,
    `📱 โอน: ${formatCurrency(shiftData.transfer || 0, currency)}`,
    `🎁 ฟรี: ${formatCurrency(shiftData.free || 0, currency)}`,
    `🧾 จำนวน bills: ${shiftData.totalBills}`,
  ];
  if (shiftData.closedBy) lines.push(`👤 ปิดกะโดย: ${shiftData.closedBy}`);
  if (shiftData.topProduct) lines.push(`🔝 ขายดีสุด: ${shiftData.topProduct}`);
  if (shiftData.lowStockItems?.length) {
    lines.push('', '📦 สินค้า stock ต่ำ:');
    shiftData.lowStockItems.forEach(p => lines.push(`⚠️ ${p.name} — เหลือ ${p.stock} ชิ้น`));
  }
  return pushMessage([{ type: 'text', text: lines.join('\n') }]);
}

export async function sendDailySummary(data) {
  const settings = getSettings();
  if (!settings.line?.notifications?.dailySummary) return;
  const currency = settings.currency || '฿';
  const lines = [
    `📋 สรุปยอดประจำวัน`,
    `📅 ${data.date}`,
    `━━━━━━━━━━━━━━━━━━━`,
    `💰 ยอดรวมทั้งวัน: ${formatCurrency(data.totalSales, currency)}`,
    `💵 เงินสด: ${formatCurrency(data.cash || 0, currency)}`,
    `📱 โอน: ${formatCurrency(data.transfer || 0, currency)}`,
    `🎁 ฟรี: ${formatCurrency(data.free || 0, currency)}`,
    `🧾 จำนวน bills: ${data.totalBills}`,
    `📦 กะทั้งหมด: ${data.totalShifts} กะ`,
  ];
  return pushMessage([{ type: 'text', text: lines.join('\n') }]);
}

export async function sendLowStockAlert(products) {
  const settings = getSettings();
  if (!settings.line?.notifications?.lowStockAlert || !products.length) return;
  const lines = ['⚠️ แจ้งเตือน: สินค้าใกล้หมด', '━━━━━━━━━━━━━━━━━━━'];
  products.forEach(p => lines.push(`🔴 ${p.name} — เหลือ ${p.stock} ชิ้น`));
  return pushMessage([{ type: 'text', text: lines.join('\n') }]);
}
export async function sendSaleNotification(txn) {
  const settings = getSettings();
  if (!settings.line?.notifications?.onSale) return;
  const currency = settings.currency || '฿';
  const methodLabels = { cash: '💵 เงินสด', transfer: '📱 เงินโอน', free: '🎁 ฟรี' };
  const itemLines = txn.items.map(i => `  • ${i.name} ×${i.qty} = ${formatCurrency(i.subtotal, currency)}`);
  const lines = [
    `🛒 ขายสินค้าสำเร็จ!`,
    `━━━━━━━━━━━━━━━━━━━`,
    ...itemLines,
    `━━━━━━━━━━━━━━━━━━━`,
    `💰 รวม: ${formatCurrency(txn.total, currency)}`,
    `${methodLabels[txn.paymentMethod] || '💵 เงินสด'}`,
  ];
  if (txn.freeReason) lines.push(`💬 เหตุผล: ${txn.freeReason}`);
  return pushMessage([{ type: 'text', text: lines.join('\n') }]);
}
