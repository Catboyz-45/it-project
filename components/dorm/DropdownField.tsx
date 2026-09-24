"use client";
// เก็บสถานะเปิดปิด และจัดการโฟกัสกับคีย์บอร์ดเอง

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { rovingIndex } from "@/components/ui/use-tablist-keyboard";

// ตัวเลือกหนึ่งรายการ disabled ไว้ใช้กับตัวเลือกที่แสดงให้เห็นแต่ยังเลือกไม่ได้
export type DropdownOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

// ตัวเลือกแบบกำหนดหน้าตาเอง แทน select ของเบราว์เซอร์ที่แต่งสไตล์ได้จำกัด
// แลกมาด้วยการต้องทำพฤติกรรมคีย์บอร์ดเองทั้งหมดตามมาตรฐาน listbox ของ ARIA
// ตัวเลือกถัดไปตามปุ่มที่กด เมนูนี้ข้ามตัวเลือกที่ปิดอยู่ จึงเลื่อนบนรายการที่เปิดใช้งานได้เท่านั้น
function nextOptionIndex(key: string, enabledIndexes: number[], activeIndex: number) {
  const currentPosition = Math.max(0, enabledIndexes.indexOf(activeIndex));
  return enabledIndexes[rovingIndex(key, currentPosition, enabledIndexes.length)];
}

// เริ่มหาจากตัวถัดจากที่โฟกัสอยู่แล้ววนกลับมา พิมพ์ตัวเดิมซ้ำจะได้ไปตัวถัดไปที่ขึ้นต้นเหมือนกัน
function findByTypeahead(options: DropdownOption[], enabledIndexes: number[], activeIndex: number, query: string) {
  const startPosition = Math.max(0, enabledIndexes.indexOf(activeIndex));
  const searchOrder = [...enabledIndexes.slice(startPosition + 1), ...enabledIndexes.slice(0, startPosition + 1)];
  return searchOrder.find((index) => options[index].label.trim().toLocaleLowerCase("th-TH").startsWith(query));
}

// จุดที่เมนูควรเปิดมาโฟกัส ขึ้นกับปุ่มที่กดเปิด
type OpenPreference = "first" | "last" | "selected";

// ตัวเลือกที่จะโฟกัสตอนเพิ่งเปิดเมนู ค่าที่เลือกอยู่ถ้ามี ไม่มีก็ตัวแรก
function openingIndex(preference: OpenPreference, enabledIndexes: number[], selectedIndex: number) {
  if (preference === "first") return enabledIndexes[0];
  if (preference === "last") return enabledIndexes.at(-1) ?? enabledIndexes[0];
  return selectedIndex >= 0 ? selectedIndex : enabledIndexes[0];
}

// ลูกศรขึ้นกับ End เปิดมาที่ตัวท้าย Home เปิดมาที่ตัวแรก ที่เหลือเปิดมาที่ค่าที่เลือกอยู่
function openPreferenceFor(key: string): OpenPreference {
  if (key === "ArrowUp" || key === "End") return "last";
  return key === "Home" ? "first" : "selected";
}

