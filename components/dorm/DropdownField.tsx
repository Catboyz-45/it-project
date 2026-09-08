"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Dropdown Field” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Dropdown Option” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type DropdownOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Dropdown Field” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { ariaLabel, disabled = false, label, name, onChange, option: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function DropdownField({
  ariaLabel,
  disabled = false,
  label,
  name,
  onChange,
  options,
  value,
}: {
  ariaLabel?: string;
  disabled?: boolean;
  label?: string;
  name?: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  value: string;
}) {
  const id = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [canScrollMore, setCanScrollMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “enabled Indexes” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - option: ค่า “option” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - index: ค่า “index” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const enabledIndexes = options.flatMap((option, index) => option.disabled ? [] : [index]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “focus Option” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - index: ค่า “index” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const focusOption = (index: number) => {
    setActiveIndex(index);
    window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>(`[data-option-index="${index}"]`)?.focus();
    });
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “open And Focus” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - preference: ค่า “preference” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const openAndFocus = (preference: "first" | "last" | "selected" = "selected") => {
    if (!enabledIndexes.length) return;
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “selected Index” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - option: ค่า “option” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled);
    const index = preference === "first"
      ? enabledIndexes[0]
      : preference === "last"
        ? enabledIndexes[enabledIndexes.length - 1]
        : selectedIndex >= 0 ? selectedIndex : enabledIndexes[0];
    setIsOpen(true);
    focusOption(index);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close And Restore Focus” ตามกฎของระบบ
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const closeAndRestoreFocus = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;

    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close On Outside Click” ตามกฎของระบบ
     * รับค่า:
     * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isOpen]);

  useEffect(() => () => {
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setHasOverflow(false);
      setCanScrollMore(false);
      return;
    }

    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Overflow” โดยใช้ค่าที่รับเข้ามา
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const updateOverflow = () => {
      const menu = menuRef.current;
      const isScrollable = Boolean(menu && menu.scrollHeight > menu.clientHeight + 1);
      setHasOverflow(isScrollable);
      setCanScrollMore(Boolean(menu && isScrollable && menu.scrollTop + menu.clientHeight < menu.scrollHeight - 2));
    };

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

  return (
    <div className="dropdown-field" ref={rootRef}>
      {name ? <input name={name} type="hidden" value={value} /> : null}
      {label ? <span className="dropdown-label" id={`${id}-label`}>{label}</span> : null}
      <button
        aria-label={!label ? ariaLabel : undefined}
        aria-controls={`${id}-listbox`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={label ? `${id}-label` : undefined}
        className={`dropdown-trigger${isOpen ? " open" : ""}`}
        disabled={disabled}
        onClick={() => isOpen ? setIsOpen(false) : openAndFocus()}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
            event.preventDefault();
            openAndFocus(event.key === "ArrowUp" || event.key === "End" ? "last" : event.key === "Home" ? "first" : "selected");
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
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeAndRestoreFocus();
                return;
              }
              if (event.key === "Tab") {
                setIsOpen(false);
                return;
              }
              if (!enabledIndexes.length) return;
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                const currentPosition = Math.max(0, enabledIndexes.indexOf(activeIndex));
                const nextIndex = event.key === "Home"
                  ? enabledIndexes[0]
                  : event.key === "End"
                    ? enabledIndexes[enabledIndexes.length - 1]
                    : event.key === "ArrowDown"
                      ? enabledIndexes[(currentPosition + 1) % enabledIndexes.length]
                      : enabledIndexes[(currentPosition - 1 + enabledIndexes.length) % enabledIndexes.length];
                focusOption(nextIndex);
                return;
              }
              if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
              typeaheadRef.current += event.key.toLocaleLowerCase("th-TH");
              if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
              typeaheadTimerRef.current = setTimeout(() => { typeaheadRef.current = ""; }, 700);
              const query = typeaheadRef.current;
              const startPosition = Math.max(0, enabledIndexes.indexOf(activeIndex));
              const searchOrder = [...enabledIndexes.slice(startPosition + 1), ...enabledIndexes.slice(0, startPosition + 1)];
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “match” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - index: ค่า “index” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const match = searchOrder.find((index) => options[index].label.trim().toLocaleLowerCase("th-TH").startsWith(query));
              if (match !== undefined) focusOption(match);
            }}
            ref={menuRef}
            role="listbox"
          >
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
