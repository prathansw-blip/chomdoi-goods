# Project Handoff Documentation — Chomdoi Goods

เอกสารส่งมอบงานสำหรับนักพัฒนา / AI Agent (Codex) เพื่อรับช่วงต่อในการพัฒนาและบำรุงรักษาระบบ **Chomdoi Goods**
สร้างเมื่อ: 24 กันยายน 2026

---

## 1. ข้อมูลภาพรวมและฟีเจอร์ที่ใช้งานได้แล้ว (Project Overview & Features)

**Chomdoi Goods** เป็นระบบ Point of Sale (POS) และระบบบริหารจัดการสินค้า/ของใช้หน้าเคาน์เตอร์โรงแรม สำหรับ **โรงแรม Chomdoi House** ทำงานในรูปแบบ Single Page Application (SPA) รองรับทั้งการใช้งานบนเดสก์ท็อปและสมาร์ทโฟน/แท็บเล็ต

### ฟีเจอร์ที่พัฒนาเสร็จสิ้นและใช้งานได้แล้ว:
1. **ระบบขายสินค้าหน้าเคาน์เตอร์ (POS):**
   - แสดงสินค้าแยกตามหมวดหมู่ พร้อมแถบตัวกรอง (Category Filter Pills)
   - ตะกร้าสินค้า (Cart), เพิ่ม/ลดจำนวน, คำนวณยอดเงินรวม Real-time
   - ระบบชำระเงิน 3 รูปแบบ: เงินสด (Cash), เงินโอน (Transfer), ฟรี (Free — บันทึกเหตุผล เช่น ให้ช่าง, ให้แขก พร้อมระบุเลขห้อง)
   - ตัดสต็อกสินค้าอัตโนมัติเมื่อกดยืนยันการขาย
   - ลบรายการย่อยออกจากบิล หรือยกเลิกบิลย้อนหลังในกะ (คืนสต็อกและหักยอดขายออกอัตโนมัติ)
   - แถบตะกร้าลอยด้านล่าง (Mobile Cart Bar) สำหรับหน้าจอมือถือ
2. **ระบบจัดการสต็อกสินค้า (Stock Management):**
   - KPI Dashboard: จำนวนสินค้าทั้งหมด, ยอดสต็อกรวม, สินค้าใกล้หมด (Low Stock), สินค้าหมด (Out of Stock)
   - ค้นหาสินค้า (Search filter)
   - เพิ่ม, แก้ไข, ลบรายการสินค้า (ชื่อ, หมวดหมู่, ราคา, สต็อก, จุดแจ้งเตือนสต็อกต่ำ, รูปถ่าย/ไอคอน Emoji)
   - ระบบบีบอัดรูปภาพสินค้า (Image Compression ผ่าน HTML5 Canvas) เพื่อป้องกันขนาดข้อมูลเกินขีดจำกัด
3. **ระบบบันทึกการเติมสินค้า (Restock):**
   - ฟอร์มบันทึกการเติมสต็อก: เลือกสินค้า, จำนวน, ผู้เติม, และหมายเหตุ
   - บันทึกประวัติการเติมสต็อกย้อนหลัง 30 รายการล่าสุด
4. **ระบบจัดการกะการทำงาน (Shift Management):**
   - รองรับ 3 กะต่อวัน (กะเช้า 08:00–17:00, กะบ่าย 17:00–00:00, กะดึก 00:00–08:00) โดย 1 วันทำการ (Business Day) เริ่มต้นที่ 08:00 น.
   - สรุปยอดขายรวม ยอดเงินสด ยอดเงินโอน จำนวนรายการฟรี และจำนวนบิลในแต่ละกะ
   - แสดงผลกราฟยอดขายรายกะและรายวันด้วย Chart.js
   - ฟังก์ชันเปิด/ปิดกะ (Close Shift) พร้อมสรุปข้อมูล
   - ประวัติกะย้อนหลัง (Shift History) รายวันและรายเดือน พร้อมปุ่ม Export ข้อมูล
5. **ระบบตรวจนับของใช้โรงแรม (Hotel Supply):**
   - การตรวจนับของใช้รายวัน (Daily Supply Check) เช่น น้ำดื่ม, สบู่, แชมพู, กระดาษทิชชู่
   - รองรับการตรวจนับรายการย่อย (Sub-items Check)
   - ปุ่ม Reset ล้างข้อมูลการตรวจนับของวันปัจจุบัน เพื่อแก้ไขกรณีพนักงานกรอกผิด
   - บันทึกการเติมของใช้ และดูประวัติการตรวจนับย้อนหลัง
