# Chomdoi Goods — คู่มือรับช่วงงาน

อัปเดต: 26 กันยายน 2026 ระบบ Production ใช้ build จาก application commit `13c9112` หลังเผยแพร่ dependency security patch เฉพาะ Firebase Hosting เวลา 15:00 น. ไทย โค้ดหน้าจอ/การกรอกข้อมูล โครงสร้างข้อมูล และ secure Rules ไม่เปลี่ยนจากรุ่น cutover `22370b5` ที่เจ้าของยืนยันว่า admin เข้าได้และสต็อกตรงกันทุกเครื่องแล้ว รวมประวัติ cutover และแพตช์เข้า `main` เพื่อใช้เป็นจุดเริ่มพัฒนาต่อ

## เริ่มจากตรงไหน

| รายการ | สถานะ |
| --- | --- |
| Repository | `https://github.com/prathansw-blip/chomdoi-goods` |
| `main` / `origin/main` | รวมรุ่นที่ใช้งานจริงและ dependency security patch แล้ว; ตรวจ `git log -1` สำหรับ commit ล่าสุด; application commit ที่ deploy คือ `13c9112` |
| `codex/secure-sync-prep` | เก็บประวัติงาน cutover; มี Firebase Auth, transaction สำหรับหลายเครื่อง, กฎ staff และ Emulator tests |
| Checkout หลักบนเครื่องนี้ | `/Users/keng/Documents/AI Project/Chomdoi Goods - Codex` อยู่บน `main` |
| Worktree ประวัติ cutover | `/Users/keng/.codex/worktrees/chomdoi-emulator-tests/Chomdoi Goods - Codex` อยู่บน `codex/secure-sync-prep` |
| สถานะ release | Cutover Hosting และ secure Rules เวลา 10:43 น. ไทย; เจ้าของยืนยัน admin เข้าได้เวลา 11:04 น. และสต็อกตรงทุกเครื่อง; เผยแพร่ dependency patch เฉพาะ Hosting เวลา 15:00 น. ไทยเมื่อ 26 กันยายน 2026 ตรวจไฟล์เว็บจริงตรงกับ build แล้ว |

เริ่มงานพัฒนาต่อจาก `main` ที่ checkout หลักข้างต้น หรือสร้าง branch `codex/<ชื่องาน>` จาก `main` สำหรับงานใหม่ ตรวจ branch ด้วย `git status -sb` ก่อนแก้ไฟล์ เอกสาร HANDOFF รุ่นก่อน cutover ที่เคยค้างใน checkout หลักเก็บไว้ใน Git stash ชื่อ `Preserve pre-cutover local handoff before main fast-forward` และตรงกับเอกสารที่มีอยู่ในประวัติ Git แล้ว ไฟล์ cache ของ Firebase CLI และ `.serena/` เป็นข้อมูลเฉพาะเครื่องและถูก ignore

ระบบเป็น Vite SPA สำหรับ POS, สต็อก, การเติมสินค้า, กะ, ของใช้โรงแรม และตั้งค่า Production อยู่บน Firebase Hosting ของโปรเจกต์ `chomdoi-house` ที่ `https://chomdoi-house.web.app` รอบ cutover ตรวจ Rules source ผ่าน Firebase API ว่าตรงกับ `firestore.secure.rules` กฎที่เผยแพร่คือ ruleset `0725e012-e807-4a19-9e7a-6fac61c41aa9` รอบ dependency patch เผยแพร่เฉพาะ Hosting และเทียบ SHA256 ของ HTML, JS, CSS และ SVG ทั้ง 5 ไฟล์กับ build ตรงกัน ไม่ deploy หรือตรวจ Rules API ซ้ำในรอบนี้

## สองรุ่นทำงานต่างกันอย่างไร

| เรื่อง | ระบบเดิมที่ commit `3a5a816` | `main` / Production ปัจจุบัน |
| --- | --- | --- |
| Login | พนักงานกรอก username/password ใน webapp; เว็บตรวจกับ `users` ใน `/stores/chomdoi_main`; Firestore Rules เดิมไม่บังคับ login | พนักงานยังกรอก username/password ในหน้า webapp Chomdoi Goods; Firebase Auth ตรวจรหัสผ่านเบื้องหลัง และต้องมี `/staff/{uid}` ที่ active; พนักงานไม่เข้า Firebase Console และเว็บไม่สร้างบัญชีขณะ login |
| ผู้ใช้ | ยังอยู่ใน array `users` ของเอกสารร้าน รวมข้อมูลรหัสผ่านเดิม | ใช้ Firebase Auth เดิมและ `/staff/{uid}` 5 รายการแล้ว; ลบ `users` ออกจากเอกสารร้านแล้ว การจัดการบัญชีต้องทำผ่านผู้ดูแลที่เชื่อถือได้ ไม่ได้ทำในหน้า Settings |
| การเขียน | มีการเขียนเอกสารร้านจากข้อมูลในเครื่อง ซึ่งเสี่ยงข้อมูลเก่าทับใหม่ | แต่ละรายการอ่านข้อมูลล่าสุดใน Firestore transaction, เปลี่ยนเฉพาะ top-level fields ที่เกี่ยวข้อง แล้วเพิ่ม `revision`; แจ้งสำเร็จหลัง Firestore ยืนยัน |
| การอ่านข้ามเครื่อง | `onSnapshot` อัปเดตหน้าเว็บ แต่ไม่ได้ป้องกันการเขียนทับ | `onSnapshot` และ `revision` ช่วยรับข้อมูลล่าสุด; ถ้าแก้ระเบียนเดียวกันจากข้อมูลเก่า จะแจ้ง `SYNC_CONFLICT` |
| Firestore Rules | `firestore.rules` อนุญาตผู้ไม่ล็อกอินอ่านและเขียน `/stores/chomdoi_main` ตามเงื่อนไขของกฎ | `firestore.secure.rules` deploy แล้ว; ผู้ไม่ล็อกอินอ่านร้านไม่ได้ และพนักงาน active ทั้ง 4 บัญชีที่ตรวจเข้าอ่านได้ |
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

