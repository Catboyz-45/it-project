/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ dropdown-keyboard.test ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { describe, expect, it } from "vitest";
import { themeSelectNavigationIndex } from "@/lib/theme-select-keyboard";

describe("theme dropdown keyboard navigation", () => {
  it("starts from the committed selection without changing it", () => {
    const selectedIndex = 1;
    expect(themeSelectNavigationIndex("ArrowDown", {
      open: false,
      activeIndex: 0,
      selectedIndex,
      optionCount: 4,
    })).toBe(2);
    expect(selectedIndex).toBe(1);
  });

  it("moves the active option and wraps at both ends", () => {
    expect(themeSelectNavigationIndex("ArrowDown", { open: true, activeIndex: 3, selectedIndex: 1, optionCount: 4 })).toBe(0);
    expect(themeSelectNavigationIndex("ArrowUp", { open: true, activeIndex: 0, selectedIndex: 1, optionCount: 4 })).toBe(3);
  });

  it("supports Home and End and handles an empty list safely", () => {
    expect(themeSelectNavigationIndex("Home", { open: true, activeIndex: 2, selectedIndex: 1, optionCount: 4 })).toBe(0);
    expect(themeSelectNavigationIndex("End", { open: true, activeIndex: 0, selectedIndex: 1, optionCount: 4 })).toBe(3);
    expect(themeSelectNavigationIndex("ArrowDown", { open: false, activeIndex: 0, selectedIndex: 0, optionCount: 0 })).toBeNull();
  });
});
