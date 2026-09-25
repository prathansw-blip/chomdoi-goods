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
| Login | ตรวจ username/password ฝั่งเว็บกับ `users` ใน `/stores/chomdoi_main`; Firestore Rules เดิมไม่บังคับ login | Firebase Auth ตรวจรหัสผ่าน และต้องมี `/staff/{uid}` ที่ active; ไม่สร้างบัญชีขณะ login |
| ผู้ใช้ | อยู่ใน array `users` ของเอกสารร้าน รวมข้อมูลรหัสผ่านเดิม | ตั้งใจย้ายบัญชีไป Firebase Auth และข้อมูลพนักงานไป `/staff/{uid}`; การจัดการบัญชีต้องทำผ่านผู้ดูแลที่เชื่อถือได้ ไม่ได้ทำในหน้า Settings |
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
- `firestore.rules`: กฎเดิมที่ `firebase.json` ยังอ้างอยู่
- `firestore.secure.rules`: กฎที่เสนอสำหรับ cutover; `firebase.secure.emulator.json` ใช้ทดสอบเฉพาะ Emulator
- `scripts/migration-plan.mjs`: ฟังก์ชันสร้างแผนจับคู่ผู้ใช้แบบไม่มี network หรือ filesystem access; ไม่ทำ migration จริง
- `scripts/audit-legacy-cache.mjs`, `MIGRATION_PREP.md`: เครื่องมือตรวจข้อมูลค้างในเบราว์เซอร์แบบอ่านอย่างเดียวและขั้นเตรียมข้อมูลก่อนย้ายจริง
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

ผลตรวจล่าสุด (26 กันยายน 2026): Emulator tests **36/36 ผ่าน** จาก 7 ไฟล์; `npm run build` ผ่านและมีคำเตือน JavaScript chunk เกิน 500 kB ไม่มีการใช้ Firestore Production ในการทดสอบเหล่านี้ UI จำลองเคยทดสอบล็อกอิน admin/cashier เปิดกะ ขาย เติมของ และรับข้อมูลในแท็บที่สองแล้ว รอบนี้ทดสอบเพิ่มการเปลี่ยนสิทธิ์และปิดบัญชีขณะใช้งาน, เพิ่ม/แก้/ลบสินค้าและหมวด, บันทึก Settings รวมถึง LINE token จำลอง, และการชนกันของการแก้ราคาสินค้า: ระบบปฏิเสธค่าที่ล้าสมัยและแสดงค่าล่าสุดหลังปิดฟอร์ม เมื่อหยุด Firestore Emulator ชั่วคราวระหว่างบันทึก เว็บยังไม่แสดงผลสำเร็จหรือราคาใหม่; เมื่อเปิด Emulator กลับ รายการจึงถูกยืนยัน และตรวจราคาในฐานข้อมูลจำลองแล้ว อีกกรณีใช้ proxy ตัดเฉพาะเว็บเครื่องแรก เครื่องที่สองแก้ราคาได้ระหว่างนั้น เมื่อเครื่องแรกต่อกลับ การแก้จากข้อมูลเก่าถูกปฏิเสธพร้อมข้อความค้างในฟอร์ม และสุดท้ายแสดงราคาของเครื่องที่สองตรงกับฐานข้อมูลจำลอง ไฟล์ Export ดาวน์โหลดจริง เปิด JSON ได้ และแก้ชื่อไฟล์ให้ใช้วันที่ท้องถิ่นแล้ว

## งานที่ยังต้องทำก่อนขึ้น Production

1. เก็บรายการ UI เส้นทางอื่นที่ยังไม่ได้ทดสอบก่อน cutover และทดสอบซ้ำหลังแก้โค้ดหรือเตรียมข้อมูลย้ายจริง โดยใช้ข้อมูลจำลองและตรวจผลใน Firestore Emulator
2. เตรียม Firebase Auth account และ `/staff/{uid}` สำหรับพนักงานที่ได้รับอนุมัติ ตรวจบัญชีเดิม/บัญชี Auth ที่จับคู่ไม่ได้ โดยไม่คัดลอกรหัสผ่านลงเอกสารใหม่ หน้า Settings รุ่นใหม่ไม่มีฟังก์ชันเพิ่มหรือเปลี่ยนรหัสผ่านพนักงาน
3. Chrome บน Mac เครื่องนี้ตรวจแล้ว: ไม่พบรายการขายหรือเติมสินค้าที่มีเฉพาะในเครื่อง; โปรไฟล์หลักเก่ากว่า Firestore 18 รายการขายและ 2 รายการเติมสินค้า ความต่างสต็อกอธิบายได้ครบ โปรไฟล์ 3 มี cache เก่าตั้งแต่สิงหาคม ห้ามเขียนทับ Firestore หากมีเครื่องอื่นที่เคยใช้ระบบเดิมต้องตรวจแยก เพราะ client ใหม่ไม่โหลด cache ยอดขายเก่ามาใช้
4. สำรองข้อมูลจริงแบบเข้ารหัสอีกครั้งในช่วงหยุดทำรายการก่อน cutover และทดสอบกู้คืน สำเนาที่ตรวจถอดรหัสผ่านอยู่ที่ `/Users/keng/.codex/backups/chomdoi-house/2026-09-25T18-36-42-543Z-60b8a5/`; เจ้าของระบบเลือกเก็บบน Mac เครื่องนี้เท่านั้น หากเครื่องและ Keychain สูญหายพร้อมกันอาจกู้จากสำเนานี้ไม่ได้
5. กำหนดช่วงหยุดทำรายการ ย้าย `users` ออกจากเอกสารร้าน เพิ่ม `revision` และ staff directory แล้วเผยแพร่เว็บกับกฎใหม่อย่างประสานกัน ทำ smoke test ก่อนเปิดให้พนักงานใช้งาน อ่านลำดับและ rollback ใน `SECURITY_ROLLOUT.md`

**อย่ารัน `firebase deploy` จาก branch นี้โดยตรง**: `firebase.json` ยังชี้ `firestore.rules` แบบเดิมที่เปิดอ่าน/เขียนสาธารณะ ส่วนเว็บรุ่นใหม่ต้องมี Firebase Auth, staff directory และข้อมูลร้านที่ย้ายแล้ว การ deploy แยกส่วนอาจทำให้พนักงานเข้าไม่ได้หรือปล่อยข้อมูลเปิดอยู่

## ข้อกำหนดที่ยืนยันจากเจ้าของระบบ

- รักษาระบบ 3 กะและเวลาเริ่มวันทำการ 08:00 น. เว้นแต่มีคำขอให้เปลี่ยน
- เก็บ LINE token ในหน้า Settings ตามเดิม ห้ามแสดงค่าจริงในเอกสารหรือ Git และระวังว่า export ของร้านมี token
- อย่า commit ข้อมูลร้านจริง รหัสผ่านพนักงาน LINE token หรือ service account key ลง repository
- การแก้ Production ต้องตรวจผลกระทบกับยอดขาย/สต็อกปัจจุบันและมีวิธีย้อนกลับที่ไม่เขียนข้อมูลเก่าทับรายการใหม่
