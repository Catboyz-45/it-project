"use client";
// แตะ document และ focus ของเบราว์เซอร์

import type { KeyboardEvent } from "react";

type TabValue = string | number;

// ทำให้แถบแท็บเลื่อนด้วยลูกศรได้ตามมาตรฐาน ARIA
// คืนค่าเป็น onKeyDown เอาไปใส่ที่กล่องครอบ (role="tablist") ไม่ใช่ทีละปุ่ม
export function useTablistKeyboard<T extends TabValue>(
  values: readonly T[],
  onSelect: (value: T) => void,
) {
  return (event: KeyboardEvent<HTMLElement>) => {
    // ปุ่มอื่นปล่อยผ่าน เช่น Tab ต้องออกจากแถบแท็บได้ตามปกติ
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    // อ่านจาก DOM ไม่ใช่จาก values เพราะต้องข้ามแท็บที่ถูก disabled
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'),
    );
    if (tabs.length === 0) return;

    // โฟกัสไม่ได้อยู่ในแถบจะได้ -1 จึงดันเป็น 0 ให้เริ่มนับจากแท็บแรก
    const currentIndex = Math.max(0, tabs.indexOf(document.activeElement as HTMLElement));

    const nextIndex = rovingIndex(event.key, currentIndex, tabs.length);

    const nextValue = values[nextIndex];
    const nextTab = tabs[nextIndex];
    // กันกรณีจำนวนแท็บใน DOM ไม่ตรงกับ values ที่ส่งมา
    if (nextValue === undefined || !nextTab) return;

    // กันเบราว์เซอร์เลื่อนหน้าตามลูกศร เพราะเราจัดการโฟกัสเอง
    event.preventDefault();
    onSelect(nextValue);
    nextTab.focus();
  };
}

// ปุ่มถัดไปของแถบที่เลื่อนด้วยลูกศร ใช้ร่วมกันทุกแถบที่ทำตามมาตรฐาน ARIA
// % ทำให้วนกลับต้นเมื่อถึงท้าย และวนไปท้ายเมื่อถึงต้น
export function rovingIndex(key: string, currentIndex: number, total: number) {
  if (key === "Home") return 0;
  if (key === "End") return total - 1;
  if (key === "ArrowRight" || key === "ArrowDown") return (currentIndex + 1) % total;
  return (currentIndex - 1 + total) % total;
}
