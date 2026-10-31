-- บัญชีธนาคารรับค่าเช่าของแต่ละหอ ผู้เช่าเห็นในหน้าชำระบิลคู่กับ QR พร้อมเพย์
-- เป็นคอลัมน์ที่ว่างได้ทั้งหมด หอเดิมไม่ต้องแก้และไม่มีข้อมูลหาย
ALTER TABLE "PropertySettings"
  ADD COLUMN "bankName" VARCHAR(80),
  ADD COLUMN "bankAccountNumber" VARCHAR(20),
  ADD COLUMN "bankAccountName" VARCHAR(160);

-- บัญชีรับค่าแพ็กเกจของแพลตฟอร์ม เก็บแถวเดียว ล็อก id ไว้ที่ 'default' กันมีหลายชุดจนไม่รู้ว่าใช้อันไหน
CREATE TABLE "PlatformPaymentSettings" (
  "id" VARCHAR(20) NOT NULL DEFAULT 'default',
  "bankName" VARCHAR(80),
  "bankAccountNumber" VARCHAR(20),
  "bankAccountName" VARCHAR(160),
  "promptPayId" VARCHAR(20),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PlatformPaymentSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformPaymentSettings_singleton" CHECK ("id" = 'default')
);
