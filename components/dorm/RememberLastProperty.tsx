"use client";
// จำหอที่เปิดล่าสุดไว้ในคุกกี้ เข้าสู่ระบบครั้งหน้าจะได้กลับมาหอเดิม ไม่ใช่หอแรกตามตัวอักษร

import { useEffect } from "react";
import { LAST_PROPERTY_COOKIE } from "@/lib/last-property";

export function RememberLastProperty({ propertyId }: Readonly<{ propertyId: string }>) {
  useEffect(() => {
    // เก็บไว้หนึ่งปี เป็นแค่ค่าความสะดวก ไม่มีข้อมูลลับ จึงไม่ต้อง HttpOnly
    document.cookie = `${LAST_PROPERTY_COOKIE}=${encodeURIComponent(propertyId)}; path=/; max-age=31536000; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
  }, [propertyId]);
  return null;
}
