/**
 * คำอธิบายกฎ SonarQube เป็นภาษาไทย — "ปัญหาคืออะไร" กับ "โปรเจกต์นี้แก้ด้วยวิธีไหน"
 *
 * ช่อง fix เขียนตามที่แก้จริงใน Nestly ไม่ใช่คำแนะนำทั่วไปของกฎ
 * กฎที่เจอเฉพาะในโฟลเดอร์ deliverables/ (สคริปต์ทำคู่มือ ไม่ใช่โค้ดของระบบ) ไม่ได้แก้ แต่ตัดออกจากการสแกน
 */
const EXCLUDED = "ไม่ได้แก้ — ทุกข้อของกฎนี้อยู่ในสคริปต์ถ่ายภาพหน้าจอทำคู่มือใน deliverables/ ซึ่งไม่ใช่โค้ดของระบบและไม่ได้อยู่ใน git จึงตัดออกจากการสแกน (sonar.exclusions)";

const ruleGuide = {
  S1874: {
    problem: "ใช้ API ที่ประกาศเลิกใช้แล้ว (deprecated) — Zod 4 เลิกใช้ z.string().cuid() และ z.string().date() อาจหายไปในเวอร์ชันถัดไป",
    fix: "สร้าง recordIdSchema ใน lib/domain/record-id.ts ใช้รูปแบบตรวจเดียวกับ cuid ของ Zod ทุกตัวอักษร แล้วใช้แทนทั้ง 56 จุด (ไม่ใช้ cuid2 ที่ Zod แนะนำ เพราะรูปแบบต่างจาก id ที่ Prisma สร้าง) · เปลี่ยน .date() เป็น z.iso.date() · เลิกใช้ event.returnValue ใน beforeunload",
  },
  S7784: {
    problem: "ใช้ JSON.parse(JSON.stringify(x)) คัดลอกข้อมูล — SonarQube แนะนำ structuredClone()",
    fix: "รวมไว้ที่ helper toClientData ใน lib/server/client-data.ts ที่เดียวพร้อมเทสต์ ไม่ใช้ structuredClone เพราะจุดประสงค์คือแปลง Date และ Decimal ของ Prisma เป็นสตริงก่อนส่งให้ Client Component ซึ่ง structuredClone ไม่ทำ",
  },
  S7772: {
    problem: "import โมดูลในตัวของ Node โดยไม่ใส่ node: นำหน้า (เช่น fs แทน node:fs)",
    fix: EXCLUDED,
  },
  S7778: {
    problem: "เรียก Array#push() ติดกันหลายครั้ง แทนการ push หลายค่าในครั้งเดียว",
    fix: EXCLUDED,
  },
  S1854: {
    problem: "กำหนดค่าให้ตัวแปรแล้วไม่เคยใช้ค่านั้น",
    fix: EXCLUDED,
  },
  S1481: {
    problem: "ประกาศตัวแปรไว้แต่ไม่ได้ใช้",
    fix: EXCLUDED,
  },
  S6819: {
    problem: "ใส่ role ของ ARIA ให้ div/section แทนการใช้แท็ก HTML ที่มีความหมายนั้นอยู่แล้ว (เช่น role=\"dialog\" แทน <dialog>)",
    fix: "ปฏิทิน แชท และแผงแจ้งเตือนเปลี่ยนเป็น <dialog open> พร้อมล้างค่าเริ่มต้นของเบราว์เซอร์ใน CSS · ปุ่มเลือกรอบบิลใช้ <fieldset> + <legend> · ข้อความสถานะใช้ aria-live แทน role=\"status\" (ข้างในมี <p> จึงใช้ <output> ไม่ได้) · ฉากหลังของ Dialog ผูก mousedown ที่ DOM แทน role=\"presentation\" · ตัวแก้ไข rich text คง role=\"textbox\" ไว้ (มีเหตุผลรายข้อ)",
  },
  S6852: {
    problem: "element ที่มี role ให้กดได้ (tablist, menu, listbox) แต่โฟกัสด้วยคีย์บอร์ดไม่ได้",
    fix: "ใส่ tabIndex={-1} ให้กล่องที่มี role เหล่านี้ โฟกัสด้วยโค้ดได้แต่ไม่เพิ่มจุดหยุดของปุ่ม Tab แท็บข้างในยังเลื่อนโฟกัสแบบเดิม",
  },
  S2068: {
    problem: "สงสัยว่ามีรหัสผ่านฝังอยู่ในโค้ด เพราะเจอคำว่า PASSWORD",
    fix: "ตรวจแล้วเป็น false positive — lib/ui-labels.ts เป็นตารางแปลงชื่อเหตุการณ์ audit เช่น PASSWORD_RESET_REQUEST เป็นคำไทย ไม่มีรหัสผ่านจริง ยกเว้นกฎนี้เฉพาะไฟล์นั้นใน sonar-project.properties พร้อมเหตุผล",
  },
  S8786: {
    problem: "regex ที่ทำงานช้าแบบกำลังสอง (backtracking) เมื่อเจอข้อความที่ไม่ตรงรูปแบบ",
    fix: "สคริปต์ OpenAPI เปลี่ยนจาก regex ที่สแกนทั้งพาธเป็นการตัดพาธทีละส่วนแล้วเทียบด้วย string ตรวจแล้วว่าได้ผลเหมือนเดิมทั้ง 116 route",
  },
  S6481: {
    problem: "ค่า value ของ Context Provider เป็น object ที่สร้างใหม่ทุกครั้งที่ render ทำให้ทุกคอมโพเนนต์ที่ใช้ context render ซ้ำ",
    fix: "TenantPortal ครอบด้วย useMemo และทำ refreshAccount เป็น useCallback · DormDashboard ตั้งใจไม่แก้ (มีเหตุผลรายข้อ)",
  },
  S3358: {
    problem: "ternary ซ้อนกัน (a ? b : c ? d : e) อ่านยากและแก้ผิดได้ง่าย",
    fix: "NavShell เปลี่ยนเป็นเลือกชุดข้อความตามขนาดจอก่อน แล้วค่อยเลือกข้อความตามสถานะเมนู · ข้อที่อยู่ใน deliverables/ ไม่ได้แก้ (ตัดออกจากการสแกน)",
  },
  S7780: {
    problem: "สตริงที่ต้องเขียนเครื่องหมายแบ็กสแลชซ้อนกันเพื่อ escape ควรใช้ String.raw ให้อ่านง่ายกว่า",
    fix: EXCLUDED,
  },
  S3776: {
    problem: "ฟังก์ชันมีความซับซ้อนเชิงความคิด (Cognitive Complexity) เกิน 15 อ่านและทดสอบยาก",
    fix: "parseNotificationReadState แยกการอ่านรูปแบบเก่ากับรูปแบบปัจจุบันเป็นฟังก์ชันย่อย ผลเหมือนเดิม (เทสต์เดิมผ่านครบ) · ข้อที่อยู่ใน deliverables/ ไม่ได้แก้ (ตัดออกจากการสแกน)",
  },
  S2681: {
    problem: "if ที่ไม่มีวงเล็บปีกกา บรรทัดที่ย่อหน้าตามมาดูเหมือนอยู่ในเงื่อนไขแต่จริง ๆ ไม่อยู่",
    fix: EXCLUDED,
  },
  S7924: {
    problem: "สีข้อความกับพื้นหลังต่างกันไม่พอตามเกณฑ์การเข้าถึง (หรือคำนวณไม่ได้เพราะพื้นหลังโปร่งแสง)",
    fix: "ปุ่มเลือกไฟล์เปลี่ยนพื้นหลังม่วงโปร่ง 10% เป็นสีทึบ #eef0fe ที่หน้าตาเท่าเดิมบนพื้นขาว ความต่างของสีกับตัวอักษร 6.1:1",
  },
  S6847: {
    problem: "ใส่ตัวดักคีย์บอร์ดให้ element ที่ไม่ใช่ส่วนที่กดได้",
    fix: "DatePicker เอา onKeyDown ของกล่องปฏิทินออก เพราะการกด Esc ถูกดักที่ระดับ document อยู่แล้ว (ทำงานก่อนและหยุด event ไว้ ตัวดักเดิมจึงไม่เคยทำงาน)",
  },
  S6848: {
    problem: "element ที่ไม่ใช่ปุ่มหรือลิงก์จริงแต่มีตัวดักการกด คีย์บอร์ดและโปรแกรมอ่านหน้าจอเข้าไม่ถึง",
    fix: "IconLink บังคับให้ต้องส่ง href เสมอ และใส่ href ให้ <a> โดยตรง ลิงก์จึงเป็นลิงก์จริงทุกครั้ง",
  },
  S6698: {
    problem: "มีรหัสผ่าน PostgreSQL ฝังอยู่ในโค้ดหรือไฟล์ตั้งค่า",
    fix: "prisma.config.ts เอาชื่อผู้ใช้และรหัสผ่านออกจากค่าสำรอง ค่าจริงมาจาก DATABASE_URL เท่านั้น · ฐานข้อมูลชั่วคราวของ CI เปลี่ยนเป็น trust จึงไม่มีรหัสผ่านใน ci.yml · ตัด .env ออกจากการสแกน",
  },
  S4624: {
    problem: "template literal ซ้อนกันใน template literal อีกชั้น อ่านยาก",
    fix: "scripts/demo-ids.mjs แยกค่า hash ออกเป็นตัวแปรก่อน แล้วค่อยประกอบสตริงชั้นเดียว",
  },
  S5332: {
    problem: "ใช้ http:// ซึ่งไม่เข้ารหัสการเชื่อมต่อ",
    fix: "scripts/maintenance-worker.mjs เลิกใช้ http:// เป็นค่าเริ่มต้น บังคับให้ระบุ JOB_ENDPOINT เอง (docker-compose ตั้งไว้แล้ว) และตรวจว่าเป็น URL ที่ถูกต้อง",
  },
};

export default ruleGuide;