## คำสั่งพัฒนาต่อจากรุ่นปัจจุบัน

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

หลังรวมเข้า `main` ติดตั้งด้วย `npm ci` ใน checkout หลักและตรวจ `npm run build` ผ่านอีกครั้ง ไฟล์ JS `index-jyccpGvU.js` และ CSS `index-BZ0AbyTV.css` มี SHA256 ตรงกับหลักฐาน deploy เดิม ไม่มีการ deploy เพิ่มหรือเชื่อมข้อมูล Production ระหว่าง build ไม่รันทดสอบ Emulator ซ้ำในรอบรวม Git เพราะโค้ดแอป/Rules/lockfile ไม่เปลี่ยนจากรุ่นที่ทดสอบและ deploy แล้ว

แก้ dependency security patch แล้วเมื่อ 26 กันยายน 2026: Vite `8.0.16`, `@grpc/grpc-js` `1.9.16`, `websocket-driver` `0.7.5`, `protobufjs` `7.6.6`, `@protobufjs/utf8` `1.1.2`, PostCSS `8.5.28` และ nanoid `3.3.19` หลังติดตั้งใหม่ด้วย `npm ci` ผล `npm audit` เป็น **0 vulnerabilities** ตามฐานข้อมูล advisory ณ วันที่ตรวจ โดยคง Firebase `12.12.1`, Chart.js `4.5.1` และ Firebase app/auth/firestore SDK เดิม ไม่แก้ source ของหน้าจอ ฟอร์ม การคำนวณ หรือ Rules ดูขอบเขตและวิธีย้อนกลับใน `SECURITY_ROLLOUT.md`

ผลทดสอบหลัง patch: Emulator tests **45/45 ผ่าน** จาก 10 ไฟล์ และ production build ผ่าน (ยังมีคำเตือน chunk เกิน 500 kB) ไฟล์ CSS ตรงกับเดิม; JS ใหม่เป็น `index-BH2jw8ZS.js` ซึ่งต่างจากรุ่นก่อนแพตช์ ทดสอบ UI บน `demo-chomdoi-tests` ผ่านทั้ง admin และ cashier: เปิดกะ ขายสินค้า 1 ชิ้น (สต็อก 20 → 19), ตรวจข้อความภาษาไทย/emoji จากฟอร์มเท่ากับข้อมูลที่อ่านกลับจาก Emulator, เติม 3 ชิ้น (19 → 22), และยืนยันหน้าจอที่สองรับรายการ/สต็อกใหม่โดยไม่ reload มีภาพหลักฐานข้อมูลจำลองบน Mac ที่ `/Users/keng/.codex/backups/chomdoi-house/dependency-security-2026-09-26-ui.png` ปิดแท็บทดสอบและ Emulators แล้ว ไม่มีการอ่าน/เขียนข้อมูล Production ส่ง LINE หรือ deploy ระหว่างรอบแก้และทดสอบแพตช์ก่อนเผยแพร่

เจ้าของอนุมัติและเผยแพร่แพตช์เฉพาะ Hosting แล้วเมื่อ 26 กันยายน 2026 เวลา 15:00:17 น. ไทยจาก `13c9112` รุ่น Hosting `485992fc0f17872a` ตรวจไฟล์เว็บจริงทั้ง 5 ไฟล์ตรงกับ build ทุก byte พร้อมตรวจ SPA rewrite และ header ของ HTML/JS/CSS โดยใช้คำขอสาธารณะ ไม่รันเบราว์เซอร์ที่ล็อกอิน ไม่อ่าน/เขียน Firestore ไม่เปลี่ยน Auth หรือส่ง LINE สำรองไฟล์เว็บเดิม รุ่นใหม่ หลักฐาน และวิธีย้อนกลับเฉพาะ Hosting ไว้ที่ `/Users/keng/.codex/backups/chomdoi-house/dependency-hosting-2026-09-26T08-00-01.390Z/` รุ่น Hosting ก่อนแพตช์คือ `1b36ddb7160f2d62`; ไม่ต้องกู้ฐานข้อมูลเพื่อย้อนแพตช์นี้

