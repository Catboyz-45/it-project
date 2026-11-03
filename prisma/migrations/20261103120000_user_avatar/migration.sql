-- รูปโปรไฟล์ของผู้ใช้ เพิ่มคอลัมน์ที่ว่างได้อย่างเดียว ไม่แตะข้อมูลเดิม
ALTER TABLE "User" ADD COLUMN "avatarKey" VARCHAR(255);
