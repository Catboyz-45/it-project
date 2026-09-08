"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นตัวช่วยฝั่งเบราว์เซอร์สำหรับ “use action feedback” เช่น interaction การเรียก API หรือสถานะหน้าจอ
 * การทำงาน: ทำงานหลังหน้าโหลดแล้วและต้องถือว่าข้อมูลจากผู้ใช้ไม่น่าเชื่อถือ; เซิร์ฟเวอร์ยังต้องตรวจข้อมูลและสิทธิ์ซ้ำเสมอ
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { formatClientError } from "@/lib/client/api-error";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Action Messages” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type ActionMessages = { pending: string; success: string; error: string };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Run Action Options” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type RunActionOptions = {
  /** Explicit destination used when the trigger is removed by the action. */
  fallbackFocusTarget?: HTMLElement | null | (() => HTMLElement | null);
  focusTarget?: HTMLElement | null;
  restoreFocus?: boolean;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “focus Without Scrolling” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - target: ค่า “target” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function focusWithoutScrolling(target: HTMLElement | null | undefined) {
  if (!target?.isConnected) return false;
  target.focus({ preventScroll: true });
  return document.activeElement === target;
}

/** A consistent lifecycle for client-side write operations. */
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: React hook “use Action Feedback” รวม state และพฤติกรรมที่คอมโพเนนต์นำกลับมาใช้ซ้ำ
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function useActionFeedback() {
  const notify = useToast();
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const [isPending, setIsPending] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => { mountedRef.current = false; }, []);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “run Action” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - action: ค่า “action” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - messages: ค่า “messages” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - options: ตัวเลือกเพิ่มเติมที่ปรับพฤติกรรมของฟังก์ชัน
   * ผลลัพธ์: คืนข้อมูลชนิด Promise<T | undefined> ตามสัญญา TypeScript ของฟังก์ชัน
   */
  const runAction = useCallback(async <T,>(
    action: () => Promise<T>,
    messages: ActionMessages,
    options: RunActionOptions = {},
  ): Promise<T | undefined> => {
    if (inFlightRef.current) return undefined;
    const activeElement = options.focusTarget
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    inFlightRef.current = true;
    setIsPending(true);
    setError("");
    setAnnouncement(messages.pending);
    try {
      const result = await action();
      if (mountedRef.current) {
        setAnnouncement(messages.success);
        notify({ message: messages.success });
      }
      return result;
    } catch (error) {
      if (mountedRef.current) {
        const formattedError = formatClientError(error, messages.error);
        setError(formattedError);
        setAnnouncement(formattedError);
        notify({ message: formattedError, tone: "error" });
      }
      throw error;
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setIsPending(false);
      if (options.restoreFocus !== false) {
        window.requestAnimationFrame(() => {
          if (focusWithoutScrolling(activeElement)) return;
          const fallback = typeof options.fallbackFocusTarget === "function"
            ? options.fallbackFocusTarget()
            : options.fallbackFocusTarget;
          if (focusWithoutScrolling(fallback)) return;
          focusWithoutScrolling(document.querySelector<HTMLElement>("[data-action-focus-fallback], main h1, main h2"));
        });
      }
    }
  }, [notify]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “clear Error” ตามกฎของระบบ
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const clearError = useCallback(() => setError(""), []);

  return { announcement, clearError, error, isPending, runAction };
}
