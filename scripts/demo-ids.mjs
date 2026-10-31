import { createHash } from "node:crypto";

// id ของข้อมูลเดโม ใช้ร่วมกันระหว่าง admin:bootstrap กับ seed:demo
// API ตรวจ id ด้วย z.string().cuid() (ขึ้นต้นด้วย c และห้ามมีขีด) id แบบเดิมอย่าง "demo-room-101"
// จึงโดนตอบ 404 ทุกคำขอ ทั้งที่หน้าเว็บเปิดได้ปกติ
// แปลงคีย์เดิมเป็น id รูปแบบ cuid แบบคงที่ รันซ้ำกี่ครั้งก็ได้ id เดิม สคริปต์จึงยัง upsert ทับของเดิมได้
const salt = "nestly-demo:";
const legacyPattern = "demo-%";

export function demoId(legacyKey) {
  const digest = createHash("md5").update(salt + legacyKey).digest("hex");
  return `c${digest.slice(0, 24)}`;
}

// ฐานข้อมูลที่เคย seed ด้วย id แบบเดิมไว้แล้ว เปลี่ยน id ในที่เดิมแทนการลบแล้วสร้างใหม่
// foreign key ทุกตัวเป็น ON UPDATE CASCADE ข้อมูลที่ผูกอยู่จึงตามไปเองและไม่มีอะไรหาย
// สูตรใน SQL ต้องตรงกับ demoId() ทุกตัวอักษร ไม่งั้นสคริปต์จะหาแถวที่เพิ่งเปลี่ยนไม่เจอ
export async function migrateLegacyDemoIds(query) {
  const tables = await query(
    `SELECT "table_name" FROM information_schema.columns
     WHERE "table_schema" = current_schema() AND "column_name" = 'id' AND "data_type" = 'text'`,
  );
  let renamed = 0;
  for (const { table_name: table } of tables.rows) {
    const result = await query(
      `UPDATE "${table.replaceAll("\"", "\"\"")}" SET "id" = 'c' || substr(md5($1 || "id"), 1, 24) WHERE "id" LIKE $2`,
      [salt, legacyPattern],
    );
    renamed += result.rowCount ?? 0;
  }
  // คอลัมน์ id อ้างอิงบางตัวไม่มี foreign key ให้ cascade ตาม เช่น Floor.propertyId จึงต้องเปลี่ยนเอง
  // ข้าม AuditLog เพราะบันทึกตรวจสอบต้องคงค่าเดิมตามที่เกิดขึ้นจริง ห้ามแก้ย้อนหลัง
  const references = await query(
    `SELECT "table_name", "column_name" FROM information_schema.columns
     WHERE "table_schema" = current_schema() AND "column_name" LIKE '%Id'
       AND "data_type" IN ('text', 'character varying') AND "table_name" <> 'AuditLog'`,
  );
  for (const { table_name: table, column_name: column } of references.rows) {
    const quotedTable = `"${table.replaceAll("\"", "\"\"")}"`;
    const quotedColumn = `"${column.replaceAll("\"", "\"\"")}"`;
    const result = await query(
      `UPDATE ${quotedTable} SET ${quotedColumn} = 'c' || substr(md5($1 || ${quotedColumn}), 1, 24) WHERE ${quotedColumn} LIKE $2`,
      [salt, legacyPattern],
    );
    renamed += result.rowCount ?? 0;
  }
  // ห้องแชทผู้เช่าใช้คีย์ "TENANT:<id ผู้เช่า>" ต้องเปลี่ยนตาม ไม่งั้นเปิดแชทแล้วได้ห้องว่างใหม่ ข้อความเดิมหายจากสายตา
  // ถ้าเผลอเปิดแชทไปก่อนจนเกิดห้องว่างด้วยคีย์ใหม่แล้ว ลบห้องว่างนั้นทิ้ง แล้วใช้ห้องเดิมที่มีประวัติข้อความ
  await query(
    `DELETE FROM "ChatConversation" fresh USING "ChatConversation" legacy
     WHERE legacy."conversationKey" LIKE 'TENANT:demo-%'
       AND fresh."propertyId" = legacy."propertyId"
       AND fresh."conversationKey" = 'TENANT:c' || substr(md5($1 || substr(legacy."conversationKey", 8)), 1, 24)
       AND NOT EXISTS (SELECT 1 FROM "ChatMessage" message WHERE message."conversationId" = fresh."id")`,
    [salt],
  );
  const keys = await query(
    `UPDATE "ChatConversation" SET "conversationKey" = 'TENANT:c' || substr(md5($1 || substr("conversationKey", 8)), 1, 24)
     WHERE "conversationKey" LIKE 'TENANT:demo-%'`,
    [salt],
  );
  return renamed + (keys.rowCount ?? 0);
}
