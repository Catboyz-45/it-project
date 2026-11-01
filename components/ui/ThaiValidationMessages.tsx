"use client";
// ติดตั้งตัวแปลข้อความเตือนของฟอร์มเป็นภาษาไทยครั้งเดียวที่ layout นอกสุด ไม่ต้องแก้ทีละฟอร์ม

import { useEffect } from "react";
import { installThaiValidationMessages } from "@/lib/client/thai-validation";

export function ThaiValidationMessages() {
  useEffect(() => installThaiValidationMessages(document), []);
  return null;
}
