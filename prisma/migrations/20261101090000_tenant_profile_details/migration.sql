-- ช่องข้อมูลผู้เช่าที่หน้าจอให้กรอกอยู่แล้ว แต่ก่อนหน้านี้ไม่มีที่เก็บ ข้อมูลที่กรอกจึงหายไปตอนบันทึก
-- เพิ่มเป็นคอลัมน์ที่ว่างได้ทั้งหมด แถวเดิมไม่ต้องแก้และไม่มีข้อมูลหาย
ALTER TABLE "TenantProfile"
  ADD COLUMN "namePrefix" VARCHAR(20),
  ADD COLUMN "nickname" VARCHAR(60),
  ADD COLUMN "nationality" VARCHAR(60),
  ADD COLUMN "nationalId" VARCHAR(20),
  ADD COLUMN "birthDate" DATE,
  ADD COLUMN "lineId" VARCHAR(60),
  ADD COLUMN "occupation" VARCHAR(120),
  ADD COLUMN "organization" VARCHAR(160),
  ADD COLUMN "studentOrEmployeeId" VARCHAR(40),
  ADD COLUMN "emergencyRelation" VARCHAR(60);

ALTER TABLE "RoomOccupancy" ADD COLUMN "ownerNote" VARCHAR(2000);
