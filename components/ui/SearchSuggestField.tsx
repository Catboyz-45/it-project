"use client";
// ช่องค้นหาที่แนะนำคำระหว่างพิมพ์ ดักคีย์บอร์ดและโฟกัสของเบราว์เซอร์

import { Search } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";

export type SearchSuggestion = {
  // ค่าที่จะใส่ลงช่องค้นหาเมื่อเลือก
  value: string;
  // ข้อความรองด้านขวา เช่นบอกว่าเป็นชื่อหอหรือแพ็กเกจ
  detail?: string;
};

// ตัวหนาเฉพาะส่วนที่ตรงกับที่พิมพ์ ผู้ใช้จะเห็นทันทีว่าทำไมคำนี้ถูกแนะนำ
function HighlightedText({ query, text }: Readonly<{ query: string; text: string }>) {
  const index = query ? text.toLocaleLowerCase("th").indexOf(query.toLocaleLowerCase("th")) : -1;
  if (index < 0) return <>{text}</>;
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
}

// combobox ตามแบบ ARIA: ลูกศรเลื่อนในรายการ Enter เลือก Esc ปิด โฟกัสอยู่ที่ช่องพิมพ์ตลอด
export function SearchSuggestField({
  label,
  onChange,
  placeholder,
  suggestions,
  value,
}: Readonly<{
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions: SearchSuggestion[];
  value: string;
}>) {
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const query = value.trim();
  // ไม่ซ้ำกับสิ่งที่พิมพ์ครบแล้ว และต้องมีคำที่พิมพ์ถึงจะเปิดรายการ
  const visible = isOpen && query.length > 0 && suggestions.some((item) => item.value !== value);
  const optionId = (index: number) => `${listId}-option-${index}`;

  const pick = (suggestion: SearchSuggestion) => {
    onChange(suggestion.value);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && visible) {
      // ปิดรายการก่อน กด Esc ครั้งเดียวจะได้ไม่ไปปิดป็อปอัพหรือลิ้นชักที่ครอบอยู่
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!suggestions.length) return;
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => {
        if (event.key === "ArrowDown") return current >= suggestions.length - 1 ? 0 : current + 1;
        return current <= 0 ? suggestions.length - 1 : current - 1;
      });
      return;
    }
    if (event.key === "Enter" && visible && activeIndex >= 0) {
      event.preventDefault();
      pick(suggestions[activeIndex]);
    }
  };

  return <div className="search-suggest">
    <label className="search-suggest-field">
      <span className="sr-only">{label}</span>
      <Search aria-hidden="true" size={16} />
      <input
        aria-activedescendant={visible && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={visible}
        autoComplete="off"
        // รอให้คลิกตัวเลือกทำงานก่อนค่อยปิด ไม่งั้นรายการหายไปก่อนที่คลิกจะไปถึง
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onChange={(event) => { onChange(event.target.value); setIsOpen(true); setActiveIndex(-1); }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        type="search"
        value={value}
      />
    </label>
    <ul aria-label={`คำแนะนำสำหรับ${label}`} className="search-suggest-list" hidden={!visible} id={listId} role="listbox">
      {suggestions.map((suggestion, index) => <li
        aria-selected={index === activeIndex}
        id={optionId(index)}
        key={`${suggestion.value}-${suggestion.detail ?? ""}`}
        // mousedown กันช่องพิมพ์เสียโฟกัสก่อนเลือก
        onMouseDown={(event) => { event.preventDefault(); pick(suggestion); }}
        role="option"
      >
        <span><HighlightedText query={query} text={suggestion.value} /></span>
        {suggestion.detail ? <small>{suggestion.detail}</small> : null}
      </li>)}
    </ul>
  </div>;
}