6. **ระบบตั้งค่า (Settings — Admin Only):**
   - แก้ไขชื่อโรงแรม, อัปโหลด Logo โรงแรม (อัปเดต Favicon อัตโนมัติ)
   - กำหนดหน่วยเงิน, เกณฑ์แจ้งเตือนสต็อกต่ำ, เวลาเริ่มวันทำการ และเวลาของแต่ละกะ
   - จัดการหมวดหมู่สินค้า (เพิ่ม/แก้ไข/ลบหมวดหมู่)
   - จัดการการเชื่อมต่อ LINE Messaging API (ตั้งค่า Channel Access Token, Target ID, สลับเปิด/ปิดการแจ้งเตือนแต่ละประเภท, Masking ซ่อน Token ด้วยปุ่มตาเปิด/ปิด, ปุ่มทดสอบการเชื่อมต่อ)
   - จัดการผู้ใช้งาน (เพิ่ม/แก้ไข/เปลี่ยนรหัสผ่าน/ระงับการใช้งาน/กำหนดสิทธิ์ Admin หรือ User)
   - ตัวเลือก 3 ธีมพรีเมียม (Graphite Gold, Slate Blue, Warm Stone) พร้อมบันทึกสถานะ
   - สำรองและกู้คืนข้อมูล (Export Data JSON / Clear Data)
7. **ระบบแจ้งเตือนผ่าน LINE:**
   - แจ้งเตือนเมื่อเปิดกะ / ปิดกะ (สรุปยอดขาย)
   - แจ้งเตือนเมื่อสินค้าสต็อกต่ำ
   - แจ้งเตือนสรุปยอดประจำวัน
   - ส่งผ่าน Google Apps Script Web App Proxy เพื่อเลี่ยงปัญหา CORS บนเบราว์เซอร์
8. **ระบบรักษาความปลอดภัยและการยืนยันตัวตน (Auth & Security):**
   - ล็อกอินด้วย Username และ Password
   - Session Signature ป้องกันการดัดแปลง Role (Privilege Escalation) ผ่าน DevTools
   - ตรวจสอบบทบาทผู้ใช้ (Admin/User) ซ้ำกับฐานข้อมูลทุกครั้ง
   - ทำความสะอาดข้อมูลอินพุตด้วยฟังก์ชัน XSS Sanitization (`escapeHtml`)
   - Firestore Security Rules ป้องกันการลบเอกสารหลักของระบบ

---

## 2. โครงสร้างโค้ดและไฟล์สำคัญ (Codebase Architecture)

```text
chomdoi-goods/
├── index.html                   # Entry Point HTML (มี Pre-loader และ Logo script)
├── package.json                 # Project dependencies & scripts (Vite, TypeScript, Firebase, Chart.js)
├── tsconfig.json                # TypeScript configuration
├── firebase.json                # การตั้งค่า Firebase Hosting และ Firestore Rules
├── firestore.rules              # กฎความปลอดภัย Cloud Firestore
├── firestore.indexes.json       # การตั้งค่า Firestore Indexes
├── .gitignore                   # รายการไฟล์ที่ Git ไม่ติดตาม
├── public/                      # Static assets (favicon.svg, icons.svg)
└── src/
    ├── main.js                  # Entry script ของแอปพลิเคชัน, Router, Tab Navigation, Startup Lifecycle (boot)
    ├── styles/
    │   └── index.css            # ไฟล์ CSS หลัก, Design System Tokens (3 Themes), Responsive Styles
    ├── data/
    │   ├── db.js                # จัดการการเชื่อมต่อ Firestore, Authentication wrapper, localStorage sync
    │   ├── store.js             # Reactive State Store (in-memory), Event Dispatcher, notifyAll
    │   └── seedData.js          # ข้อมูลเริ่มต้น (Default users, products, settings, shift definitions)
    ├── pages/
    │   ├── login.js             # หน้าเข้าสู่ระบบ (Login UI, Form handling, Password toggle)
    │   ├── pos.js               # หน้าขายสินค้า (Product Grid, Cart, Payment Modal, Shift Mini-Summary)
    │   ├── stock.js             # หน้าจัดการสต็อกสินค้า (Stock Table, Add/Edit Product Modal, Image Compression)
    │   ├── restock.js           # หน้าบันทึกการเติมสต็อกสินค้า (Restock Form & History Log)
    │   ├── shift.js             # หน้าสรุปกะ & ประวัติกะ (Active Shift, Close Shift, Chart.js Analytics)
    │   ├── hotelSupply.js       # หน้าตรวจนับของใช้โรงแรม (Daily Check Table, Sub-items, Reset Daily Count)
    │   └── settings.js          # หน้าตั้งค่าระบบ (Hotel Profile, LINE Config, Users, Themes, Backup)
    └── utils/
        ├── auth.js              # Session Management, Signature Validation, Login/Logout Logic, Password Hashing
        ├── icons.js             # ชุด Lucide Outline SVG Icons สำหรับ Navigation Bar
        ├── lineNotify.js        # ฟังก์ชันส่งข้อความแจ้งเตือนผ่าน LINE Messaging API (Google Apps Script Proxy)
        └── utils.js             # ฟังก์ชันอรรถประโยชน์ (formatCurrency, formatDateTime, escapeHtml, getStockStatus)
```

