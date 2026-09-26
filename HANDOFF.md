# Chomdoi Goods — คู่มือรับช่วงงาน

อัปเดต: 26 กันยายน 2026 จากโค้ดใน repository และผลทดสอบด้วยข้อมูลจำลอง เอกสารนี้แยก **ระบบที่ใช้งานจริง** ออกจาก **โค้ดรุ่นถัดไป** เพื่อให้เริ่มงานถูก branch และไม่ deploy ข้ามขั้นตอน

## เริ่มจากตรงไหน

| รายการ | สถานะ |
| --- | --- |
| Repository | `https://github.com/prathansw-blip/chomdoi-goods` |
| `main` / `origin/main` | commit `3a5a816`; เป็นโค้ดเดิมที่ยังใช้งานอยู่ตามหลักฐานการตรวจครั้งก่อน |
| `codex/secure-sync-prep` | เริ่มที่ commit `560b129` และมีงาน Firebase Auth, ธุรกรรมสำหรับหลายเครื่อง, กฎที่เสนอ และ Emulator tests; ตรวจ `git log -1` สำหรับ commit ล่าสุด |
| Checkout หลักบนเครื่องนี้ | `/Users/keng/Documents/AI Project/Chomdoi Goods - Codex` อยู่บน `main` |
| Worktree งานรุ่นถัดไป | `/Users/keng/.codex/worktrees/chomdoi-emulator-tests/Chomdoi Goods - Codex` อยู่บน `codex/secure-sync-prep` |
| สถานะ release | ยังไม่ merge และยังไม่ deploy โค้ดจาก `codex/secure-sync-prep` |

เริ่มงานพัฒนารุ่นถัดไปใน worktree ของ `codex/secure-sync-prep` ข้างต้น หรือ clone branch นี้ใหม่ ตรวจ branch ด้วย `git status -sb` ก่อนแก้ไฟล์ หากเปิด checkout หลักบน `main` จะเห็นโค้ดและคำสั่งทดสอบรุ่นเก่า

ระบบเป็น Vite SPA สำหรับ POS, สต็อก, การเติมสินค้า, กะ, ของใช้โรงแรม และตั้งค่า ฝั่งใช้งานจริงอยู่บน Firebase Hosting ของโปรเจกต์ `chomdoi-house` ตามหลักฐานที่ตรวจไว้ก่อนหน้า URL ที่ระบุไว้คือ `https://chomdoi-house.web.app` ข้อเท็จจริงเรื่อง Hosting/Rules ที่ deploy อยู่ควรตรวจซ้ำใน Firebase Console ก่อน cutover; การมี `firebase.json` ใน repository อย่างเดียวไม่ยืนยันสถานะ Production ณ เวลาปัจจุบัน

## สองรุ่นทำงานต่างกันอย่างไร

| เรื่อง | `main` / ระบบเดิม | `codex/secure-sync-prep` / รุ่นที่เตรียมไว้ |
| --- | --- | --- |
| Login | พนักงานกรอก username/password ใน webapp; เว็บตรวจกับ `users` ใน `/stores/chomdoi_main`; Firestore Rules เดิมไม่บังคับ login | พนักงานยังกรอก username/password ในหน้า webapp Chomdoi Goods; Firebase Auth ตรวจรหัสผ่านเบื้องหลัง และต้องมี `/staff/{uid}` ที่ active; พนักงานไม่เข้า Firebase Console และเว็บไม่สร้างบัญชีขณะ login |
| ผู้ใช้ | ยังอยู่ใน array `users` ของเอกสารร้าน รวมข้อมูลรหัสผ่านเดิม | มีบัญชี Firebase Auth เดิมและสร้าง `/staff/{uid}` สำหรับพนักงาน 5 คนแล้ว แต่ยังไม่ใช้จริงจนกว่าเว็บและ Rules ใหม่จะ deploy; การจัดการบัญชีต้องทำผ่านผู้ดูแลที่เชื่อถือได้ ไม่ได้ทำในหน้า Settings |
| การเขียน | มีการเขียนเอกสารร้านจากข้อมูลในเครื่อง ซึ่งเสี่ยงข้อมูลเก่าทับใหม่ | แต่ละรายการอ่านข้อมูลล่าสุดใน Firestore transaction, เปลี่ยนเฉพาะ top-level fields ที่เกี่ยวข้อง แล้วเพิ่ม `revision`; แจ้งสำเร็จหลัง Firestore ยืนยัน |
| การอ่านข้ามเครื่อง | `onSnapshot` อัปเดตหน้าเว็บ แต่ไม่ได้ป้องกันการเขียนทับ | `onSnapshot` และ `revision` ช่วยรับข้อมูลล่าสุด; ถ้าแก้ระเบียนเดียวกันจากข้อมูลเก่า จะแจ้ง `SYNC_CONFLICT` |
| Firestore Rules | `firestore.rules` อนุญาตผู้ไม่ล็อกอินอ่านและเขียน `/stores/chomdoi_main` ตามเงื่อนไขของกฎ | `firestore.secure.rules` เป็นกฎที่เสนอสำหรับพนักงาน active; ยังไม่ได้ deploy |
| LINE token | อยู่ใน `settings.line` ของเอกสารร้าน | ยังคงให้ตั้งในหน้า Settings ตามคำขอเจ้าของระบบ; พนักงานที่อ่านเอกสารร้านได้ยังเข้าถึง field นี้ผ่าน Firestore ได้ |

