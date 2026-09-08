"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Account Approval Actions” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { useState } from "react";
import { Building2, Check, KeyRound, X } from "lucide-react";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { IconButton } from "@/components/ui/IconButton";
import { Dialog } from "@/components/ui/Dialog";
import { ActionMenu } from "@/components/ui/ActionMenu";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Account Approval Actions” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { displayName, memberships, status, userId, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function AccountApprovalActions({
  displayName,
  memberships,
  status,
  userId,
}: {
  displayName: string;
  memberships: Array<{ id: string; name: string }>;
  status: "PENDING" | "APPROVED" | "REJECTED";
  userId: string;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [editingMemberships, setEditingMemberships] = useState(false);
  const [properties, setProperties] = useState<Array<{ id: string; name: string; isActive: boolean }>>([]);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “[selected Property Ids, set Selected Property Ids]” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const [selectedPropertyIds, setSelectedPropertyIds] = useState(() => memberships.map(({ id }) => id));
  const [loadingProperties, setLoadingProperties] = useState(false);
  const { confirm, confirmationDialog } = useConfirmation();

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “review” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - nextStatus: ค่า “next Status” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async function review(nextStatus: "APPROVED" | "REJECTED") {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/super-admin/users/${userId}/approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          ...(nextStatus === "REJECTED" ? { rejectionReason: reason } : {}),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "ตรวจสอบบัญชีไม่สำเร็จ");
      window.location.reload();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "ตรวจสอบบัญชีไม่สำเร็จ");
      setPending(false);
    }
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “issue Password” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async function issuePassword() {
    if (!await confirm({ title: "ออกรหัสผ่านชั่วคราวใหม่?", description: `รหัสเดิมและเซสชันทั้งหมดของ ${displayName} จะถูกยกเลิก`, confirmLabel: "ออกรหัสใหม่" })) return;
    setPending(true); setError(""); setTemporaryPassword("");
    try {
      const response = await fetch(`/api/v1/super-admin/users/${userId}/temporary-password`, { method: "POST" });
      const payload = await response.json() as { data?: { temporaryPassword: string }; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "ออกรหัสผ่านชั่วคราวไม่สำเร็จ");
      setTemporaryPassword(payload.data.temporaryPassword);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ออกรหัสผ่านชั่วคราวไม่สำเร็จ"); }
    finally { setPending(false); }
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “open Membership Editor” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async function openMembershipEditor() {
    setEditingMemberships(true);
    setSelectedPropertyIds(memberships.map(({ id }) => id));
    setError("");
    if (properties.length) return;
    setLoadingProperties(true);
    try {
      const allProperties: Array<{ id: string; name: string; isActive: boolean }> = [];
      let page = 1;
      let hasNextPage = true;
      while (hasNextPage) {
        const response = await fetch(`/api/v1/super-admin/properties?page=${page}&pageSize=100`, { cache: "no-store" });
        const payload = await response.json() as { data?: typeof allProperties; pageInfo?: { hasNextPage: boolean }; error?: string };
        if (!response.ok || !payload.data || !payload.pageInfo) throw new Error(payload.error || "โหลดรายการหอพักไม่สำเร็จ");
        allProperties.push(...payload.data);
        hasNextPage = payload.pageInfo.hasNextPage;
        page += 1;
      }
      setProperties(allProperties);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "โหลดรายการหอพักไม่สำเร็จ");
    } finally {
      setLoadingProperties(false);
    }
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “save Memberships” โดยใช้ค่าที่รับเข้ามา
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async function saveMemberships() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/super-admin/users/${userId}/memberships`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyIds: selectedPropertyIds }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "บันทึกหอพักที่รับผิดชอบไม่สำเร็จ");
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "บันทึกหอพักที่รับผิดชอบไม่สำเร็จ");
      setPending(false);
    }
  }

  const items = [
    { disabled: pending, icon: <Building2 aria-hidden="true" size={16} />, id: "memberships", label: "แก้ไขหอพักที่รับผิดชอบ", onSelect: () => void openMembershipEditor() },
    ...(status === "APPROVED" ? [{ disabled: pending, icon: <KeyRound aria-hidden="true" size={16} />, id: "temporary-password", label: "ออกรหัสผ่านชั่วคราว", onSelect: () => void issuePassword() }] : []),
    ...(status === "PENDING" ? [
      { disabled: pending, icon: <Check aria-hidden="true" size={16} />, id: "approve", label: "อนุมัติบัญชี", onSelect: () => void review("APPROVED" as const) },
      { disabled: pending, icon: <X aria-hidden="true" size={16} />, id: "reject", label: "ไม่อนุมัติบัญชี", onSelect: () => setRejecting(true), variant: "danger" as const },
    ] : []),
  ];

  return <div className="grid gap-2">
    <ActionMenu items={items} label={`จัดการบัญชี ${displayName}`} />
    {temporaryPassword ? <div className="form-alert" role="status"><strong>แสดงครั้งเดียว:</strong> <code>{temporaryPassword}</code></div> : null}
    {error ? <p className="form-alert error" role="alert">{error}</p> : null}
    {editingMemberships ? <Dialog ariaDescribedBy="account-memberships-description" ariaLabelledBy="account-memberships-title" onClose={() => { if (!pending) setEditingMemberships(false); }}>
      <header className="modal-header"><div><h2 id="account-memberships-title">หอพักที่รับผิดชอบ</h2><p id="account-memberships-description">เลือกหอพักที่ {displayName} สามารถเข้าถึงและจัดการได้</p></div><IconButton disabled={pending} label="ปิด" onClick={() => setEditingMemberships(false)} tooltip="ปิดหน้าต่างแก้ไขหอพัก"><X /></IconButton></header>
      <div className="modal-form">
        {loadingProperties ? <p aria-live="polite">กำลังโหลดรายการหอพัก...</p> : properties.length ? <fieldset><legend>เลือกหอพัก</legend><div className="grid max-h-80 gap-2 overflow-y-auto rounded-xl border border-[#d9dae0] p-3">{properties.map((property) => { const selected = selectedPropertyIds.includes(property.id); return <label className="flex min-h-11 items-center gap-3" key={property.id}><input checked={selected} disabled={pending || (!property.isActive && !selected)} onChange={(event) => setSelectedPropertyIds((current) => event.target.checked ? [...current, property.id] : current.filter((id) => id !== property.id))} type="checkbox" /><span>{property.name}{!property.isActive ? " (ปิดใช้งาน—นำออกได้เท่านั้น)" : ""}</span></label>; })}</div></fieldset> : <p>ไม่พบหอพักที่เลือกได้</p>}
        <p className="text-sm opacity-65">เลือกแล้ว {selectedPropertyIds.length.toLocaleString("th-TH")} หอ การบันทึกจะออกจากระบบบัญชีนี้ทุกอุปกรณ์เพื่ออัปเดตสิทธิ์ทันที</p>
        <footer className="modal-actions"><button disabled={pending} onClick={() => setEditingMemberships(false)} type="button">ยกเลิก</button><button className="primary-button" disabled={pending || loadingProperties} onClick={() => void saveMemberships()} type="button">{pending ? "กำลังบันทึก..." : "บันทึกหอพัก"}</button></footer>
      </div>
    </Dialog> : null}
    {rejecting ? <Dialog ariaDescribedBy="account-rejection-description" ariaLabelledBy="account-rejection-title" onClose={() => setRejecting(false)}>
        <header className="modal-header"><div><h2 id="account-rejection-title">ไม่อนุมัติบัญชี</h2><p id="account-rejection-description">{displayName}</p></div><IconButton label="ปิด" onClick={() => setRejecting(false)} tooltip="ปิดหน้าต่างไม่อนุมัติบัญชี"><X /></IconButton></header>
        <div className="modal-form">
          <label><span>เหตุผล</span><textarea maxLength={500} minLength={2} onChange={(event) => setReason(event.target.value)} required value={reason} /></label>
          {error ? <p className="form-alert error" role="alert">{error}</p> : null}
          <footer className="modal-actions"><button disabled={pending} onClick={() => setRejecting(false)} type="button">ยกเลิก</button><button aria-describedby={!pending && reason.trim().length < 2 ? "account-rejection-disabled-reason" : undefined} className="primary-button danger-confirm-button" disabled={pending || reason.trim().length < 2} onClick={() => void review("REJECTED")} type="button">ยืนยันไม่อนุมัติ</button></footer>
          {!pending && reason.trim().length < 2 ? <p className="disabled-reason justify-self-end" id="account-rejection-disabled-reason">ระบุเหตุผลอย่างน้อย 2 ตัวอักษรก่อนยืนยัน</p> : null}
        </div>
    </Dialog> : null}
    {confirmationDialog}
  </div>;
}
