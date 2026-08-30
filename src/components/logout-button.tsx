/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React logout-button ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { LoadingLabel } from "./loading-label";
import { setFlashMessage } from "@/lib/client-flash";
/** สร้างส่วนหน้าจอ LogoutButton; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function LogoutButton({
  labeled = false,
  danger = false,
}: {
  labeled?: boolean;
  danger?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    if (busy) return;
    setBusy(true);
    const response = await fetch("/api/auth/logout", { method: "POST" }).catch(
      () => null,
    );
    if (response?.ok) {
      setFlashMessage("ออกจากระบบเรียบร้อยแล้ว", "info");
      router.replace("/login");
      router.refresh();
    } else setBusy(false);
  }
  return (
    <button
      type="button"
      className={
        labeled
          ? "account-action danger"
          : `icon-btn${danger ? " logout-danger" : ""}`
      }
      onClick={logout}
      disabled={busy}
      aria-label={busy ? "กำลังออกจากระบบ" : "ออกจากระบบ"}
      aria-busy={busy}
    >
      <LoadingLabel busy={busy} busyText="กำลังออกจากระบบ…">
        <>
          <LogOut size={18} />
          {labeled && <span>ออกจากระบบ</span>}
        </>
      </LoadingLabel>
    </button>
  );
}
