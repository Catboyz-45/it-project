-- เพิ่มชนิดเอกสาร "ใบเสร็จรับเงิน" ให้หอแก้ Template ของใบเสร็จได้เหมือนสัญญากับใบแจ้งหนี้
-- เพิ่มค่าใน enum อย่างเดียว ไม่แตะข้อมูลเดิม
ALTER TYPE "DocumentKind" ADD VALUE IF NOT EXISTS 'RECEIPT';
