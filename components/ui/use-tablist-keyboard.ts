"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “use tablist keyboard” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import type { KeyboardEvent } from "react";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Tab Value” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type TabValue = string | number;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: React hook “use Tablist Keyboard” รวม state และพฤติกรรมที่คอมโพเนนต์นำกลับมาใช้ซ้ำ
 * รับค่า:
 * - values: ค่า “values” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - onSelect: ค่า “on Select” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function useTablistKeyboard<T extends TabValue>(
  values: readonly T[],
  onSelect: (value: T) => void,
) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'),
    );
    if (tabs.length === 0) return;

    const currentIndex = Math.max(0, tabs.indexOf(document.activeElement as HTMLElement));
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : event.key === "ArrowRight"
          ? (currentIndex + 1) % tabs.length
          : (currentIndex - 1 + tabs.length) % tabs.length;

    const nextValue = values[nextIndex];
    const nextTab = tabs[nextIndex];
    if (nextValue === undefined || !nextTab) return;

    event.preventDefault();
    onSelect(nextValue);
    nextTab.focus();
  };
}
