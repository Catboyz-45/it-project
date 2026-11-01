"use client";
// ปุ่มและกล่องแก้ไขหอพักของผู้ดูแลระบบ เปลี่ยนชื่อ ชื่อย่อ และเปิดปิดหอ

import { SyntheticEvent, useState } from "react";
import { Pencil, X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { readApiPayload } from "@/lib/client/api-error";
import { reloadWithToast } from "@/lib/client/reload-with-toast";

export function PropertyEditForm({ property }: Readonly<{
  property: { id: string; name: string; shortName: string; isActive: boolean };
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const closeDialog = () => {
    // ห้ามปิดตอนกำลังบันทึก จะได้ไม่ค้างว่าบันทึกไปแล้วหรือยัง
    if (pending) return;
    setMessage("");
    setIsOpen(false);
  };

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/v1/super-admin/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          shortName: form.get("shortName"),
          isActive: form.get("isActive") === "on",
        }),
      });
      await readApiPayload(response, "บันทึกหอพักไม่สำเร็จ");
      reloadWithToast("บันทึกหอพักแล้ว");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกหอพักไม่สำเร็จ");
      setPending(false);
    }
  };

  return <>
    <button className="secondary-button" onClick={() => { setMessage(""); setIsOpen(true); }} type="button">
      <Pencil aria-hidden="true" size={16} /> แก้ไขหอพัก
    </button>
    {isOpen ? <Dialog ariaDescribedBy="property-edit-description" ariaLabelledBy="property-edit-title" className="modal-md" onClose={closeDialog}>
      <header className="modal-header">
        <div><h2 id="property-edit-title">แก้ไขหอพัก</h2><p id="property-edit-description">หอที่ปิดใช้งานจะไม่นับเป็นสมาชิก และเจ้าของหอจะเข้าจัดการหอนี้ไม่ได้</p></div>
        <IconButton disabled={pending} label="ปิด" onClick={closeDialog} tooltip="ปิดหน้าต่างแก้ไขหอพัก"><X /></IconButton>
      </header>
      <form className="modal-form" onSubmit={submit}>
        <label>ชื่อเต็ม <input defaultValue={property.name} maxLength={160} minLength={2} name="name" required /></label>
        <label>ชื่อย่อ <input defaultValue={property.shortName} maxLength={80} name="shortName" required /></label>
        <label className="flex items-center gap-2">
          <input className="size-4 min-h-0" defaultChecked={property.isActive} name="isActive" type="checkbox" /> เปิดใช้งานหอพัก
        </label>
        {message ? <p className="form-alert error" role="alert">{message}</p> : null}
        <footer className="modal-actions">
          <button disabled={pending} onClick={closeDialog} type="button">ยกเลิก</button>
          <button className="primary-button" disabled={pending} type="submit">{pending ? "กำลังบันทึก..." : "บันทึก"}</button>
        </footer>
      </form>
    </Dialog> : null}
  </>;
}
