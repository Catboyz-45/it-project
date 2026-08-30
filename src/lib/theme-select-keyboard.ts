/**
 * หน้าที่ของไฟล์นี้: ฟังก์ชันช่วยเหลือ theme-select-keyboard ที่รวมตรรกะใช้ซ้ำและไม่มีหน้าจอเป็นของตัวเอง
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
export type ThemeSelectNavigationKey =
  | "ArrowDown"
  | "ArrowUp"
  | "Home"
  | "End";

type NavigationState = {
  open: boolean;
  activeIndex: number;
  selectedIndex: number;
  optionCount: number;
};

/** คำนวณตัวเลือกถัดไปเมื่อกดลูกศร/Home/End โดยรองรับการวนกลับต้นและท้าย */
export function themeSelectNavigationIndex(
  key: ThemeSelectNavigationKey,
  state: NavigationState,
): number | null {
  if (state.optionCount <= 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return state.optionCount - 1;

  const origin = state.open ? state.activeIndex : state.selectedIndex;
  const direction = key === "ArrowDown" ? 1 : -1;
  return (origin + direction + state.optionCount) % state.optionCount;
}