---

## 3. การเชื่อมต่อ Firebase (Firebase Integration & Data Schema)

### บริการของ Firebase ที่ใช้งาน:
1. **Cloud Firestore:** เป็นฐานข้อมูลหลักของระบบ (Primary Database)
2. **Firebase Authentication:** นำมาใช้งานแบบเสริม (Best-effort sync) เพื่อสร้างผู้ใช้ `<username>@chomdoi.local` ใน Firebase Auth สำหรับรองรับการพิสูจน์ตัวตน แต่ระบบตรวจสอบสิทธิ์หลักและ Role ยึดจาก Array `users` ในฐานข้อมูล Firestore
3. **Firebase Hosting:** ใช้โฮสต์ Production Web Application ที่ `https://chomdoi-house.web.app`
4. **Firebase Storage:** **ไม่ได้ใช้งาน** (รูปภาพสินค้าและโลโก้บีบอัดเป็น Base64 Data URL ผ่าน Canvas และบันทึกลง Firestore/localStorage โดยตรง)
5. **Cloud Functions:** **ไม่ได้ใช้งาน** (การแจ้งเตือน LINE ทำงานผ่าน Google Apps Script Web App Proxy)

### โครงสร้างและชื่อ Collection (Data Schema):
ระบบออกแบบสถาปัตยกรรมฐานข้อมูลเป็น **Single Document Store** เพื่อให้ง่ายต่อการซิงค์แบบ Offline-first:
* **Collection Name:** `stores`
* **Document ID:** `chomdoi_main` (ที่อยู่เอกสาร: `/stores/chomdoi_main`)

#### โครงสร้างฟิลด์ภายในเอกสาร `chomdoi_main`:
* `products`: Array ของสินค้า `[{ id, name, category, price, stock, lowStockThreshold, image, photo }]`
* `transactions`: Array ของบิลการขาย `[{ id, shiftId, businessDate, timestamp, items: [{ productId, name, price, qty, subtotal }], total, paymentMethod, paymentReason, cashier }]`
* `shifts`: Array ของกะการทำงาน `[{ id, shiftDefId, name, icon, businessDate, startTime, endTime, openedBy, closedBy, status }]`
* `restockLogs`: Array ของประวัติการเติมสต็อก `[{ id, productId, productName, quantity, timestamp, restockedBy, note }]`
* `hotelSupplies`: Array ของรายการของใช้ `[{ id, name, unit, minThreshold, subItems: [...] }]`
* `supplyChecks`: Array ของการตรวจนับของใช้ประจำวัน `[{ id, date, checkedBy, items: [...], note }]`
* `supplyRestocks`: Array ของประวัติการเติมของใช้ `[{ id, date, supplyId, quantity, restockedBy, note }]`
* `users`: Array ของผู้ใช้ระบบ `[{ id, username, displayName, role, active, passwordHash, plainPassword, createdAt }]`
* `settings`: Map การตั้งค่าระบบ `companyName, companyLogo, currency, theme, businessDayStartHour, shiftDefinitions, categories, line, firebase`

---

## 4. Firestore Security Rules และจุดที่ต้องระวัง (Security Rules & Access Control)

