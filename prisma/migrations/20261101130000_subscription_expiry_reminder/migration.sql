-- จำว่าส่งอีเมลเตือนแพ็กเกจใกล้หมดอายุของวันหมดอายุไหนไปแล้ว งานเบื้องหลังรันทุก 5 นาทีจะได้ไม่ส่งซ้ำ
-- คอลัมน์ว่างได้ แถวเดิมไม่ต้องแก้ และไม่มีข้อมูลหาย
ALTER TABLE "PropertySubscription" ADD COLUMN "expiryReminderSentFor" TIMESTAMPTZ(3);