รุ่นใหม่ยังเก็บยอดขาย สต็อก และข้อมูลอื่นในเอกสารเดียว `/stores/chomdoi_main` การเขียนแบบ transaction ลดความเสี่ยงข้อมูลหายจากหลายเครื่อง แต่ยังมีข้อจำกัดด้านขนาดเอกสารและการแย่งเขียนเมื่อปริมาณงานสูง กฎใหม่ควบคุมสิทธิ์ระดับเอกสารและบทบาท ไม่ได้ตรวจความถูกต้องของทุกรายการขายจากผู้ใช้ที่จงใจส่งคำขอ Firestore เอง

## ไฟล์ที่ต้องอ่านเมื่อพัฒนาต่อ

- `src/main.js`: เริ่มแอป, รอ session ที่ตรวจแล้ว, แสดงหน้า และสถานะ sync
- `src/utils/auth.js`: Firebase Auth และการตรวจ `/staff/{uid}`
- `src/data/db.js`: อ่านจาก server, ฟัง `onSnapshot`, บันทึกด้วย Firestore transaction, export
- `src/data/store.js`: state ในหน่วยความจำ, คิวการเขียน, รับ snapshot ระหว่างรายการที่กำลังบันทึก
- `src/data/sale.js`, `src/data/restock.js`, `src/data/operations.js`: คำนวณและตรวจการเปลี่ยนข้อมูลแต่ละชนิด
- `src/pages/`: UI ของ POS, stock, restock, shift, hotel supply, settings และ login
- `firestore.rules`: กฎเดิมสำหรับทดสอบและอ้างอิง ห้ามเผยแพร่กลับไป Production
- `firestore.secure.rules`: กฎสำหรับ cutover ที่ `firebase.json` ของ branch นี้อ้างอยู่; `firebase.secure.emulator.json` ใช้ทดสอบเฉพาะ Emulator
- `firestore.maintenance.rules`, `firebase.maintenance.json`: ปิดการอ่านและเขียนทั้งหมดชั่วคราวระหว่างย้ายข้อมูล; ใช้กับคำสั่ง deploy กฎแบบระบุ config เท่านั้น
- `scripts/migration-plan.mjs`: ฟังก์ชันสร้างแผนจับคู่ผู้ใช้แบบไม่มี network หรือ filesystem access; ไม่ทำ migration จริง
- `scripts/store-cutover-plan.mjs`: สร้างแผนเขียนที่ลบเฉพาะ `users` และเพิ่ม `revision` พร้อมตรวจ `updateTime`; ไม่เชื่อม Production
- `scripts/audit-legacy-cache.mjs`, `MIGRATION_PREP.md`: เครื่องมือตรวจข้อมูลค้างในเบราว์เซอร์แบบอ่านอย่างเดียวและขั้นเตรียมข้อมูลก่อนย้ายจริง
- `src/data/legacy-cache.js`: เก็บรายการธุรกิจเดิมในเครื่องก่อนเริ่มเว็บใหม่โดยตัดข้อมูลลับออก; ไม่โหลดสำเนาเข้า live state และไม่ส่ง Firestore รองรับพื้นที่ไม่พอและไม่เขียนทับสำเนาก่อนหน้า ยังไม่ได้ยืนยันสำเนาจริงบน Windows/Android
- `scripts/seed-emulator.mjs`, `tests/README.md`, `tests/`: ข้อมูลจำลองและวิธีทดสอบ
- `SECURITY_ROLLOUT.md`: preconditions, cutover และ rollback สำหรับ Production

