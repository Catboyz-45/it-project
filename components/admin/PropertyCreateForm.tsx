"use client";
// ปุ่มและกล่องสร้างหอพักใหม่ของผู้ดูแลระบบ

import { SyntheticEvent, useState } from "react";
import { Plus, X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { postJson } from "@/components/admin/super-admin-options";

export function PropertyCreateForm() {
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
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await postJson("/api/super-admin/properties", { name: form.get("name"), shortName: form.get("shortName") });
      // โหลดหน้าใหม่ทั้งหมด เพราะตารางถูกวาดมาจากฝั่งเซิร์ฟเวอร์
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
      setPending(false);
    }
  };

  return <>
    <button className="primary-button" onClick={() => { setMessage(""); setIsOpen(true); }} type="button"><Plus size={18} /> เพิ่มหอพัก</button>
    {isOpen ? <Dialog ariaDescribedBy="property-create-description" ariaLabelledBy="property-create-title" className="modal-md" onClose={closeDialog}>
      <header className="modal-header"><div><h2 id="property-create-title">เพิ่มหอพัก</h2><p id="property-create-description">สร้างพื้นที่ใหม่สำหรับเจ้าของหอและผู้เช่าในระบบ</p></div><IconButton disabled={pending} label="ปิด" onClick={closeDialog} tooltip="ปิดหน้าต่างเพิ่มหอพัก"><X /></IconButton></header>
      <form className="modal-form" onSubmit={submit}>
        <label>ชื่อเต็ม <input maxLength={160} minLength={2} name="name" required /></label>
        <label>ชื่อย่อ <input maxLength={80} name="shortName" required /></label>
        {message ? <p className="form-alert error" role="alert">{message}</p> : null}
        <footer className="modal-actions"><button disabled={pending} onClick={closeDialog} type="button">ยกเลิก</button><button className="primary-button" disabled={pending} type="submit"><Plus size={18} /> {pending ? "กำลังเพิ่ม..." : "เพิ่มหอพัก"}</button></footer>
      </form>
    </Dialog> : null}
  </>;
}
