"use client";
// ต้องเป็น Client Component เพราะแตะ document และ focus ของเบราว์เซอร์

import type { KeyboardEvent } from "react";

// ค่าของแท็บเป็นได้ทั้งข้อความและตัวเลข แล้วแต่หน้าไหนใช้อะไรเป็นตัวระบุ
type TabValue = string | number;

/**
 * ทำให้แถบแท็บเลื่อนด้วยลูกศรได้ตามมาตรฐาน ARIA
 *
 * แถบแท็บที่กดได้ด้วยเมาส์อย่างเดียวถือว่าใช้งานไม่ได้สำหรับคนที่ใช้คีย์บอร์ด
 * มาตรฐานกำหนดว่า ← → ต้องเลื่อนระหว่างแท็บ และ Home/End ต้องกระโดดไปหัว-ท้าย
 *
 * คืนค่าเป็นฟังก์ชัน onKeyDown ให้เอาไปใส่ที่กล่องครอบแท็บ (ตัวที่มี role="tablist")
 * ไม่ใช่ใส่ทีละปุ่ม เพราะต้องรู้จักแท็บทั้งชุดถึงจะเลื่อนไปมาได้
 */
export function useTablistKeyboard<T extends TabValue>(
  values: readonly T[],
  onSelect: (value: T) => void,
) {
  return (event: KeyboardEvent<HTMLElement>) => {
    // ปุ่มอื่นปล่อยผ่านให้เบราว์เซอร์จัดการตามปกติ เช่น Tab ต้องออกจากแถบแท็บได้
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    // อ่านแท็บจาก DOM จริงแทนที่จะเชื่อ values อย่างเดียว เพราะบางแท็บอาจถูก disabled
    // ไว้ ซึ่งต้องข้ามไป ไม่ใช่เลื่อนไปโฟกัสปุ่มที่กดไม่ได้
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'),
    );
    if (tabs.length === 0) return;

    // หาว่าตอนนี้โฟกัสอยู่แท็บที่เท่าไหร่ ถ้าโฟกัสไม่ได้อยู่ในแถบเลย indexOf จะได้ -1
    // จึงดันขึ้นเป็น 0 เพื่อให้เริ่มนับจากแท็บแรก
    const currentIndex = Math.max(0, tabs.indexOf(document.activeElement as HTMLElement));

    // คำนวณว่าจะไปแท็บไหนต่อ
    // Home/End = กระโดดสุดทาง
    // ← → = ขยับทีละหนึ่ง โดย % tabs.length ทำให้วนกลับ (จากตัวสุดท้ายไปตัวแรก)
    // ตัว - ต้อง + tabs.length ก่อนหาร ไม่งั้นค่าจะติดลบตอนอยู่แท็บแรก
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : event.key === "ArrowRight"
          ? (currentIndex + 1) % tabs.length
          : (currentIndex - 1 + tabs.length) % tabs.length;

    const nextValue = values[nextIndex];
    const nextTab = tabs[nextIndex];
    // กันกรณีจำนวนแท็บใน DOM ไม่ตรงกับ values ที่ส่งมา จะได้ไม่พังทั้งหน้า
    if (nextValue === undefined || !nextTab) return;

    // กันเบราว์เซอร์เลื่อนหน้าจอตามปุ่มลูกศร เพราะเราจะจัดการโฟกัสเอง
    event.preventDefault();
    // บอกหน้าที่เรียกใช้ให้เปลี่ยนแท็บที่เลือก แล้วค่อยย้ายโฟกัสตามไป
    onSelect(nextValue);
    nextTab.focus();
  };
}
