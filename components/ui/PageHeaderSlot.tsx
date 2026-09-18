"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: ช่องฝากปุ่มของหน้าย่อยขึ้นไปแสดงบนหัวเรื่องของ shell เพื่อให้ทั้งแอปมีหัวข้อชั้นเดียว
 * การทำงาน: shell วาง PageHeaderTarget ไว้ในแถบหัวเรื่องหนึ่งจุด หน้าย่อยห่อปุ่มด้วย PageHeaderActions แล้ว React จะ portal ปุ่มนั้นไปโผล่ในช่องดังกล่าว; ใช้ context และ DOM จึงเป็น Client Component
 */

import { createContext, ReactNode, useContext, useState } from "react";
import { createPortal } from "react-dom";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เก็บ element ปลายทางที่หน้าย่อยจะส่งปุ่มไปแสดง ค่าเป็น null ตอนที่ shell ยังไม่วางช่องนั้น
 */
const PageHeaderSlotContext = createContext<HTMLElement | null>(null);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Page Header Slot Provider” เปิดช่องฝากปุ่มให้ทุกหน้าย่อยที่อยู่ข้างใน
 * รับค่า:
 * - { children }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function PageHeaderSlotProvider({ children }: { children: ReactNode }) {
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แยก setter ออกเป็น context ของตัวเอง เพื่อให้ PageHeaderTarget ลงทะเบียนช่องได้โดยไม่ต้องรับ props ผ่านหลายชั้น
 */
const PageHeaderSlotSetterContext = createContext<((element: HTMLElement | null) => void) | null>(null);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Page Header Target” คือช่องว่างในแถบหัวเรื่องที่รอรับปุ่มจากหน้าย่อย
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function PageHeaderTarget() {
  const setSlot = useContext(PageHeaderSlotSetterContext);

  // callback ref ทำให้ได้ element ทันทีที่ถูกวางลง DOM และได้ null ตอนถูกถอด
  return <div className="page-header-slot" ref={(element) => setSlot?.(element)} />;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Page Header Actions” ส่งปุ่มของหน้าย่อยไปแสดงบนแถบหัวเรื่องของ shell
 * รับค่า:
 * - { children }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function PageHeaderActions({ children }: { children: ReactNode }) {
  const slot = useContext(PageHeaderSlotContext);

  // รอบแรกช่องยังไม่ถูกวาง จึงยังไม่แสดงอะไร แล้วค่อยโผล่เมื่อ provider รู้ค่า element
  if (!slot) {
    return null;
  }

  return createPortal(children, slot);
}
