"use client";
// island เล็ก ๆ สำหรับสลับมุมมองปัจจุบัน/ประวัติ เก็บค่าไว้ใน URL ไม่ใช่ใน state
// หน้าจึงถูก render จากเซิร์ฟเวอร์ได้ และกดย้อนกลับหรือแชร์ลิงก์มาที่แท็บเดิมได้
import { useRouter } from "next/navigation";
import { useTablistKeyboard } from "@/components/ui/use-tablist-keyboard";
import type { TenantRecordView } from "@/lib/tenant-record-view";

export function RecordViewTabs({
  currentLabel,
  historyLabel,
  id,
  path,
  view,
}: Readonly<{
  currentLabel: string;
  historyLabel: string;
  id: string;
  path: string;
  view: TenantRecordView;
}>) {
  const router = useRouter();
  // ปัจจุบันเป็นค่าเริ่มต้นอยู่แล้ว จึงไม่ต้องใส่ไว้ใน URL ให้รก
  const go = (next: TenantRecordView) => router.push(next === "current" ? path : `${path}?view=${next}`);
  const handleKeyDown = useTablistKeyboard(["current", "history"] as const, go);
  const tabs = [
    { label: currentLabel, value: "current" as const },
    { label: historyLabel, value: "history" as const },
  ];
  return <div aria-label="เลือกประเภทข้อมูล" className="figma-inline-tabs invoice-tabs" onKeyDown={handleKeyDown} role="tablist">
    {tabs.map((tab) => <button
      aria-controls={`${id}-panel`}
      aria-selected={view === tab.value}
      className={view === tab.value ? "active" : ""}
      id={`${id}-tab-${tab.value}`}
      key={tab.value}
      onClick={() => go(tab.value)}
      tabIndex={view === tab.value ? 0 : -1}
      role="tab"
      type="button"
    >
      {tab.label}
    </button>)}
  </div>;
}
