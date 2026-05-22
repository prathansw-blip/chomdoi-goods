// ข้อมูลสินค้าเริ่มต้น — Chomdoi Goods
import { hashPassword } from "../utils/auth.js";

export const seedProducts = [
  // 💧 น้ำดื่ม
  {
    id: "prod_001",
    name: "น้ำเปล่า",
    category: "water",
    price: 15,
    stock: 48,
    lowStockThreshold: 10,
    image: "💧",
  },
  {
    id: "prod_002",
    name: "โค้ก",
    category: "water",
    price: 25,
    stock: 24,
    lowStockThreshold: 5,
    image: "🥤",
  },
  {
    id: "prod_003",
    name: "สไปรท์",
    category: "water",
    price: 25,
    stock: 24,
    lowStockThreshold: 5,
    image: "🥤",
  },
  {
    id: "prod_004",
    name: "แฟนต้า",
    category: "water",
    price: 25,
    stock: 24,
    lowStockThreshold: 5,
    image: "🧃",
  },
  {
    id: "prod_005",
    name: "น้ำส้ม",
    category: "water",
    price: 30,
    stock: 12,
    lowStockThreshold: 5,
    image: "🍊",
  },
  {
    id: "prod_006",
    name: "นมกล่อง",
    category: "water",
    price: 20,
    stock: 18,
    lowStockThreshold: 5,
    image: "🥛",
  },
  // 🍪 ขนม
  {
    id: "prod_007",
    name: "เลย์",
    category: "snack",
    price: 25,
    stock: 20,
    lowStockThreshold: 5,
    image: "🍟",
  },
  {
    id: "prod_008",
    name: "เพรทเซล",
    category: "snack",
    price: 30,
    stock: 15,
    lowStockThreshold: 5,
    image: "🥨",
  },
  {
    id: "prod_009",
    name: "โปเต้",
    category: "snack",
    price: 25,
    stock: 20,
    lowStockThreshold: 5,
    image: "🍪",
  },
  {
    id: "prod_010",
    name: "ถั่วอบ",
    category: "snack",
    price: 35,
    stock: 12,
    lowStockThreshold: 3,
    image: "🥜",
  },
  {
    id: "prod_011",
    name: "ช็อกโกแลต",
    category: "snack",
    price: 40,
    stock: 10,
    lowStockThreshold: 3,
    image: "🍫",
  },
  // 🍺 เบียร์ & แอลกอฮอล์
  {
    id: "prod_012",
    name: "ช้าง",
    category: "beer",
    price: 65,
    stock: 24,
    lowStockThreshold: 6,
    image: "🍺",
  },
  {
    id: "prod_013",
    name: "สิงห์",
    category: "beer",
    price: 65,
    stock: 24,
    lowStockThreshold: 6,
    image: "🍺",
  },
  {
    id: "prod_014",
    name: "ลีโอ",
    category: "beer",
    price: 55,
    stock: 24,
    lowStockThreshold: 6,
    image: "🍻",
  },
  {
    id: "prod_015",
    name: "ไฮเนเก้น",
    category: "beer",
    price: 85,
    stock: 12,
    lowStockThreshold: 3,
    image: "🍺",
  },
];

// Default users — admin account
export function createDefaultUsers() {
  return [
    {
      id: "user_admin",
      username: "admin",
      displayName: "Admin",
      passwordHash: hashPassword("admin1234"),
      role: "admin",
      active: true,
      createdAt: new Date().toISOString(),
    },
  ];
}

export const defaultSettings = {
  companyName: "Chomdoi Goods",
  companyLogo: null,
  currency: "฿",
  lowStockThreshold: 5,
  theme: "dark-gold",
  // โครงสร้างกะ — 1 วันจบที่ 08:00 (businessDayStartHour)
  businessDayStartHour: 8,
  shiftDefinitions: [
    {
      id: "shift_morning",
      name: "กะเช้า",
      startHour: 8,
      endHour: 17,
      icon: "🌅",
    },
    {
      id: "shift_afternoon",
      name: "กะบ่าย",
      startHour: 17,
      endHour: 0,
      icon: "🌇",
    },
    { id: "shift_night", name: "กะดึก", startHour: 0, endHour: 8, icon: "🌙" },
  ],
  // หมวดสินค้า
  categories: [
    { id: "water", name: "น้ำดื่ม", icon: "💧" },
    { id: "snack", name: "ขนม", icon: "🍪" },
    { id: "beer", name: "เบียร์", icon: "🍺" },
  ],
  line: {
    channelAccessToken: null,
    targetId: null,
    enabled: false,
    notifications: {
      onShiftClose: true,
      dailySummary: true,
      lowStockAlert: true,
    },
  },
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    configured: false,
  },
};
