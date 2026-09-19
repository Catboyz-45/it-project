"use client";
// ต้องเป็น Client Component เพราะใช้ state และ timer ของเบราว์เซอร์

import { useEffect, useRef, useState } from "react";

/**
 * ป้ายประกาศสำหรับโปรแกรมอ่านหน้าจอ
 *
 * ผู้ใช้ที่มองเห็นจะรู้ทันทีว่าหน้าเปลี่ยนไปแล้ว แต่ผู้ใช้ที่ใช้โปรแกรมอ่านหน้าจอ
 * ไม่รู้ ถ้าไม่มีใครบอก คอมโพเนนต์นี้จึงวางข้อความที่มองไม่เห็นไว้ให้โปรแกรมอ่าน
 * ประกาศแทน เช่น "เปิดหน้า คลังพัสดุ" หรือ "กำลังแสดง 20 รายการ"
 *
 * politeness = "polite"    รอให้ผู้ใช้หยุดพิมพ์/หยุดอ่านก่อนค่อยประกาศ (ใช้เป็นค่าปกติ)
 * politeness = "assertive" ขัดจังหวะประกาศทันที ใช้เฉพาะเรื่องด่วนอย่างข้อผิดพลาด
 */
export function LiveAnnouncement({
  message,
  politeness = "polite",
}: {
  message: string;
  politeness?: "assertive" | "polite";
}) {
  // ข้อความที่ "ประกาศจริง" แยกจาก message ที่รับเข้ามา เพราะต้องล้างให้ว่างก่อนหนึ่งจังหวะ
  const [announcement, setAnnouncement] = useState("");
  // เก็บ timer ไว้ใน ref เพื่อยกเลิกได้ ถ้า message เปลี่ยนก่อนครบเวลา
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // ถ้ายังมี timer ค้างจากข้อความก่อนหน้า ให้ทิ้งไปก่อน จะได้ไม่ประกาศซ้อนกัน
    if (timerRef.current) clearTimeout(timerRef.current);

    // ล้างให้ว่างก่อน — จุดสำคัญของทั้งไฟล์นี้
    // โปรแกรมอ่านหน้าจอจะประกาศก็ต่อเมื่อ "ข้อความเปลี่ยน" ถ้าใส่ข้อความเดิมซ้ำ
    // มันจะเงียบ การล้างเป็นค่าว่างก่อนจึงบังคับให้ถือว่าเปลี่ยนจริง
    setAnnouncement("");

    // หน่วง 50ms ให้เบราว์เซอร์ทันรับรู้ว่าค่าว่างไปแล้ว ก่อนใส่ข้อความจริงกลับเข้าไป
    // ถ้าใส่กลับทันทีในจังหวะเดียวกัน React จะรวบเป็นการเปลี่ยนครั้งเดียวและไม่มีการประกาศ
    if (message) timerRef.current = setTimeout(() => setAnnouncement(message), 50);

    // ถ้าคอมโพเนนต์ถูกถอดออกก่อนครบ 50ms ต้องยกเลิก timer ไม่งั้นจะ setState หลังถอดแล้ว
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message]);

  return (
    <span
      // อ่านข้อความทั้งก้อนใหม่ทุกครั้ง ไม่ใช่อ่านเฉพาะส่วนที่ต่างจากเดิม
      aria-atomic="true"
      // บอกเบราว์เซอร์ว่าบริเวณนี้เปลี่ยนแล้วต้องประกาศ ด้วยระดับความเร่งด่วนที่ส่งมา
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