## ผล cutover และงานที่ยังต้องทำ

- เจ้าของระบบยืนยันว่าหยุดทำรายการทุกเครื่องแล้ว จึง deploy maintenance rules, ตรวจว่าปิดการอ่านจริง, ตรวจ roster และสำรองล่าสุด แล้วลบเฉพาะ `users`/เพิ่ม `revision: 0` ด้วย update mask และ `updateTime` precondition อ่านกลับและเทียบทุกฟิลด์อื่นตรงกัน สินค้า 14 รายการและรายการขาย 1,143 รายการไม่เปลี่ยน รวมถึง Settings และ LINE token
- เผยแพร่ Hosting และ `firestore.secure.rules` แล้ว ตรวจไฟล์เว็บจริงตรงกับ build และ Rules source ตรงกับ repository ผู้ไม่ล็อกอินถูกปฏิเสธด้วย 403 บัญชี `ho`, `jom`, `wan`, `liyah` ล็อกอินด้วยรหัสเดิมและอ่าน staff/store ได้ ไม่ได้สร้างหรือลบบัญชี Auth และไม่ได้เปลี่ยนรหัสผ่าน
- **เจ้าของยืนยันว่า `admin` เข้า webapp ได้ปกติแล้ว** เมื่อ 26 กันยายน 2026 เวลา 11:04 น. ไทย หลังเคยรายงานว่าเข้าไม่ได้ ยังไม่มีหลักฐานยืนยันสาเหตุของความล้มเหลวครั้งแรก จึงไม่สรุปว่ารหัสผิดหรือเกิดจากการเผยแพร่ Rules หน้าตรวจส่วนตัวไม่ได้ส่งผลตรวจหรือสร้างบันทึกเปลี่ยนรหัส และ process ปิดแล้ว; Codex ไม่ได้รีเซ็ตรหัสผ่านหรือ deploy โค้ดแก้ login ในช่วงนี้ ไม่มีรายการขายจำลองหรือการแก้สต็อกถูกเขียนลง Production ระหว่าง smoke test; การทดสอบธุรกรรมพร้อมกันใช้ Emulator
- สำรองก่อนย้ายที่ `/Users/keng/.codex/backups/chomdoi-house/2026-09-26T03-41-30-259Z-e410f9/` และหลังย้ายที่ `/Users/keng/.codex/backups/chomdoi-house/2026-09-26T03-43-14-974Z-dab1f4/` เข้ารหัสและตรวจถอดรหัสครบ Firestore, staff 5 รายการ, Auth 11 บัญชี, hash config และ Rules กุญแจอยู่ใน Mac Keychain ซ้อมกู้คืนสำเนาวันที่ 25 กันยายนแบบตัดข้อมูลลับใน Emulator ผ่านแล้ว แต่ยังไม่ได้ซ้อมนำเข้า Auth hash
- Windows PC 1 เครื่องและ Android Chrome 1 เครื่องยังไม่ได้ตรวจ cache ตามคำสั่งเจ้าของระบบที่ให้ข้ามก่อน deploy เว็บใหม่เก็บสำเนารายการเดิมแบบตัดข้อมูลลับก่อนเริ่มแอป แต่ยังไม่ยืนยันสำเนาบนอุปกรณ์จริง ข้อมูลเก่าเฉพาะเครื่องจะไม่ซิงก์อัตโนมัติ และห้ามนำ export เก่าทั้งเอกสารทับฐานกลาง
- **เจ้าของตรวจทุกเครื่องแล้วและยืนยันว่าสต็อกตรงกัน** เมื่อ 26 กันยายน 2026 ผลนี้ยืนยันสต็อกที่แสดงในเว็บตามการตรวจของเจ้าของ ยังไม่ใช่การกระทบยอดประวัติขายหรือ cache เก่า Windows/Android จึงเก็บ Chrome data ต่อไว้สำหรับตรวจรายการเฉพาะเครื่องหากพบภายหลัง การตรวจสต็อกไม่ได้เพิ่มหรือแก้ข้อมูล Production โดย Codex
- ใช้รุ่นใหม่และพัฒนาต่อจาก `main` ได้แล้ว ทดสอบด้วย Emulator และสำรองก่อนแก้ Production อ่านวิธีกู้คืนที่ `SECURITY_ROLLOUT.md` อย่าเผยแพร่ `firestore.rules` แบบเดิมกลับไป

## ข้อกำหนดที่ยืนยันจากเจ้าของระบบ

- รักษาระบบ 3 กะและเวลาเริ่มวันทำการ 08:00 น. เว้นแต่มีคำขอให้เปลี่ยน
- เก็บ LINE token ในหน้า Settings ตามเดิม ห้ามแสดงค่าจริงในเอกสารหรือ Git และระวังว่า export ของร้านมี token
- อย่า commit ข้อมูลร้านจริง รหัสผ่านพนักงาน LINE token หรือ service account key ลง repository
- การแก้ Production ต้องตรวจผลกระทบกับยอดขาย/สต็อกปัจจุบันและมีวิธีย้อนกลับที่ไม่เขียนข้อมูลเก่าทับรายการใหม่