### กฎปัจจุบันในไฟล์ `firestore.rules`:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /stores/{storeId} {
      allow get, list: if storeId == 'chomdoi_main';
      allow create, update: if storeId == 'chomdoi_main'
        && request.resource.data.products is list
        && request.resource.data.settings is map
        && request.resource.data.users is list;
      allow delete: if false; // ป้องกันการลบฐานข้อมูลทิ้งโดยเด็ดขาด
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### จุดสำคัญและข้อควรระวัง:
1. **ห้ามเปิด `allow delete: if true` เป็นอันขาด:** เอกสาร `/stores/chomdoi_main` เก็บข้อมูลทั้งหมดของโรงแรม หากเอกสารถูกลบ ข้อมูลทั้งหมดจะสูญหายทันที
2. **การตรวจสอบสิทธิ์ Client-side vs Database Rule:** ปัจจุบัน Rule อนุญาตให้อ่านและเขียนเอกสาร `chomdoi_main` ได้โดยยังไม่ได้บังคับ `request.auth != null` เนื่องจากระบบอนุญาตให้เบราว์เซอร์ดึงข้อมูลแคชมาแสดงผลก่อนล็อกอินได้
3. **ข้อเสนอแนะสำหรับ Codex ในอนาคต:** หากต้องการยกระดับความปลอดภัย ให้เปิดใช้งาน Firebase App Check หรือปรับสถาปัตยกรรมแยก sub-collections และบังคับสิทธิ์การเขียนเฉพาะ Authenticated User

---

## 5. การ Deploy บน Vercel (Vercel Deployment Guide)

### สถานะปัจจุบัน:
* **ปัจจุบันรัน Production อยู่บน:** **Firebase Hosting** (`https://chomdoi-house.web.app`)
* **ไฟล์ `vercel.json` ใน Repository ปัจจุบัน:** **ยังไม่มี** (ยังไม่เคยตั้งค่า Vercel ในโค้ด)

### ข้อมูลสำหรับการ Deploy บน Vercel (หากต้องการใช้งาน):
* **Git Repository:** `https://github.com/prathansw-blip/chomdoi-goods.git`
* **Production Branch:** `main`
* **Framework Preset:** `Vite`
* **Build Command:** `npm run build` (หรือ `tsc && vite build`)
* **Output Directory:** `dist`
* **Install Command:** `npm install`
* **การตั้งค่า Single Page Application (SPA) Rewrites ที่จำเป็น:**
  เพื่อไม่ให้เกิดข้อผิดพลาด 404 เมื่อผู้ใช้รีเฟรชหน้าเว็บ ให้สร้างไฟล์ `vercel.json` ไว้ที่ root ดังนี้:
  ```json
  {
    "rewrites": [
      {
        "source": "/(.*)",
        "destination": "/index.html"
      }
    ]
  }
  ```

---

## 6. รายชื่อ Environment Variables ที่เกี่ยวข้อง (Environment Variables)

### สถานะปัจจุบัน:
* **ปัจจุบันโปรเจกต์ไม่ได้ใช้ไฟล์ `.env`:** โค้ดในปัจจุบันไม่มีการเรียก `import.meta.env` หรือ `process.env`
* การตั้งค่า Firebase Client เริ่มต้นอยู่ในตัวแปร `FIREBASE_CONFIG` ใน `src/data/db.js` และการตั้งค่า LINE Token ถูกจัดเก็บอยู่ใน Firestore/localStorage ในฟิลด์ `settings.line`

### รายชื่อตัวแปรที่แนะนำให้แยกเป็น `.env` ในอนาคต (ข้อเสนอแนะเพื่อความปลอดภัย):
| ชื่อตัวแปร (แนะนำ) | คำอธิบาย | ข้อมูลตัวอย่าง (ไม่ใช่ค่าจริง) |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase API Key ของโปรเจกต์ | ตัวอักษรและตัวเลขระบุสิทธิ์ Web Client |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Authentication Domain | `<project-id>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Project ID ของ Google Cloud / Firebase | `chomdoi-house` |
| `VITE_LINE_PROXY_URL` | URL ของ Google Apps Script Web App สำหรับส่ง LINE | `https://script.google.com/macros/s/.../exec` |

*(คำเตือน: ห้ามนำ API Key, LINE Channel Access Token จริง หรือรหัสผ่าน มา commit ลงใน Git)*

---

## 7. วิธีติดตั้งและรันโปรเจกต์บนเครื่อง Mac (Local Setup & Run)

### สิ่งที่ต้องติดตั้งล่วงหน้า (Prerequisites):
* **macOS** (รองรับทั้ง Apple Silicon M1/M2/M3 และ Intel)
* **Node.js** (แนะนำ Node.js v18.x หรือ v20.x ขึ้นไป)
* **Git**

