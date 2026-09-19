"use client";
// ต้องเป็น Client Component เพราะใช้ state และ timer ของเบราว์เซอร์

import { useEffect, useRef, useState } from "react";

// วางข้อความที่มองไม่เห็นไว้ให้โปรแกรมอ่านหน้าจอประกาศ เช่น "เปิดหน้า คลังพัสดุ"
// ผู้ใช้ที่มองเห็นรู้อยู่แล้วว่าหน้าเปลี่ยน แต่คนที่ใช้โปรแกรมอ่านหน้าจอไม่รู้ถ้าไม่มีใครบอก
export function LiveAnnouncement({
  message,
  // polite = รอให้ผู้ใช้ว่างก่อนค่อยประกาศ / assertive = ขัดจังหวะทันที ใช้เฉพาะเรื่องด่วน
  politeness = "polite",
}: {
  message: string;
  politeness?: "assertive" | "polite";
}) {
  // แยกข้อความที่ประกาศจริงออกจาก message ที่รับเข้ามา เพราะต้องล้างให้ว่างก่อนหนึ่งจังหวะ
  const [announcement, setAnnouncement] = useState("");
  // เก็บ timer ไว้ใน ref เพื่อยกเลิกได้ ถ้า message เปลี่ยนก่อนครบเวลา
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // ทิ้ง timer ที่ค้างจากข้อความก่อนหน้า จะได้ไม่ประกาศซ้อนกัน
    if (timerRef.current) clearTimeout(timerRef.current);

    // ล้างเป็นค่าว่างก่อน คือจุดสำคัญของไฟล์นี้
    // โปรแกรมอ่านหน้าจอประกาศก็ต่อเมื่อข้อความเปลี่ยน ถ้าใส่ข้อความเดิมซ้ำมันจะเงียบ
    setAnnouncement("");

    // หน่วง 50ms ให้เบราว์เซอร์ทันรับรู้ว่าค่าว่างไปแล้ว ก่อนใส่ข้อความจริงกลับเข้าไป
    // ถ้าใส่กลับทันที React จะรวบเป็นการเปลี่ยนครั้งเดียวและจะไม่มีการประกาศ
    if (message) timerRef.current = setTimeout(() => setAnnouncement(message), 50);

    // ถ้าคอมโพเนนต์ถูกถอดก่อนครบ 50ms ต้องยกเลิก timer ไม่งั้นจะ setState หลังถอดแล้ว
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message]);

  return (
    <span
      // อ่านข้อความทั้งก้อนใหม่ ไม่ใช่อ่านเฉพาะส่วนที่ต่างจากเดิม
      aria-atomic="true"
      // บอกเบราว์เซอร์ว่าบริเวณนี้เปลี่ยนแล้วต้องประกาศ ตามระดับความเร่งด่วนที่ส่งมา
      aria-live={politeness}
      // ซ่อนจากสายตาแต่ยังอยู่ใน DOM ให้โปรแกรมอ่านหน้าจอเข้าถึงได้
      className="sr-only"
      // alert สำหรับเรื่องด่วน / status สำหรับการแจ้งทั่วไป
      role={politeness === "assertive" ? "alert" : "status"}
    >
      {announcement}
    </span>
  );
}
