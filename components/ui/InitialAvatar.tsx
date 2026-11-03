import { firstInitial } from "@/lib/account-initials";

// วงกลมตัวอักษรแรกของชื่อแบบ Discord สีคงที่ตามชื่อ คนเดิมได้สีเดิมทุกหน้า
// ใช้ตัวอักษรตัวเดียวพอ ชื่อไทยตัดสองตัวแล้วมักได้คำแปลก ๆ อย่าง "สุสุ"

const toneCount = 5;

function toneOf(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return hash % toneCount;
}

export function InitialAvatar({ name, size = "md" }: Readonly<{ name: string; size?: "sm" | "md" | "lg" }>) {
  const initial = firstInitial(name);
  return <span aria-hidden="true" className="initial-avatar" data-size={size} data-tone={toneOf(name)}>{initial}</span>;
}