export function DropdownField({
  ariaLabel,
  disabled = false,
  label,
  name,
  onChange,
  options,
  value,
}: Readonly<{
  ariaLabel?: string;
  disabled?: boolean;
  label?: string;
  name?: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  value: string;
}>) {
  const id = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // เก็บตัวอักษรที่พิมพ์ไล่หา เช่นพิมพ์ "กท" เร็ว ๆ เพื่อกระโดดไปตัวเลือกที่ขึ้นต้นแบบนั้น
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [canScrollMore, setCanScrollMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // หาไม่เจอก็ใช้ตัวแรกแทน กันปุ่มว่างเปล่าตอนค่าที่ส่งมาไม่ตรงกับตัวเลือกไหนเลย
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  // เก็บเฉพาะลำดับของตัวเลือกที่เลือกได้ ใช้ตอนเลื่อนด้วยลูกศรจะได้ข้ามตัวที่ปิดไว้
  const enabledIndexes = options.flatMap((option, index) => option.disabled ? [] : [index]);

  const focusOption = (index: number) => {
    setActiveIndex(index);
    // รอให้ปุ่มถูกวาดก่อนค่อยโฟกัส เพราะตอนเพิ่งเปิดเมนูยังไม่มีปุ่มอยู่ใน DOM
    window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>(`[data-option-index="${index}"]`)?.focus();
    });
  };

  // เปิดเมนูแล้วเลือกว่าจะไปโฟกัสตัวไหน ขึ้นกับว่าผู้ใช้กดปุ่มอะไรมา
  const openAndFocus = (preference: "first" | "last" | "selected" = "selected") => {
    if (!enabledIndexes.length) return;
    // ปกติเปิดมาแล้วโฟกัสที่ค่าที่เลือกอยู่ ผู้ใช้จะได้รู้ว่าตอนนี้เป็นอะไร
    const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled);
    const index = openingIndex(preference, enabledIndexes, selectedIndex);
    setIsOpen(true);
    focusOption(index);
  };

  // ปิดแล้วคืนโฟกัสให้ปุ่ม ไม่งั้นโฟกัสจะตกไปที่ body แล้วต้อง Tab ใหม่จากต้นหน้า
  const closeAndRestoreFocus = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    // ผูก listener เฉพาะตอนเมนูเปิด ปิดแล้วไม่ต้องไปกวน event ของทั้งหน้า
    if (!isOpen) return;

    // คลิกที่ไหนก็ได้นอกกล่องแล้วปิด แต่ไม่คืนโฟกัส เพราะผู้ใช้กำลังจะไปกดที่อื่นอยู่แล้ว
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isOpen]);

  // ล้าง timer ของ typeahead ตอนถูกถอดออกจากหน้า กันมันไปทำงานทีหลัง
  useEffect(() => () => {
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setHasOverflow(false);
      setCanScrollMore(false);
      return;
    }

    // ดูว่ารายการยาวเกินกล่องไหม และยังเลื่อนลงได้อีกหรือเปล่า
    // เอาไว้โชว์ลูกศรบอกว่ายังมีตัวเลือกอยู่ข้างล่าง ไม่งั้นผู้ใช้นึกว่ามีแค่ที่เห็น
    const updateOverflow = () => {
      const menu = menuRef.current;
      const isScrollable = Boolean(menu && menu.scrollHeight > menu.clientHeight + 1);
      setHasOverflow(isScrollable);
      setCanScrollMore(Boolean(menu && isScrollable && menu.scrollTop + menu.clientHeight < menu.scrollHeight - 2));
    };

    // วัดหลัง render เพราะตอนนี้ยังไม่รู้ความสูงจริงของเมนู
    const frame = window.requestAnimationFrame(updateOverflow);
    const menu = menuRef.current;
    menu?.addEventListener("scroll", updateOverflow);
    window.addEventListener("resize", updateOverflow);
    return () => {
      window.cancelAnimationFrame(frame);
      menu?.removeEventListener("scroll", updateOverflow);
      window.removeEventListener("resize", updateOverflow);
    };
  }, [isOpen, options.length]);

  // แป้นพิมพ์ในเมนู ปิดเมนู เลื่อนตัวเลือก และพิมพ์เพื่อค้นหา
  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }
    // Tab ปิดเมนูแต่ไม่คืนโฟกัส ปล่อยให้ Tab พาไปช่องถัดไปตามปกติ
    if (event.key === "Tab") {
      setIsOpen(false);
      return;
    }
    if (!enabledIndexes.length) return;
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      focusOption(nextOptionIndex(event.key, enabledIndexes, activeIndex));
      return;
    }
    // เหลือแค่การพิมพ์ตัวอักษรเดี่ยว ๆ ปุ่มที่กดพร้อม Ctrl หรือ Cmd เป็นคำสั่งอื่น ไม่ใช่การพิมพ์
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
    typeaheadRef.current += event.key.toLocaleLowerCase("th-TH");
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    // หยุดพิมพ์เกิน 0.7 วินาทีก็ล้างคำค้น ถือว่าเริ่มหาคำใหม่
    typeaheadTimerRef.current = setTimeout(() => { typeaheadRef.current = ""; }, 700);
    const match = findByTypeahead(options, enabledIndexes, activeIndex, typeaheadRef.current);
    if (match !== undefined) focusOption(match);
  };

  return (
    <div className="dropdown-field" ref={rootRef}>
      {/* ช่องซ่อนไว้ให้ฟอร์มธรรมดาส่งค่าไปได้ เพราะปุ่มข้างล่างไม่ใช่ select จริง */}
      {name ? <input name={name} type="hidden" value={value} /> : null}
      {label ? <span className="dropdown-label" id={`${id}-label`}>{label}</span> : null}
      <button
        aria-label={!label ? ariaLabel : undefined}
        aria-controls={`${id}-listbox`}
        aria-expanded={isOpen}
        // haspopup กับ controls บอกโปรแกรมอ่านหน้าจอว่าปุ่มนี้คุมรายการตัวเลือกอันไหน
        aria-haspopup="listbox"
        aria-labelledby={label ? `${id}-label` : undefined}
        className={`dropdown-trigger${isOpen ? " open" : ""}`}
        disabled={disabled}
        onClick={() => isOpen ? setIsOpen(false) : openAndFocus()}
        onKeyDown={(event) => {
          // ลูกศรบนปุ่มคือเปิดเมนู ลงกับ Home ไปตัวแรก บนกับ End ไปตัวสุดท้าย
          if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
            // กันหน้าเลื่อนตามลูกศรไปด้วย
            event.preventDefault();
            openAndFocus(openPreferenceFor(event.key));
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span className="dropdown-trigger-value">{selectedOption?.label ?? "เลือกข้อมูล"}</span>
        <ChevronDown aria-hidden="true" className={isOpen ? "open" : ""} size={20} />
      </button>
      {isOpen ? (
        <div className="dropdown-popover">
          <div
            className={hasOverflow && canScrollMore ? "dropdown-menu has-scroll-indicator" : "dropdown-menu"}
            id={`${id}-listbox`}
            onKeyDown={handleMenuKeyDown}
            ref={menuRef}
            role="listbox"
          >
            {/* หัวข้อคั่นบนสุดของรายการ ทำให้เมนูดูมีขอบเขตชัดกว่ากล่องลอย ๆ */}
            <div className="dropdown-menu-heading">ตัวเลือกทั้งหมด</div>
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <button
                  aria-selected={isSelected}
                  className={isSelected ? "selected" : ""}
                  data-option-index={index}
                  disabled={option.disabled}
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    closeAndRestoreFocus();
                  }}
                  onFocus={() => setActiveIndex(index)}
                  role="option"
                  // มีแค่ตัวเดียวที่ Tab เข้าถึงได้ ที่เหลือเลื่อนด้วยลูกศรแทน ตามมาตรฐาน listbox
                  tabIndex={index === activeIndex ? 0 : -1}
                  type="button"
                >
                  <span className="dropdown-option-label">{option.label}</span>
                  <span className="dropdown-check">{isSelected ? <Check size={18} /> : null}</span>
                </button>
              );
            })}
          </div>
          {hasOverflow && canScrollMore ? (
            <div className="dropdown-scroll-indicator" aria-hidden="true">
              <ChevronDown size={18} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
