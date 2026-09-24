"use client";
// ปุ่มและกล่องสร้างบัญชีแอดมินประจำหอ พร้อมกำหนดตั้งแต่แรกว่าดูแลหอไหนได้บ้าง

import { SyntheticEvent, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { postJson, type PropertyOption, usePagedOptions } from "@/components/admin/super-admin-options";

// รายการหอให้ติ๊กเลือก พร้อมปุ่มโหลดเพิ่มเมื่อยังมีหน้าถัดไป
function PropertyPicker({ onToggle, properties, selectedPropertyIds }: Readonly<{
  onToggle: (propertyId: string, checked: boolean) => void;
  properties: ReturnType<typeof usePagedOptions<PropertyOption>>;
  selectedPropertyIds: string[];
}>) {
  const isEmpty = properties.items.length === 0;
  return <fieldset className="grid max-h-64 gap-2 overflow-y-auto">
    <legend>หอพักที่ดูแล</legend>
    {properties.items.map((property) => <label className="rounded-xl bg-[#f6f7fa] px-3" key={property.id}>
      <input checked={selectedPropertyIds.includes(property.id)} onChange={(event) => onToggle(property.id, event.target.checked)} type="checkbox" /> {property.name}
    </label>)}
    {properties.query.trim() && isEmpty ? <SearchEmptyState description="ลองใช้ชื่อหรือชื่อย่ออื่น" title="ไม่พบหอพักที่ค้นหา" /> : null}
    {properties.hasMore ? <button className="secondary-button" onClick={properties.loadMore} type="button">โหลดหอพักเพิ่มเติม</button> : null}
  </fieldset>;
}

export function AdminAccountForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const properties = usePagedOptions<PropertyOption>({
    endpoint: "/api/v1/super-admin/properties",
    errorMessage: "โหลดหอพักไม่สำเร็จ",
    onError: setMessage,
  });
  // ไม่มีหอพักก็สร้างบัญชีแอดมินไม่ได้ เพราะบัญชีต้องผูกกับหออย่างน้อยหนึ่งแห่ง
  const hasNoProperties = properties.items.length === 0;

  const closeDialog = () => {
    // ห้ามปิดตอนกำลังบันทึก จะได้ไม่ค้างว่าบันทึกไปแล้วหรือยัง
    if (pending) return;
    setMessage("");
    setIsOpen(false);
  };

  const togglePropertySelection = (propertyId: string, checked: boolean) => {
    setSelectedPropertyIds((current) => checked
      ? [...new Set([...current, propertyId])]
      : current.filter((id) => id !== propertyId));
  };

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await postJson("/api/super-admin/users", {
        email: form.get("email"),
        displayName: form.get("displayName"),
        password: form.get("password"),
        propertyIds: selectedPropertyIds,
      });
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
      setPending(false);
    }
  };

  return <>
    <button className="primary-button" onClick={() => { setMessage(""); setIsOpen(true); }} type="button"><UserPlus size={18} /> เพิ่มแอดมินประจำหอ</button>
    {isOpen ? <Dialog ariaDescribedBy="admin-create-description" ariaLabelledBy="admin-create-title" className="modal-md" onClose={closeDialog}>
      <header className="modal-header"><div><h2 id="admin-create-title">เพิ่มแอดมินประจำหอ</h2><p id="admin-create-description">สร้างบัญชีผู้ดูแลและกำหนดหอพักที่รับผิดชอบ</p></div><IconButton disabled={pending} label="ปิด" onClick={closeDialog} tooltip="ปิดหน้าต่างเพิ่มแอดมิน"><X /></IconButton></header>
      <form className="modal-form" onSubmit={submit}>
        <div className="modal-grid">
          <label>ชื่อ <input maxLength={120} minLength={2} name="displayName" required /></label>
          <label>อีเมล <input maxLength={254} name="email" required type="email" /></label>
        </div>
        <label>รหัสผ่านชั่วคราว <input autoComplete="new-password" maxLength={128} minLength={12} name="password" required type="password" /></label>
        <label>ค้นหาหอพัก <input onChange={(event) => properties.setQuery(event.target.value)} placeholder="ชื่อหรือชื่อย่อ" value={properties.query} /></label>
        <PropertyPicker
          onToggle={togglePropertySelection}
          properties={properties}
          selectedPropertyIds={selectedPropertyIds}
        />
        {message ? <p className="form-alert error" role="alert">{message}</p> : null}
        {!pending && hasNoProperties ? <p className="disabled-reason" id="admin-account-disabled-reason">ต้องมีหอพักอย่างน้อย 1 แห่งก่อนสร้างบัญชีแอดมิน</p> : null}
        <footer className="modal-actions">
          <button disabled={pending} onClick={closeDialog} type="button">ยกเลิก</button>
          <button aria-describedby={!pending && hasNoProperties ? "admin-account-disabled-reason" : undefined} className="primary-button" disabled={pending || hasNoProperties} type="submit"><UserPlus size={18} /> {pending ? "กำลังสร้าง..." : "สร้างบัญชี"}</button>
        </footer>
      </form>
    </Dialog> : null}
  </>;
}