`src/data/db.js` ใช้ Firebase config ของ `demo-chomdoi-tests` เฉพาะ Vite mode `emulator`; mode ปกติชี้ไปที่ `chomdoi-house` จึงใช้ `npm run dev:emulator` เมื่อต้องการลองเว็บโดยไม่เชื่อม Production อย่าใช้ `npm run dev` สำหรับการทดสอบที่ตั้งใจให้ปลอดจากข้อมูลจริง การทดสอบตัดการเชื่อมต่อเฉพาะเครื่องลูกข่ายสามารถกำหนด `VITE_FIRESTORE_EMULATOR_PORT` ให้ชี้พอร์ต proxy บน `127.0.0.1` แทนพอร์ต Emulator ปกติ `8080`

## คำสั่งทำงานใน branch รุ่นถัดไป

ต้องมี Node.js, Firebase CLI และ JDK 21 ขึ้นไป ใช้ `npm ci` ติดตั้งตาม lockfile บนเครื่องนี้ JDK 21 อยู่ที่ `/opt/homebrew/opt/openjdk@21/bin` คำสั่ง shell ของ Codex ใน workspace นี้ขึ้นต้นด้วย `rtk` ตาม `/Users/keng/.codex/RTK.md`

```sh
rtk git status --short --branch
rtk npm ci
rtk npm run build
rtk proxy env PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH npm run test:emulator:run
rtk proxy env PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH npm run dev:emulator
```

`test:emulator:run` เปิด Firestore Emulator และรัน Vitest ด้วย project ID `demo-chomdoi-tests`; `dev:emulator` เปิด Auth กับ Firestore Emulator และ seed ข้อมูลจำลองก่อนเปิด Vite ที่ localhost อย่าเปิดสองคำสั่งพร้อมกันเพราะใช้ port Firestore `8080` เดียวกัน `npm run test:emulator` เป็นคำสั่งภายในสำหรับ runner ที่เปิด Emulator แล้ว

ผลตรวจล่าสุด (26 กันยายน 2026): Emulator tests **45/45 ผ่าน** จาก 10 ไฟล์; `npm run build` ผ่านและมีคำเตือน JavaScript chunk เกิน 500 kB ไม่มีการใช้ Firestore Production ในการทดสอบเหล่านี้ UI จำลองเคยทดสอบล็อกอิน admin/cashier เปิดกะ ขาย เติมของ และรับข้อมูลในแท็บที่สองแล้ว รอบนี้ทดสอบเพิ่มการเปลี่ยนสิทธิ์และปิดบัญชีขณะใช้งาน, เพิ่ม/แก้/ลบสินค้าและหมวด, บันทึก Settings รวมถึง LINE token จำลอง, และการชนกันของการแก้ราคาสินค้า: ระบบปฏิเสธค่าที่ล้าสมัยและแสดงค่าล่าสุดหลังปิดฟอร์ม เมื่อหยุด Firestore Emulator ชั่วคราวระหว่างบันทึก เว็บยังไม่แสดงผลสำเร็จหรือราคาใหม่; เมื่อเปิด Emulator กลับ รายการจึงถูกยืนยัน และตรวจราคาในฐานข้อมูลจำลองแล้ว อีกกรณีใช้ proxy ตัดเฉพาะเว็บเครื่องแรก เครื่องที่สองแก้ราคาได้ระหว่างนั้น เมื่อเครื่องแรกต่อกลับ การแก้จากข้อมูลเก่าถูกปฏิเสธพร้อมข้อความค้างในฟอร์ม และสุดท้ายแสดงราคาของเครื่องที่สองตรงกับฐานข้อมูลจำลอง ไฟล์ Export ดาวน์โหลดจริง เปิด JSON ได้ และแก้ชื่อไฟล์ให้ใช้วันที่ท้องถิ่นแล้ว

## งานที่ยังต้องทำก่อนขึ้น Production

