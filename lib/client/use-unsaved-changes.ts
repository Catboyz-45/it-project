"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นตัวช่วยฝั่งเบราว์เซอร์สำหรับ “use unsaved changes” เช่น interaction การเรียก API หรือสถานะหน้าจอ
 * การทำงาน: ทำงานหลังหน้าโหลดแล้วและต้องถือว่าข้อมูลจากผู้ใช้ไม่น่าเชื่อถือ; เซิร์ฟเวอร์ยังต้องตรวจข้อมูลและสิทธิ์ซ้ำเสมอ
 */

import { useEffect } from "react";

const DEFAULT_MESSAGE = "มีข้อมูลที่ยังไม่ได้บันทึก หากออกจากหน้านี้การแก้ไขอาจสูญหาย ต้องการออกจากหน้านี้หรือไม่?";
const confirmedNavigationEvents = new WeakSet<Event>();
let allowUnloadUntil = 0;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: React hook “use Unsaved Changes” รวม state และพฤติกรรมที่คอมโพเนนต์นำกลับมาใช้ซ้ำ
 * รับค่า:
 * - isDirty: ค่าจริง/เท็จที่ใช้เปิดหรือปิดเงื่อนไขนี้
 * - message: ค่า “message” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function useUnsavedChanges(isDirty: boolean, message = DEFAULT_MESSAGE) {
  useEffect(() => {
    if (!isDirty) return;

    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “before Unload” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (Date.now() < allowUnloadUntil) return;
      event.preventDefault();
      event.returnValue = "";
    };

    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “confirm Link Navigation” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const confirmLinkNavigation = (event: MouseEvent) => {
      if (confirmedNavigationEvents.has(event)) return;
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
      ) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.download || link.target === "_blank") return;

      const destination = new URL(link.href, window.location.href);
      const current = new URL(window.location.href);
      if (
        destination.href === current.href
        || (
          destination.origin === current.origin
          && destination.pathname === current.pathname
          && destination.search === current.search
          && destination.hash !== current.hash
        )
      ) return;

      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      // Avoid showing a second native beforeunload prompt for a confirmed
      // full-page navigation, or a second prompt from a nested dirty editor.
      confirmedNavigationEvents.add(event);
      allowUnloadUntil = Date.now() + 1_000;
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", confirmLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", confirmLinkNavigation, true);
    };
  }, [isDirty, message]);
}