### ขั้นตอนการติดตั้งและรันแบบทีละขั้นตอน:

```bash
# 1. Clone repository จาก GitHub
git clone https://github.com/prathansw-blip/chomdoi-goods.git

# 2. เข้าสู่โฟลเดอร์โปรเจกต์
cd chomdoi-goods

# 3. ติดตั้ง Dependencies ทั้งหมด
npm install

# 4. รัน Development Server
npm run dev

# 5. เปิดเว็บเบราว์เซอร์
# Vite จะแสดง Local URL เช่น http://localhost:5173 ให้เปิด URL ดังกล่าวในเบราว์เซอร์
```

### การทดสอบ Build และ Preview ผลลัพธ์:
```bash
# ทดสอบ Compile TypeScript และ Bundle ด้วย Vite
npm run build

# ทดสอบรัน Production Build ในเครื่อง
npm run preview
```

---

## 8. คำสั่ง Lint, Test, Build และผลการตรวจสอบล่าสุด (Commands & Verification)

### การตรวจสอบสคริปต์ใน `package.json`:
* **`npm run build`:** รันคำสั่ง `tsc && vite build`
  * **ผลการรันล่าสุด:** **ผ่าน 100% (Exit Code: 0)**
  * **เวลาที่ใช้:** ~184ms
  * **Output Artifacts:**
    * `dist/index.html` (~2.63 kB)
    * `dist/assets/index-[hash].css` (~23.61 kB)
    * `dist/assets/index-[hash].js` (~645 kB — มีคำเตือนเรื่องขนาด chunk เกิน 500 kB เล็กน้อยเนื่องจากรวม Chart.js และ Firebase SDK)
* **`npm run lint`:** **ไม่มีการติดตั้ง Script นี้ใน package.json** (ยังไม่ได้ตั้งค่า ESLint)
* **`npm test`:** **ไม่มีการติดตั้ง Script นี้ใน package.json** (ยังไม่ได้ตั้งค่า Test Runner เช่น Vitest หรือ Jest)

---

## 9. สรุปสถานะงาน (Project Status & Known Issues)

### งานที่ทำเสร็จแล้ว (Completed):
* ระบบงาน POS, Stock, Restock, Shift (3 กะ/วัน), Hotel Supply ครบทุกโมดูล
* การแจ้งเตือน LINE Messaging API ผ่าน Proxy
* การรักษาความปลอดภัย Session Signature ป้องกัน DevTools Role Tampering
* การ Masking ซ่อน LINE Token และป้องกัน XSS (`escapeHtml`)
* ระบบ 3 ธีม (Graphite Gold [Default], Slate Blue, Warm Stone) ปรับโทนสีตาม Design System
* การรองรับ Responsive Mobile ทุกหน้าอย่างสมบูรณ์
* ปรับปรุง Startup Lifecycle โหลดหน้าแรกได้ทันที (0ms Blocking)

### งานที่กำลังทำ (In Progress):
* การจัดทำคู่มือส่งมอบงาน (Handoff Documentation) เล่มนี้เพื่อส่งต่อให้ Codex

### ข้อจำกัดและปัญหาที่ยังค้าง / สิ่งที่ควรพัฒนาต่อ (Known Issues & Backlog):
1. **Single Document Concurrency:** ข้อมูลทั้งหมดรวมอยู่ใน `/stores/chomdoi_main` หากมีแคชเชียร์บันทึกการขายพร้อมกัน 2 เครื่องในเสี้ยววินาทีเดียวกัน อาจเกิดการเขียนทับ (Overwrite) ได้ หากในอนาคตมีเคาน์เตอร์ขายมากกว่า 1 จุด ควรแยกเป็น Sub-collections เช่น `/stores/chomdoi_main/transactions`
2. **ยังไม่มี Automated Tests:** ควรเพิ่ม Unit Tests สำหรับฟังก์ชันคำนวณเงิน, การตัดสต็อก, การคิดกะ (businessDate)
3. **การแยก Configuration:** ควรย้ายการตั้งค่า Firebase และ LINE Proxy ไปใส่ใน `.env`

---

## 10. คำอธิบาย Commit ล่าสุด `9cc90fb` และการ Sync Firestore (Commit Analysis)

* **Commit Hash:** `9cc90fb`
* **หัวข้อ:** `perf(startup): eliminate cold-start lag with instant local sync & background Firestore sync`

