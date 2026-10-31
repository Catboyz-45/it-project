-- เปลี่ยน id ของข้อมูลเดโมรุ่นเก่า ("demo-property", "demo-room-101" ฯลฯ) ให้เป็นรูปแบบ cuid
-- API ตรวจ id ด้วย z.string().cuid() id แบบเดิมจึงโดนตอบ 404 ทุกคำขอ หอเดโมบนเซิร์ฟเวอร์จริงจึงใช้งานไม่ได้
-- สูตรตรงกับ demoId() ใน scripts/demo-ids.mjs ทุกตัวอักษร สคริปต์ seed รอบหลังจะได้หาแถวเดิมเจอ
--
-- ไม่ลบข้อมูลใด ๆ: foreign key ทุกตัวเป็น ON UPDATE CASCADE แถวที่ผูกอยู่จึงเปลี่ยนตามเอง
-- ฐานข้อมูลที่ไม่มีข้อมูลเดโมรุ่นเก่า (รวมถึงฐานที่เพิ่งสร้างใหม่) ไม่มีแถวไหนตรงเงื่อนไข จึงไม่มีอะไรเปลี่ยน
-- ข้าม AuditLog เพราะบันทึกตรวจสอบต้องคงค่าเดิมตามที่เกิดขึ้นจริง ห้ามแก้ย้อนหลัง
DO $$
DECLARE
  target record;
BEGIN
  -- 1. คีย์หลักของทุกตาราง
  FOR target IN
    SELECT "table_name" FROM information_schema.columns
    WHERE "table_schema" = current_schema()
      AND "column_name" = 'id'
      AND "data_type" = 'text'
      AND "table_name" NOT IN ('AuditLog', '_prisma_migrations')
  LOOP
    EXECUTE format(
      'UPDATE %I SET "id" = ''c'' || substr(md5(''nestly-demo:'' || "id"), 1, 24) WHERE "id" LIKE ''demo-%%''',
      target."table_name"
    );
  END LOOP;

  -- 2. คอลัมน์อ้างอิงที่ไม่มี foreign key ให้ cascade ตาม เช่น Floor.propertyId
  FOR target IN
    SELECT "table_name", "column_name" FROM information_schema.columns
    WHERE "table_schema" = current_schema()
      AND "column_name" LIKE '%Id'
      AND "data_type" IN ('text', 'character varying')
      AND "table_name" NOT IN ('AuditLog', '_prisma_migrations')
  LOOP
    EXECUTE format(
      'UPDATE %I SET %I = ''c'' || substr(md5(''nestly-demo:'' || %I), 1, 24) WHERE %I LIKE ''demo-%%''',
      target."table_name", target."column_name", target."column_name", target."column_name"
    );
  END LOOP;

  -- 3. ห้องแชทผู้เช่าใช้คีย์ "TENANT:<id ผู้เช่า>" ต้องเปลี่ยนตาม ไม่งั้นเปิดแชทแล้วได้ห้องว่างใหม่แทนห้องเดิม
  -- ถ้ามีห้องว่างที่เกิดจากการเปิดแชทด้วย id ใหม่ไปก่อนแล้ว ลบห้องว่างนั้นทิ้ง แล้วใช้ห้องเดิมที่มีประวัติข้อความ
  DELETE FROM "ChatConversation" fresh USING "ChatConversation" legacy
  WHERE legacy."conversationKey" LIKE 'TENANT:demo-%'
    AND fresh."propertyId" = legacy."propertyId"
    AND fresh."conversationKey" = 'TENANT:c' || substr(md5('nestly-demo:' || substr(legacy."conversationKey", 8)), 1, 24)
    AND NOT EXISTS (SELECT 1 FROM "ChatMessage" message WHERE message."conversationId" = fresh."id");

  UPDATE "ChatConversation"
  SET "conversationKey" = 'TENANT:c' || substr(md5('nestly-demo:' || substr("conversationKey", 8)), 1, 24)
  WHERE "conversationKey" LIKE 'TENANT:demo-%';
END $$;