1. เก็บรายการ UI เส้นทางอื่นที่ยังไม่ได้ทดสอบก่อน cutover และทดสอบซ้ำหลังแก้โค้ดหรือเตรียมข้อมูลย้ายจริง โดยใช้ข้อมูลจำลองและตรวจผลใน Firestore Emulator
2. เจ้าของระบบอนุมัติ `admin` เป็น admin และ `ho`, `jom`, `wan`, `liyah` เป็น user; สร้าง `/staff/{uid}` 5 รายการและตรวจอ่านกลับแล้ว อีก 6 บัญชี Auth ไม่ได้รับสิทธิ์ staff บัญชี Auth ไม่ถูกแก้และไม่มีการคัดลอกรหัสผ่านลง staff document ก่อน cutover ต้องตรวจบัญชีซ้ำและให้พนักงานทดลองล็อกอินผ่าน webapp เท่านั้น หน้า Settings รุ่นใหม่ไม่มีฟังก์ชันเพิ่มหรือเปลี่ยนรหัสผ่านพนักงาน สำเนาหลังสร้าง staff ที่ตรวจถอดรหัสผ่านอยู่ใต้ `/Users/keng/.codex/backups/chomdoi-house/2026-09-25T19-00-49-072Z-e3a0fa/`
3. Chrome บน Mac เครื่องนี้ตรวจแล้ว: ไม่พบรายการขายหรือเติมสินค้าที่มีเฉพาะในเครื่อง; โปรไฟล์หลักเก่ากว่า Firestore 18 รายการขายและ 2 รายการเติมสินค้า ความต่างสต็อกอธิบายได้ครบ โปรไฟล์ 3 มี cache เก่าตั้งแต่สิงหาคม ห้ามเขียนทับ Firestore เจ้าของระบบระบุ Windows PC 1 เครื่องและ Android Chrome 1 เครื่อง แล้วสั่งเดินหน้า deploy โดยข้ามการตรวจ cache ของสองเครื่องนี้เมื่อ 26 กันยายน 2026 ข้อมูลเฉพาะเครื่องยังไม่ยืนยันและจะไม่ซิงก์อัตโนมัติภายหลัง ต้องเก็บ Chrome data เดิมและกระทบยอดแยกหากจะกู้รายการ
4. สำรองข้อมูลจริงแบบเข้ารหัสอีกครั้งในช่วงหยุดทำรายการก่อน cutover สำเนาล่าสุดที่รวม staff ทั้ง 5 และตรวจถอดรหัสผ่านอยู่ที่ `/Users/keng/.codex/backups/chomdoi-house/2026-09-25T19-00-49-072Z-e3a0fa/`; ซ้อมกู้คืนข้อมูลร้านแบบตัดรหัสผ่าน/LINE token ใน Firestore Emulator ผ่านแล้ว ตรวจ 14 สินค้า, 1,140 รายการขาย และ 5 staff จากนั้นซ้อมลบ `users`/เพิ่ม `revision` ด้วย update mask และ precondition ผ่าน ยังไม่ได้ซ้อมนำเข้า Auth hash เจ้าของระบบเลือกเก็บสำรองบน Mac เครื่องนี้เท่านั้น หากเครื่องและ Keychain สูญหายพร้อมกันอาจกู้จากสำเนานี้ไม่ได้
5. กำหนดช่วงหยุดทำรายการ ย้าย `users` ออกจากเอกสารร้าน เพิ่ม `revision` และ staff directory แล้วเผยแพร่เว็บกับกฎใหม่อย่างประสานกัน ทำ smoke test ก่อนเปิดให้พนักงานใช้งาน อ่านลำดับและ rollback ใน `SECURITY_ROLLOUT.md`

**อย่ารัน `firebase deploy` ก่อน cutover**: `firebase.json` ใน branch นี้ชี้ `firestore.secure.rules` แล้ว แต่เว็บรุ่นใหม่ยังต้องการข้อมูลร้านที่ลบ `users` และเพิ่ม `revision` การเผยแพร่ก่อนสำรองล่าสุดและย้ายข้อมูลในช่วงหยุดทำรายการ อาจทำให้พนักงานเข้าไม่ได้ ข้อยกเว้นเรื่อง cache สองเครื่องเป็นคำสั่งเจ้าของระบบตาม `SECURITY_ROLLOUT.md`

## ข้อกำหนดที่ยืนยันจากเจ้าของระบบ

- รักษาระบบ 3 กะและเวลาเริ่มวันทำการ 08:00 น. เว้นแต่มีคำขอให้เปลี่ยน
- เก็บ LINE token ในหน้า Settings ตามเดิม ห้ามแสดงค่าจริงในเอกสารหรือ Git และระวังว่า export ของร้านมี token
- อย่า commit ข้อมูลร้านจริง รหัสผ่านพนักงาน LINE token หรือ service account key ลง repository
- การแก้ Production ต้องตรวจผลกระทบกับยอดขาย/สต็อกปัจจุบันและมีวิธีย้อนกลับที่ไม่เขียนข้อมูลเก่าทับรายการใหม่
