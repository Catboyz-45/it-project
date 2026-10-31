-- บิลเดโมรุ่นเก่าสร้างจากสคริปต์ seed ที่ใส่แค่ total ไม่ได้ใส่ subtotal (ค่าเริ่มต้นเป็น 0)
-- พอเลยกำหนดชำระ งานคิดค่าปรับคำนวณยอดใหม่เป็น subtotal + ค่าปรับ ยอดบิลจึงกลายเป็น 0
-- ผู้เช่าเห็นบิลยอด ฿0 และส่งสลิปไม่ได้ เพราะฐานข้อมูลไม่รับหลักฐานการชำระยอดศูนย์
--
-- แก้เฉพาะบิลที่ subtotal เป็น 0 แต่มีรายการค่าใช้จ่ายรวมมากกว่า 0 ซึ่งเป็นไปไม่ได้กับบิลที่ระบบสร้างเอง
-- เพราะระบบตั้ง subtotal จากผลรวมรายการทุกครั้ง บิลจริงจึงไม่ตรงเงื่อนไขและไม่ถูกแตะ
-- ไม่ลบข้อมูลใด ๆ ค่าปรับเดิมยังอยู่และนำมาบวกกลับเข้ายอดรวม
UPDATE "Invoice" AS invoice
SET "subtotal" = items."amount",
    "total" = items."amount" + invoice."lateFee"
FROM (
  SELECT "invoiceId", SUM("amount") AS "amount"
  FROM "InvoiceItem"
  WHERE "type" <> 'LATE_FEE'
  GROUP BY "invoiceId"
) AS items
WHERE items."invoiceId" = invoice."id"
  AND invoice."subtotal" = 0
  AND items."amount" > 0;
