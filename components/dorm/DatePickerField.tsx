"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Date Picker Field” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “start Of Day” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - date: ค่า “date” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “parse Iso Date” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “format Iso Date” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - date: ค่า “date” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function formatIsoDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “format Display Date” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function formatDisplayDate(value: string) {
  const date = parseIsoDate(value);
  if (!date) return value;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “same Calendar Day” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - first: ค่า “first” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - second: ค่า “second” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function sameCalendarDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “month Ends Before Minimum” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - year: ค่า “year” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - month: ค่า “month” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - minimumDate: ค่า “minimum Date” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function monthEndsBeforeMinimum(year: number, month: number, minimumDate: Date) {
  const monthEnd = new Date(year, month + 1, 0);
  return startOfDay(monthEnd) < minimumDate;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “year Ends Before Minimum” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - year: ค่า “year” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - minimumDate: ค่า “minimum Date” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function yearEndsBeforeMinimum(year: number, minimumDate: Date) {
  return new Date(year, 11, 31) < minimumDate;
}

const monthShortLabels = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Date Picker Field” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { label, minDate = new Date(), onChange, placeholder = "เลือ: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function DatePickerField({
  label,
  minDate = new Date(),
  onChange,
  placeholder = "เลือกวันที่",
  value,
}: {
  label: string;
  minDate?: Date;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const pickerId = useId();
  const pickerRef = useRef<HTMLLabelElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “selected Date” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “minimum Date” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const minimumDate = useMemo(() => startOfDay(minDate), [minDate]);
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"day" | "month" | "year">("day");
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “[visible Month, set Visible Month]” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const baseDate = selectedDate && selectedDate >= minimumDate ? selectedDate : minimumDate;
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  });
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “[focused Date, set Focused Date]” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const [focusedDate, setFocusedDate] = useState(() => selectedDate && selectedDate >= minimumDate ? selectedDate : minimumDate);
  const visibleYear = visibleMonth.getFullYear();
  const yearRangeStart = Math.floor(visibleYear / 12) * 12;

  useEffect(() => {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close Other Pickers” ตามกฎของระบบ
     * รับค่า:
     * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const closeOtherPickers = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string }>).detail;
      if (detail?.id !== pickerId) setIsOpen(false);
    };
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close On Outside Click” ตามกฎของระบบ
     * รับค่า:
     * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    window.addEventListener("dorm-date-picker-open", closeOtherPickers);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      window.removeEventListener("dorm-date-picker-open", closeOtherPickers);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [pickerId]);

  useEffect(() => {
    if (!isOpen) return;
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “frame Id” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const frameId = window.requestAnimationFrame(() => {
      if (viewMode === "day") {
        calendarRef.current?.querySelector<HTMLElement>(`[data-date="${formatIsoDate(focusedDate)}"]`)?.focus();
      } else {
        (calendarRef.current?.querySelector<HTMLElement>("[data-calendar-current='true']:not(:disabled)")
          ?? calendarRef.current?.querySelector<HTMLElement>(".schedule-calendar-picker-grid button:not(:disabled)"))?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [focusedDate, isOpen, viewMode, visibleMonth]);

  useEffect(() => {
    if (!isOpen) return;

    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close On Escape” ตามกฎของระบบ
     * รับค่า:
     * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };

    document.addEventListener("keydown", closeOnEscape, true);
    return () => document.removeEventListener("keydown", closeOnEscape, true);
  }, [isOpen]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “calendar Days” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const calendarDays = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [visibleMonth]);

  const monthLabel = visibleMonth.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ตอบว่าเงื่อนไข “can Move Backward” เป็นจริงหรือไม่ เพื่อใช้ตัดสินใจในขั้นตอนถัดไป
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const canMoveBackward = useMemo(() => {
    if (viewMode === "day") {
      const previousMonthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 0);
      return previousMonthEnd >= minimumDate;
    }
    if (viewMode === "month") {
      const previousYearEnd = new Date(visibleYear - 1, 11, 31);
      return previousYearEnd >= minimumDate;
    }
    const previousRangeEnd = new Date(yearRangeStart - 1, 11, 31);
    return previousRangeEnd >= minimumDate;
  }, [minimumDate, viewMode, visibleMonth, visibleYear, yearRangeStart]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “move Month” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - offset: ค่า “offset” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “choose Date” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - nextDate: ค่า “next Date” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const chooseDate = (nextDate: Date) => {
    if (startOfDay(nextDate) < minimumDate) return;
    onChange(formatIsoDate(nextDate));
    setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    window.setTimeout(() => {
      setIsOpen(false);
      triggerRef.current?.focus();
    }, 0);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: แปลงข้อมูลในขั้นตอน “toggle Open” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const toggleOpen = () => {
    if (!isOpen) {
      window.dispatchEvent(new CustomEvent("dorm-date-picker-open", { detail: { id: pickerId } }));
      setViewMode("day");
      const nextFocusedDate = selectedDate && selectedDate >= minimumDate ? selectedDate : minimumDate;
      setFocusedDate(nextFocusedDate);
      setVisibleMonth(new Date(nextFocusedDate.getFullYear(), nextFocusedDate.getMonth(), 1));
    }
    setIsOpen((current) => !current);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “focus Day” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - nextDate: ค่า “next Date” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const focusDay = (nextDate: Date) => {
    const allowedDate = startOfDay(nextDate) < minimumDate ? minimumDate : startOfDay(nextDate);
    setFocusedDate(allowedDate);
    setVisibleMonth(new Date(allowedDate.getFullYear(), allowedDate.getMonth(), 1));
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “move Focused Month” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - offset: ค่า “offset” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const moveFocusedMonth = (offset: number) => {
    const targetMonth = focusedDate.getMonth() + offset;
    const lastDay = new Date(focusedDate.getFullYear(), targetMonth + 1, 0).getDate();
    focusDay(new Date(focusedDate.getFullYear(), targetMonth, Math.min(focusedDate.getDate(), lastDay)));
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รับเหตุการณ์ “handle Day Key Down” จากผู้ใช้หรือระบบ แล้วเรียกขั้นตอนที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const handleDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const nextDate = new Date(focusedDate);
    if (event.key === "ArrowLeft") nextDate.setDate(nextDate.getDate() - 1);
    else if (event.key === "ArrowRight") nextDate.setDate(nextDate.getDate() + 1);
    else if (event.key === "ArrowUp") nextDate.setDate(nextDate.getDate() - 7);
    else if (event.key === "ArrowDown") nextDate.setDate(nextDate.getDate() + 7);
    else if (event.key === "Home") nextDate.setDate(nextDate.getDate() - nextDate.getDay());
    else if (event.key === "End") nextDate.setDate(nextDate.getDate() + (6 - nextDate.getDay()));
    else if (event.key === "PageUp") {
      event.preventDefault();
      moveFocusedMonth(event.shiftKey ? -12 : -1);
      return;
    } else if (event.key === "PageDown") {
      event.preventDefault();
      moveFocusedMonth(event.shiftKey ? 12 : 1);
      return;
    } else return;
    event.preventDefault();
    focusDay(nextDate);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close With Keyboard” ตามกฎของระบบ
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const closeWithKeyboard = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “move Visible Period” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - offset: ค่า “offset” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const moveVisiblePeriod = (offset: number) => {
    if (viewMode === "day") {
      moveMonth(offset);
      return;
    }
    if (viewMode === "month") {
      setVisibleMonth((current) => new Date(current.getFullYear() + offset, current.getMonth(), 1));
      return;
    }
    setVisibleMonth((current) => new Date(current.getFullYear() + offset * 12, current.getMonth(), 1));
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “choose Month” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - monthIndex: ค่า “month Index” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const chooseMonth = (monthIndex: number) => {
    if (monthEndsBeforeMinimum(visibleYear, monthIndex, minimumDate)) return;
    setVisibleMonth(new Date(visibleYear, monthIndex, 1));
    setViewMode("day");
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “choose Year” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - year: ค่า “year” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const chooseYear = (year: number) => {
    if (yearEndsBeforeMinimum(year, minimumDate)) return;
    const month = monthEndsBeforeMinimum(year, visibleMonth.getMonth(), minimumDate) ? minimumDate.getMonth() : visibleMonth.getMonth();
    setVisibleMonth(new Date(year, month, 1));
    setViewMode("month");
  };

  return (
    <label ref={pickerRef}>
      <span>{label}</span>
      <div className="schedule-date-picker">
        <button aria-controls={`${pickerId}-calendar`} aria-expanded={isOpen} aria-haspopup="dialog" aria-label={label.replace(/\s*\*$/, "")} className={isOpen ? "schedule-date-trigger active" : "schedule-date-trigger"} onClick={toggleOpen} ref={triggerRef} type="button">
          <span>{value ? formatDisplayDate(value) : placeholder}</span>
          <CalendarDays aria-hidden="true" size={22} />
        </button>
        {isOpen ? (
          <div
            aria-label={`เลือก${label.replace(/\s*\*$/, "")}`}
            aria-modal="true"
            className="schedule-calendar"
            id={`${pickerId}-calendar`}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closeWithKeyboard();
              }
            }}
            ref={calendarRef}
            role="dialog"
          >
            <div className="schedule-calendar-head">
              <IconButton label="ช่วงก่อนหน้า" disabled={!canMoveBackward} onClick={() => moveVisiblePeriod(-1)}><ChevronLeft size={20} /></IconButton>
              <button
                className="schedule-calendar-title"
                disabled={viewMode === "year"}
                onClick={() => setViewMode((current) => (current === "day" ? "month" : "year"))}
                type="button"
              >
                {viewMode === "day" ? monthLabel : viewMode === "month" ? visibleYear + 543 : `${yearRangeStart + 543} - ${yearRangeStart + 554}`}
              </button>
              <IconButton label="ช่วงถัดไป" onClick={() => moveVisiblePeriod(1)}><ChevronRight size={20} /></IconButton>
            </div>
            {viewMode === "day" ? (
              <>
                <div className="schedule-calendar-weekdays" aria-hidden="true">
                  {["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div aria-label={monthLabel} className="schedule-calendar-grid" role="grid">
                  {calendarDays.map((day) => {
                    const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
                    const isSelected = selectedDate ? sameCalendarDay(day, selectedDate) : false;
                    const isDisabled = startOfDay(day) < minimumDate;
                    return (
                      <button
                        aria-current={sameCalendarDay(day, new Date()) ? "date" : undefined}
                        aria-label={day.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
                        aria-selected={isSelected}
                        className={`${isCurrentMonth ? "" : "muted"} ${isSelected ? "selected" : ""}`}
                        data-date={formatIsoDate(day)}
                        disabled={isDisabled}
                        key={day.toISOString()}
                        onFocus={() => setFocusedDate(day)}
                        onKeyDown={handleDayKeyDown}
                        onClick={() => chooseDate(day)}
                        role="gridcell"
                        tabIndex={sameCalendarDay(day, focusedDate) ? 0 : -1}
                        type="button"
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
            {viewMode === "month" ? (
              <div className="schedule-calendar-picker-grid">
                {monthShortLabels.map((month, monthIndex) => (
                  <button
                    className={monthIndex === visibleMonth.getMonth() ? "selected" : ""}
                    data-calendar-current={monthIndex === visibleMonth.getMonth()}
                    disabled={monthEndsBeforeMinimum(visibleYear, monthIndex, minimumDate)}
                    key={month}
                    onClick={() => chooseMonth(monthIndex)}
                    type="button"
                  >
                    {month}
                  </button>
                ))}
              </div>
            ) : null}
            {viewMode === "year" ? (
              <div className="schedule-calendar-picker-grid year">
                {Array.from({ length: 12 }, (_, index) => yearRangeStart + index).map((year) => (
                  <button
                    className={year === visibleYear ? "selected" : ""}
                    data-calendar-current={year === visibleYear}
                    disabled={yearEndsBeforeMinimum(year, minimumDate)}
                    key={year}
                    onClick={() => chooseYear(year)}
                    type="button"
                  >
                      {year + 543}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </label>
  );
}
