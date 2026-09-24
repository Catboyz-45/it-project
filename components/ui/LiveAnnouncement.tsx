"use client";
// ใช้ state กับ timer ของเบราว์เซอร์

import { useEffect, useRef, useState } from "react";

// ข้อความที่มองไม่เห็น ไว้ให้โปรแกรมอ่านหน้าจอประกาศ เช่น "เปิดหน้า คลังพัสดุ"
export function LiveAnnouncement({
  message,
  // polite = รอจังหวะว่าง / assertive = ขัดจังหวะทันที ใช้เฉพาะเรื่องด่วน
  politeness = "polite",
}: Readonly<{
  message: string;
  politeness?: "assertive" | "polite";
}>) {
  // แยกจาก message เพราะต้องล้างเป็นค่าว่างก่อนหนึ่งจังหวะ
  const [announcement, setAnnouncement] = useState("");
  // เก็บใน ref เพื่อยกเลิกได้ถ้า message เปลี่ยนก่อนครบเวลา
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // ทิ้ง timer ค้างจากข้อความก่อน จะได้ไม่ประกาศซ้อน
    if (timerRef.current) clearTimeout(timerRef.current);

    // ล้างก่อน เพราะโปรแกรมอ่านหน้าจอประกาศเฉพาะตอนข้อความเปลี่ยน ใส่ซ้ำของเดิมจะเงียบ
    setAnnouncement("");

    // หน่วงให้เบราว์เซอร์เห็นค่าว่างก่อน ถ้าใส่กลับทันที React จะรวบเป็นครั้งเดียว
    if (message) timerRef.current = setTimeout(() => setAnnouncement(message), 50);

    // ถอดคอมโพเนนต์ก่อนครบ 50ms ต้องยกเลิก ไม่งั้น setState หลังถอดแล้ว
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message]);

  // aria-atomic = อ่านทั้งก้อนใหม่ ไม่ใช่เฉพาะส่วนที่ต่าง
  // sr-only = ซ่อนจากสายตา แต่ยังอยู่ใน DOM ให้โปรแกรมอ่านหน้าจอเข้าถึง
  // แบบด่วนต้องเป็น role="alert" ส่วนแบบรอจังหวะว่างใช้ output ซึ่งเป็น status อยู่แล้ว
  if (politeness === "assertive") {
    return <span aria-atomic="true" aria-live="assertive" className="sr-only" role="alert">{announcement}</span>;
  }
  return <output aria-atomic="true" aria-live="polite" className="sr-only">{announcement}</output>;
}
