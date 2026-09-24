"use client";
// ใช้ context และ portal ซึ่งต้องทำงานฝั่งเบราว์เซอร์

import { createContext, ReactNode, useContext, useState } from "react";
import { createPortal } from "react-dom";

// element ปลายทางที่หน้าย่อยจะส่งปุ่มไปแสดง null = shell ยังไม่ได้วางช่องนั้น
const PageHeaderSlotContext = createContext<HTMLElement | null>(null);

// แยก setter เป็น context ของตัวเอง เพื่อให้ PageHeaderTarget ลงทะเบียนได้โดยไม่ต้องส่ง props หลายชั้น
const PageHeaderSlotSetterContext = createContext<((element: HTMLElement | null) => void) | null>(null);

// ครอบ shell ไว้ เพื่อเปิดช่องฝากปุ่มให้ทุกหน้าย่อยที่อยู่ข้างใน
export function PageHeaderSlotProvider({ children }: Readonly<{ children: ReactNode }>) {
  // เก็บเป็น state ไม่ใช่ ref เพราะต้องให้หน้าย่อย render ใหม่ตอนช่องพร้อมใช้
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  return (
    <PageHeaderSlotContext.Provider value={slot}>
      <PageHeaderSlotSetterContext.Provider value={setSlot}>
        {children}
      </PageHeaderSlotSetterContext.Provider>
    </PageHeaderSlotContext.Provider>
  );
}

// ช่องว่างในแถบหัวเรื่องที่รอรับปุ่มจากหน้าย่อย วางไว้จุดเดียวใน shell
export function PageHeaderTarget() {
  const setSlot = useContext(PageHeaderSlotSetterContext);

  // callback ref ได้ element ทันทีที่ถูกวางลง DOM และได้ null ตอนถูกถอด
  return <div className="page-header-slot" ref={(element) => setSlot?.(element)} />;
}

// หน้าย่อยห่อปุ่มด้วยตัวนี้ แล้วปุ่มจะไปโผล่บนแถบหัวเรื่องแทนที่จะอยู่ตรงที่เขียน
export function PageHeaderActions({ children }: Readonly<{ children: ReactNode }>) {
  const slot = useContext(PageHeaderSlotContext);

  // รอบแรกช่องยังไม่ถูกวาง จึงยังไม่แสดงอะไร แล้วค่อยโผล่เมื่อ provider รู้ค่า element
  if (!slot) {
    return null;
  }

  // portal ทำให้วางโค้ดไว้ที่เดิมได้ ปุ่มจึงยังถือ state และ handler ของหน้าตัวเอง
  return createPortal(children, slot);
}
