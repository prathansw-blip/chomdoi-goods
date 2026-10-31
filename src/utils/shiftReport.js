import { formatBusinessDate, formatTime, getBusinessDate } from "./utils.js";

export function getLowStockItems(products) {
  return products.filter((product) => product.stock >= 0 &&
    product.stock <= (product.lowStockThreshold ?? 5));
}

// Read a confirmed store snapshot. Reporting must never edit a shift, sale or stock.
export function buildShiftReportData(store, shiftId, { resend = false } = {}) {
  const shift = store.shifts.find((entry) => entry.id === shiftId);
  if (!shift || shift.status !== "closed" || !shift.endTime) return null;
  const transactions = store.transactions.filter((entry) => entry.shiftId === shiftId);
  const totals = { cash: 0, transfer: 0, free: 0 };
  const counts = new Map();
  for (const transaction of transactions) {
    const method = transaction.paymentMethod || "cash";
    if (Object.hasOwn(totals, method)) totals[method] += transaction.total;
    for (const item of transaction.items) {
      counts.set(item.name, (counts.get(item.name) || 0) + item.qty);
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    name: shift.name,
    date: formatBusinessDate(shift.businessDate || getBusinessDate(shift.startTime, store.settings.businessDayStartHour ?? 8)),
    startTime: formatTime(shift.startTime), endTime: formatTime(shift.endTime),
    totalSales: totals.cash + totals.transfer, ...totals,
    totalBills: transactions.length,
    topProduct: top ? `${top[0]} (${top[1]} ชิ้น)` : "—",
    closedBy: shift.closedBy?.displayName,
    // There is no historical stock snapshot; never present today's stock as closing stock.
    lowStockItems: resend ? [] : getLowStockItems(store.products),
    note: resend ? "ℹ️ ส่งย้อนหลังจากข้อมูลกะปัจจุบัน ไม่รวมสต็อกย้อนหลัง" : null,
  };
}