### กลไกการทำงาน (How It Works):
1. **ก่อนหน้า Commit นี้:** ฟังก์ชัน `boot()` ใน `src/main.js` ทำการ `await initStore()` ซึ่งสั่งรอ `waitForAuth(auth)` และสั่งดาวน์โหลดเอกสารจาก Firestore ทางไกล (`await getDoc(...)`) จนเสร็จก่อน ทำให้เกิดอาการหน้าขาวค้าง "กำลังโหลด..." นาน 3–6 วินาทีบนเครือข่ายมือถือ
2. **การปรับปรุงใน Commit `9cc90fb`:**
   * เพิ่มฟังก์ชัน `getInitialDataSync()` ใน `src/data/db.js` และ `initStoreSync()` ใน `src/data/store.js` เพื่อดึงข้อมูลแคชจาก `localStorage` (หรือ seed data) มาใช้งานทันทีแบบ Synchronous (< 5ms)
   * ฟังก์ชัน `boot()` สั่ง Render หน้า Login หรือ Dashboard ขึ้นหน้าจอ**ทันทีโดยไม่รอ Network**
   * ย้ายการเชื่อมต่อ Cloud Firestore และ Real-time Listener ไปทำงานใน Background (`initStore().then(...)`) เมื่อดึงข้อมูลล่าสุดสำเร็จ จะแจ้งเตือน Event ผ่าน `notifyAll()` เพื่ออัปเดตหน้าจอโดยอัตโนมัติ
   * เพิ่ม Timeout 1,500ms ให้กับ `waitForAuth()` เพื่อป้องกันไม่ให้ค้างกรณีสัญญาณเน็ตอ่อน

### จุดเสี่ยงเรื่องข้อมูลเก่า (Stale Data Risks) และการป้องกัน:
* **จุดเสี่ยง:** หากเครื่องแคชเชียร์ปิดไปนานหลายวัน เมื่อเปิดเว็บขึ้นมาจะแสดงข้อมูลแคชเดิมในเครื่องทันทีในเสี้ยววินาทีแรก (0–1.5 วินาที) ก่อนที่ข้อมูลจาก Firestore จะโหลดเสร็จ หากผู้ใช้รีบกดทำรายการขายในเสี้ยววินาทีนั้น อาจทำงานบนสต็อกเก่าได้
* **การป้องกันที่มีอยู่แล้ว:**
  1. หากเป็นผู้ใช้ที่ยังไม่ได้ล็อกอิน จะต้องผ่านหน้า Login ก่อน ซึ่งเมื่อล็อกอินสำเร็จ ฟังก์ชัน `onLoginSuccess()` จะสั่ง `await initStore()` เพื่อดึงข้อมูลล่าสุดจาก Cloud แน่นอน
  2. เมื่อต่ออินเทอร์เน็ตสำเร็จ Real-time Listener (`onSnapshot`) จะดึงข้อมูลล่าสุดมาทับทันที

---

## 11. กฎเหล็ก: สิ่งที่ห้ามเปลี่ยนโดยไม่ปรึกษาเจ้าของระบบ (Crucial Constraints)

1. **ห้ามเปลี่ยนหรือดัดแปลงโครงสร้างฐานข้อมูล Production:** ข้อมูลโรงแรมจริงทำงานอยู่ที่เอกสาร `/stores/chomdoi_main` บน Firestore ห้ามเปลี่ยน path หรือโครงสร้าง key หลักของข้อมูล เพราะจะทำให้ข้อมูลการขายในอดีตสูญหาย
2. **ห้ามปลดหรือลบ Firestore Rules:** กฎ `allow delete: if false;` ห้ามแก้ไขเป็นอันขาดเพื่อป้องกันการถูกล้างฐานข้อมูล
3. **ห้ามลบหรือเปลี่ยน Production Hosting Target:** ปัจจุบันระบบออนไลน์อยู่ที่ Firebase Project: `chomdoi-house` (URL: `https://chomdoi-house.web.app`)
4. **ห้ามเปลี่ยน Business Logic ของระบบกะ (Shift System):** ระบบ 3 กะต่อวัน และการตัดรอบวันทำการ (Business Day) เวลา 08:00 น. (`businessDayStartHour = 8`) เป็นมาตรฐานการปฏิบัติงานของโรงแรม Chomdoi House
5. **ห้ามนำข้อมูลความลับ (Secrets / Credentials) ใส่ในโค้ดหรือ Git:** ห้ามใส่ LINE Token จริง, รหัสผ่านพนักงานจริง หรือ Service Account Key ลงใน Git Repository
