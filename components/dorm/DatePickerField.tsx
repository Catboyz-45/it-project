"use client";
// เก็บสถานะเปิดปิด และจัดการโฟกัสกับคีย์บอร์ดเอง

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

// ตัดเวลาทิ้งเหลือแต่วัน เพราะเทียบวันที่ต้องไม่ให้ชั่วโมงกับนาทีมายุ่ง
function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// แปลง "2026-09-19" เป็น Date
// ประกอบเองทีละส่วนแทน new Date(value) เพราะแบบนั้นจะตีความเป็นเวลา UTC แล้วเลื่อนไปหนึ่งวัน
function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  // เดือนใน Date เริ่มที่ 0 จึงต้องลบหนึ่ง
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

// แปลงกลับเป็น "YYYY-MM-DD" ซึ่งเป็นรูปแบบที่ส่งออกไปข้างนอกและเก็บลงฐานข้อมูล
// ไม่ใช้ toISOString เพราะตัวนั้นแปลงเป็น UTC ก่อน แล้ววันจะเพี้ยนไปหนึ่งวัน
function formatIsoDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// แปลงเป็นข้อความแบบไทยไว้แสดงผล ไฟล์อื่นก็เรียกใช้ตัวนี้เพื่อให้รูปแบบตรงกันทั้งระบบ
export function formatDisplayDate(value: string) {
  const date = parseIsoDate(value);
  if (!date) return value;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

// เทียบว่าเป็นวันเดียวกันไหม เทียบทีละส่วนเพราะ Date สองตัวที่ต่างเวลากันจะไม่เท่ากัน
function sameCalendarDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

// วันที่ 0 ของเดือนถัดไปคือวันสุดท้ายของเดือนนี้ ใช้เช็คว่าทั้งเดือนเลยวันต่ำสุดไปแล้วหรือยัง
function monthEndsBeforeMinimum(year: number, month: number, minimumDate: Date) {
  const monthEnd = new Date(year, month + 1, 0);
  return startOfDay(monthEnd) < minimumDate;
}

// เช็คแบบเดียวกันแต่ทั้งปี ใช้ปิดปุ่มปีที่เลือกไม่ได้ในหน้าเลือกปี
function yearEndsBeforeMinimum(year: number, minimumDate: Date) {
  return new Date(year, 11, 31) < minimumDate;
}

// เขียนเองเพราะต้องการแบบย่อที่พอดีกับช่องสี่เหลี่ยม ไม่ใช่ชื่อเต็มที่ Intl ให้มา
const monthShortLabels = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// ปฏิทินที่เขียนเอง แทน input type="date" ของเบราว์เซอร์ที่แต่งสไตล์ไม่ได้และแสดงปีเป็น ค.ศ.
// มีสามมุมมอง เลือกวัน เลือกเดือน เลือกปี กดที่หัวเรื่องเพื่อถอยออกไปทีละชั้น
export function DatePickerField({
  label,
  // ค่าเริ่มต้นคือวันนี้ เพราะที่ใช้ส่วนใหญ่เป็นวันในอนาคต เช่นวันเริ่มหรือวันสิ้นสุดสัญญา
  // บางช่องห้ามเลือกวันในอนาคต เช่นวันที่มีผลของการย้ายออก ไม่ส่งมาก็เลือกได้ไม่จำกัด
  maxDate,
  minDate = new Date(),
  onChange,
  placeholder = "เลือกวันที่",
  value,
}: Readonly<{
  label: string;
  maxDate?: Date;
  minDate?: Date;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}>) {
  const pickerId = useId();
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  // ค่าที่รับมาเป็นสตริง แปลงเป็น Date ไว้ใช้ภายใน ค่าที่รูปแบบผิดจะได้ null
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const minimumDate = useMemo(() => startOfDay(minDate), [minDate]);
  const maximumDate = useMemo(() => maxDate ? startOfDay(maxDate) : null, [maxDate]);
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"day" | "month" | "year">("day");
  // ยังไม่ได้เลือกวันก็เปิดมาที่เดือนปัจจุบัน ซึ่งเป็นจุดที่ผู้ใช้มองหาเสมอ
  // เว้นแต่วันต่ำสุดอยู่ในอนาคต ถึงจะเปิดที่เดือนของวันต่ำสุดแทน
  // ถ้าใช้วันต่ำสุดเป็นหลักเสมอ ช่องที่ยอมให้ย้อนหลังได้ไกล ๆ จะเปิดมาที่ปีเก่าจนผู้ใช้ต้องกดเลื่อนเอง
  const openingDate = useMemo(() => {
    if (selectedDate && selectedDate >= minimumDate) return selectedDate;
    const today = startOfDay(new Date());
    // วันนี้เลยเพดานไปแล้วก็เปิดที่วันสูงสุดแทน ไม่งั้นจะเปิดมาที่เดือนที่กดอะไรไม่ได้เลย
    if (maximumDate !== null && today > maximumDate) return maximumDate;
    return today >= minimumDate ? today : minimumDate;
  }, [maximumDate, minimumDate, selectedDate]);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(openingDate.getFullYear(), openingDate.getMonth(), 1));
  // วันที่โฟกัสอยู่ แยกจากวันที่เลือกไว้ เพราะเลื่อนด้วยลูกศรได้โดยยังไม่ได้กดเลือก
  const [focusedDate, setFocusedDate] = useState(() => openingDate);
  const visibleYear = visibleMonth.getFullYear();
  // หน้าเลือกปีแสดงทีละ 12 ปี ปัดลงให้ช่วงเริ่มต้นคงที่ ไม่เลื่อนตามปีที่ดูอยู่
  const yearRangeStart = Math.floor(visibleYear / 12) * 12;

  useEffect(() => {
    // หน้าหนึ่งมีปฏิทินหลายช่อง เปิดอันใหม่ต้องปิดอันเก่า ไม่งั้นซ้อนกันจนอ่านไม่ออก
    // ส่งผ่าน event ของหน้าต่าง เพราะแต่ละช่องไม่รู้จักกัน และไม่มี state ร่วมกัน
    const closeOtherPickers = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string }>).detail;
      if (detail?.id !== pickerId) setIsOpen(false);
    };
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
    // รอให้ปฏิทินถูกวาดก่อนค่อยโฟกัส เพราะตอนเพิ่งเปิดยังไม่มีปุ่มอยู่ใน DOM
    const frameId = window.requestAnimationFrame(() => {
      if (viewMode === "day") {
        calendarRef.current?.querySelector<HTMLElement>(`[data-date="${formatIsoDate(focusedDate)}"]`)?.focus();
      } else {
        // หน้าเลือกเดือนกับปีโฟกัสที่ตัวปัจจุบันก่อน ถ้าตัวนั้นกดไม่ได้ก็เอาตัวแรกที่กดได้แทน
        (calendarRef.current?.querySelector<HTMLElement>("[data-calendar-current='true']:not(:disabled)")
          ?? calendarRef.current?.querySelector<HTMLElement>(".schedule-calendar-picker-grid button:not(:disabled)"))?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [focusedDate, isOpen, viewMode, visibleMonth]);

  useEffect(() => {
    if (!isOpen) return;

    // ดักที่ document ด้วย เพราะปฏิทินมักเปิดอยู่ในกล่องโต้ตอบ
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      // หยุดไม่ให้ลอยต่อ ไม่งั้น Esc ครั้งเดียวจะปิดทั้งปฏิทินและกล่องที่ครอบอยู่
      event.stopPropagation();
      setIsOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };

    // true = ดักตั้งแต่ขาลง จะได้ชิงทำงานก่อนตัวจัดการ Esc ของกล่องที่ครอบอยู่
    document.addEventListener("keydown", closeOnEscape, true);
    return () => document.removeEventListener("keydown", closeOnEscape, true);
  }, [isOpen]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const start = new Date(firstDay);
    // ถอยไปวันอาทิตย์ก่อนหน้า เพื่อให้แถวแรกเริ่มตรงคอลัมน์วันอาทิตย์เสมอ
    start.setDate(firstDay.getDate() - firstDay.getDay());
    // 42 ช่องคือ 6 สัปดาห์ ครอบคลุมทุกเดือนได้ และทำให้ความสูงปฏิทินคงที่ไม่กระตุกตอนเปลี่ยนเดือน
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [visibleMonth]);

  const monthLabel = visibleMonth.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  // แยกชื่อเดือนกับปีออกจากกัน เพื่อให้เน้นเดือนหนากว่าปีแบบหัวปฏิทินของ Cal
  const monthOnlyLabel = visibleMonth.toLocaleDateString("th-TH", { month: "long" });
  // ปุ่มย้อนกลับต้องปิดเมื่อช่วงก่อนหน้าเลยวันต่ำสุดไปหมดแล้ว แต่ละมุมมองคิดคนละแบบ
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

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const chooseDate = (nextDate: Date) => {
    // กันไว้อีกชั้น ถึงปุ่มของวันก่อนวันต่ำสุดจะถูกปิดไว้อยู่แล้ว
    if (startOfDay(nextDate) < minimumDate) return;
    onChange(formatIsoDate(nextDate));
    setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    // รอให้ onChange ทำงานจบก่อนค่อยปิด ไม่งั้นโฟกัสจะย้ายตั้งแต่ยังอัปเดตค่าไม่เสร็จ
    window.setTimeout(() => {
      setIsOpen(false);
      triggerRef.current?.focus();
    }, 0);
  };

  const toggleOpen = () => {
    if (!isOpen) {
      // ประกาศให้ปฏิทินอันอื่นในหน้ารู้ว่าให้ปิดตัวเอง
      window.dispatchEvent(new CustomEvent("dorm-date-picker-open", { detail: { id: pickerId } }));
      // เปิดมาที่มุมมองวันเสมอ ไม่ค้างมุมมองเดือนหรือปีจากครั้งก่อน
      setViewMode("day");
      setFocusedDate(openingDate);
      setVisibleMonth(new Date(openingDate.getFullYear(), openingDate.getMonth(), 1));
    }
    setIsOpen((current) => !current);
  };

  // เลื่อนโฟกัสไปวันใหม่ พร้อมเลื่อนเดือนที่แสดงตามไปด้วยถ้าข้ามเดือน
  const focusDay = (nextDate: Date) => {
    // ไม่ให้เลื่อนออกไปก่อนวันต่ำสุด ชนแล้วก็ค้างอยู่ตรงนั้น
    const allowedDate = startOfDay(nextDate) < minimumDate ? minimumDate : startOfDay(nextDate);
    setFocusedDate(allowedDate);
    setVisibleMonth(new Date(allowedDate.getFullYear(), allowedDate.getMonth(), 1));
  };

  const moveFocusedMonth = (offset: number) => {
    const targetMonth = focusedDate.getMonth() + offset;
    // หนีบไม่ให้เกินวันสุดท้ายของเดือนปลายทาง เช่นจากวันที่ 31 ไปเดือนกุมภาพันธ์
    const lastDay = new Date(focusedDate.getFullYear(), targetMonth + 1, 0).getDate();
    focusDay(new Date(focusedDate.getFullYear(), targetMonth, Math.min(focusedDate.getDate(), lastDay)));
  };

  // พฤติกรรมคีย์บอร์ดของปฏิทินตามมาตรฐาน ARIA ลูกศรเลื่อนทีละวันและทีละสัปดาห์
  // Home/End ไปต้นกับท้ายสัปดาห์ PageUp/PageDown เปลี่ยนเดือน กด Shift ด้วยเป็นเปลี่ยนปี
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
    // ปุ่มอื่นปล่อยผ่านไปตามปกติ เช่น Tab กับ Enter
    } else return;
    // กันหน้าเลื่อนตามลูกศรไปด้วย
    event.preventDefault();
    focusDay(nextDate);
  };

  const closeWithKeyboard = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  // ปุ่มลูกศรบนหัวปฏิทิน เลื่อนทีละเดือน ทีละปี หรือทีละ 12 ปี ตามมุมมองที่เปิดอยู่
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

  // เลือกเดือนแล้วถอยกลับมามุมมองวัน ไล่จากหยาบไปละเอียด ปี > เดือน > วัน
  const chooseMonth = (monthIndex: number) => {
    if (monthEndsBeforeMinimum(visibleYear, monthIndex, minimumDate)) return;
    setVisibleMonth(new Date(visibleYear, monthIndex, 1));
    setViewMode("day");
  };

  const chooseYear = (year: number) => {
    if (yearEndsBeforeMinimum(year, minimumDate)) return;
    // เดือนที่ค้างไว้อาจเลยวันต่ำสุดในปีใหม่ ก็เลื่อนไปเดือนของวันต่ำสุดแทน
    const month = monthEndsBeforeMinimum(year, visibleMonth.getMonth(), minimumDate) ? minimumDate.getMonth() : visibleMonth.getMonth();
    setVisibleMonth(new Date(year, month, 1));
    setViewMode("month");
  };

  return (
    // ไม่ใช่ label เพราะข้างในเป็นปุ่มเปิดปฏิทิน ซึ่ง label ผูกด้วยไม่ได้ตามสเปก
    // ชื่อที่โปรแกรมอ่านหน้าจอใช้มาจาก aria-label ของปุ่ม ไม่ใช่ span ที่เห็น
    // เพราะ span มีดอกจันของช่องบังคับกรอกติดอยู่ ถ้าอ่านตามจะได้ยินคำว่า "ดาว"
    <div className="field-stack" ref={pickerRef}>
      <span>{label}</span>
      <div className="schedule-date-picker">
        {/* ตัดดอกจันของช่องบังคับกรอกออกจาก label ไม่งั้นโปรแกรมอ่านหน้าจอจะอ่านว่า "ดาว" */}
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
                {/* +543 แปลงเป็นปี พ.ศ. ส่วนข้อมูลที่เก็บยังเป็น ค.ศ. เหมือนเดิม */}
                <PeriodLabel
                  monthOnlyLabel={monthOnlyLabel}
                  viewMode={viewMode}
                  visibleYear={visibleYear}
                  yearRangeStart={yearRangeStart}
                />
              </button>
              <IconButton label="ช่วงถัดไป" onClick={() => moveVisiblePeriod(1)}><ChevronRight size={20} /></IconButton>
            </div>
            {viewMode === "day" ? (
              <>
                {/* ซ่อนจากโปรแกรมอ่านหน้าจอ เพราะแต่ละช่องวันมี aria-label เต็มอยู่แล้ว */}
                <div className="schedule-calendar-weekdays" aria-hidden="true">
                  {["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div aria-label={monthLabel} className="schedule-calendar-grid" role="grid">
                  {calendarDays.map((day) => {
                    const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
                    const isSelected = selectedDate ? sameCalendarDay(day, selectedDate) : false;
                    // วันที่เลยเพดานไปก็กดไม่ได้ เหมือนวันที่ต่ำกว่าวันต่ำสุด
                    const isDisabled = startOfDay(day) < minimumDate || (maximumDate !== null && startOfDay(day) > maximumDate);
                    return (
                      <button
                        // aria-current="date" คือวันนี้ ส่วน aria-selected คือวันที่ผู้ใช้เลือกไว้ คนละเรื่องกัน
                        aria-current={sameCalendarDay(day, new Date()) ? "date" : undefined}
                        aria-label={day.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
                        aria-selected={isSelected}
                        className={`${isCurrentMonth ? "" : "muted"} ${isSelected ? "selected" : ""} ${sameCalendarDay(day, new Date()) ? "today" : ""}`}
                        data-date={formatIsoDate(day)}
                        disabled={isDisabled}
                        key={day.toISOString()}
                        onFocus={() => setFocusedDate(day)}
                        onKeyDown={handleDayKeyDown}
                        onClick={() => chooseDate(day)}
                        role="gridcell"
                        // มีแค่วันเดียวที่ Tab เข้าถึงได้ ที่เหลือเลื่อนด้วยลูกศรแทน ตามมาตรฐานปฏิทินของ ARIA
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
    </div>
  );
}

// ป้ายช่วงเวลาบนหัวปฏิทิน เปลี่ยนตามว่ากำลังเลือกวัน เดือน หรือปี
// +543 แปลงเป็นปี พ.ศ. ส่วนข้อมูลที่เก็บยังเป็น ค.ศ. เหมือนเดิม
function PeriodLabel({ monthOnlyLabel, viewMode, visibleYear, yearRangeStart }: Readonly<{
  monthOnlyLabel: string;
  viewMode: "day" | "month" | "year";
  visibleYear: number;
  yearRangeStart: number;
}>) {
  if (viewMode === "day") return <><strong>{monthOnlyLabel}</strong> <span>{visibleYear + 543}</span></>;
  if (viewMode === "month") return <>{visibleYear + 543}</>;
  return <>{`${yearRangeStart + 543} - ${yearRangeStart + 554}`}</>;
}
