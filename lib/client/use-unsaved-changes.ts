"use client";

import { useEffect } from "react";

const DEFAULT_MESSAGE = "มีข้อมูลที่ยังไม่ได้บันทึก หากออกจากหน้านี้การแก้ไขอาจสูญหาย ต้องการออกจากหน้านี้หรือไม่?";
// หน้าหนึ่งอาจมีหลายฟอร์มที่ยังไม่บันทึกพร้อมกัน สองตัวนี้กันไม่ให้ถามซ้ำหลายรอบจากคลิกเดียว
// WeakSet จำ event ที่ถามไปแล้ว ส่วน allowUnloadUntil ปิดคำถามของเบราว์เซอร์ชั่วคราว
const confirmedNavigationEvents = new WeakSet<Event>();
let allowUnloadUntil = 0;

// เตือนก่อนออกจากหน้าตอนยังมีข้อมูลที่ยังไม่ได้บันทึก ดักสองทาง ปิดแท็บกับกดลิงก์ในหน้า
export function useUnsavedChanges(isDirty: boolean, message = DEFAULT_MESSAGE) {
  useEffect(() => {
    if (!isDirty) return;

    // ดักการปิดแท็บ รีเฟรช หรือพิมพ์ URL ใหม่ เบราว์เซอร์จะขึ้นคำถามของตัวเอง แก้ข้อความไม่ได้
    const beforeUnload = (event: BeforeUnloadEvent) => {
      // เพิ่งยืนยันจากคำถามของเราไปหมาด ๆ ไม่ต้องถามซ้ำอีก
      if (Date.now() < allowUnloadUntil) return;
      event.preventDefault();
      event.returnValue = "";
    };

    // ดักการกดลิงก์ในหน้า เพราะ Next เปลี่ยนหน้าเองโดยไม่ผ่าน beforeunload
    const confirmLinkNavigation = (event: MouseEvent) => {
      if (confirmedNavigationEvents.has(event)) return;
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
      // ปุ่มขวา ปุ่มกลาง หรือกดพร้อม Ctrl/Cmd คือเปิดแท็บใหม่ หน้านี้ยังอยู่จึงไม่ต้องถาม
        || event.altKey
      ) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      // ลิงก์ดาวน์โหลดกับลิงก์เปิดแท็บใหม่ก็ไม่ได้พาออกจากหน้านี้
      if (!link || link.download || link.target === "_blank") return;

      // เทียบปลายทางกับที่อยู่ปัจจุบัน ลิงก์ที่ชี้มาที่เดิมหรือเปลี่ยนแค่ #anchor ไม่ต้องถาม
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

      // ตอบไม่ก็หยุดการเปลี่ยนหน้า และหยุดไม่ให้ตัวจัดการอื่นทำงานต่อด้วย
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      // ตอบตกลงแล้ว ต้องกันไม่ให้ถูกถามซ้ำอีกจากคำถามของเบราว์เซอร์
      // หรือจากฟอร์มอื่นในหน้าเดียวกันที่ก็ยังไม่ได้บันทึกเหมือนกัน
      confirmedNavigationEvents.add(event);
      allowUnloadUntil = Date.now() + 1_000;
    };

    window.addEventListener("beforeunload", beforeUnload);
    // true = ดักตั้งแต่ขาลง จะได้ชิงทำงานก่อนตัวจัดการคลิกของ Next
    document.addEventListener("click", confirmLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", confirmLinkNavigation, true);
    };
  }, [isDirty, message]);
}
