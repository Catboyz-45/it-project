"use client";
// เก็บค่าที่กรอกในฟอร์มและตามการเลื่อนหน้าจากเบราว์เซอร์

import { SyntheticEvent, useCallback, useMemo, useState } from "react";
import { X } from "lucide-react";
import { DatePickerField, formatDisplayDate } from "@/components/dorm/DatePickerField";
import { DropdownField } from "@/components/dorm/DropdownField";
import { OccupancyTransitionModal, type MoveRoomLeaseDraft } from "@/components/dorm/OccupancyTransitionModal";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { currency } from "@/lib/dorm-utils";
import { isValidIdentityDocumentNumber } from "@/lib/domain/identity-document";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { IconButton } from "@/components/ui/IconButton";
import { Dialog } from "@/components/ui/Dialog";
import type { Tenant } from "@/types/dorm";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { useTablistKeyboard } from "@/components/ui/use-tablist-keyboard";

// สี่หมวดข้อมูลของผู้เช่า แต่ละหมวดเป็นแท็บของตัวเอง
type TenantTab = "personal" | "contact" | "contract" | "vehicle";

// วันเกิดเลือกได้ตั้งแต่ปี ค.ศ. 1900 จนถึงวันนี้ ตรงกับที่เซิร์ฟเวอร์ยอมรับ
const earliestBirthDate = new Date(1900, 0, 1);

// ชื่อแท็บสั้น ๆ ให้แถบพอดีแผ่นบนมือถือ
const tenantTabs: Array<{ key: TenantTab; label: string }> = [
  { key: "personal", label: "ส่วนตัว" },
  { key: "contact", label: "ติดต่อ" },
  { key: "contract", label: "สัญญา" },
  { key: "vehicle", label: "รถ" },
];
const tenantTabKeys = tenantTabs.map(({ key }) => key);
const tenantTabId = (tab: TenantTab) => `tenant-tab-${tab}`;
const tenantPanelId = "tenant-tab-panel";

// กล่องดูและแก้ไขข้อมูลผู้เช่าแบบเต็ม พร้อมปุ่มย้ายออกหรือย้ายห้อง
export function TenantDetailModal({
  onClose,
  onSave,
  onTransitionCompleted,
  propertyId,
  readOnly = false,
  rooms,
  tenant,
}: Readonly<{
  onClose: () => void;
  onSave: (tenant: Tenant) => void;
  onTransitionCompleted: (leaseDraft?: MoveRoomLeaseDraft) => Promise<void>;
  propertyId: string;
  readOnly?: boolean;
  rooms: import("@/types/dorm").Room[];
  tenant: Tenant;
}>) {
  // แก้บนสำเนา ไม่แตะของเดิม ผู้ใช้จะได้กดยกเลิกแล้วข้อมูลจริงไม่เปลี่ยน
  const [draft, setDraft] = useState<Tenant>(tenant);
  const [error, setError] = useState("");
  const [isTransitionOpen, setIsTransitionOpen] = useState(false);
  // เก็บภาพค่าเริ่มต้นไว้เทียบ จะได้รู้ว่าผู้ใช้แก้อะไรไปแล้วหรือยัง
  const initialSnapshot = useMemo(() => JSON.stringify(tenant), [tenant]);
  // เทียบทั้งก้อนได้เลย เพราะ draft เริ่มจากการคัดลอก tenant มาทั้งอัน คีย์จึงเรียงเหมือนกัน
  const isDirty = !readOnly && JSON.stringify(draft) !== initialSnapshot;
  const { confirm, confirmationDialog } = useConfirmation();
  // ยังไม่ได้แก้อะไรก็ปิดไปเลย แก้แล้วต้องถามก่อน ไม่งั้นกดพลาดแล้วที่กรอกไว้หายหมด
  const requestClose = useCallback(() => {
    if (!isDirty) return onClose();
    return void confirm({ title: "ทิ้งข้อมูลที่แก้ไข?", description: "ข้อมูลผู้เช่าที่ยังไม่บันทึกจะหายไป", confirmLabel: "ทิ้งข้อมูล" })
      .then((ok) => { if (ok) onClose(); });
  }, [confirm, isDirty, onClose]);
  // เตือนอีกชั้นตอนผู้ใช้กดปิดแท็บหรือกดย้อนกลับของเบราว์เซอร์
  useUnsavedChanges(isDirty);

  const [activeTab, setActiveTab] = useState<TenantTab>("personal");
  const handleTabKeyDown = useTablistKeyboard(tenantTabKeys, setActiveTab);
  const hasVehicle = Boolean(draft.vehicleType) && draft.vehicleType !== "ไม่มีรถ";
  // ช่องที่กรอกผิดอาจอยู่คนละแท็บกับที่เปิดอยู่ สลับไปแท็บนั้นให้เห็นเอง
  const showTab = (tab: TenantTab) => setActiveTab(tab);

  // ตัวช่วยแก้ทีละฟิลด์ ใช้ generic เพื่อให้ค่าที่ส่งเข้ามาต้องตรงชนิดกับฟิลด์นั้น
  const update = <Key extends keyof Tenant>(key: Key, value: Tenant[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    // ล้างข้อความผิดพลาดทันทีที่เริ่มแก้ ผู้ใช้จะได้ไม่เห็นคำเตือนของสิ่งที่แก้ไปแล้ว
    setError("");
  };

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ
    event.preventDefault();
    // กันไว้อีกชั้น เผื่อมีทางกดส่งที่เล็ดลอดจาก fieldset ที่ปิดไว้
    if (readOnly) return;
    // เลื่อนไปหมวดที่มีปัญหาด้วย ไม่ใช่แค่ขึ้นข้อความ เพราะช่องที่ผิดอาจอยู่นอกจอ
    if (!draft.name.trim() || !draft.phone.trim()) {
      showTab("personal");
      setError("กรุณากรอกชื่อและเบอร์โทรของผู้เช่า");
      return;
    }
    // ตรวจรูปแบบก่อนส่ง ผู้ใช้จะได้รู้ทันทีว่าพิมพ์ผิด ส่วนเซิร์ฟเวอร์ตรวจซ้ำอีกรอบ
    if (draft.nationalId?.trim() && !isValidIdentityDocumentNumber(draft.nationalId)) {
      showTab("personal");
      setError("เลขบัตรประชาชนหรือหนังสือเดินทางไม่ถูกต้อง");
      return;
    }
    // เลือกว่ามีรถแล้วต้องมีทะเบียน ไม่งั้นข้อมูลที่บันทึกไว้ใช้ทำอะไรต่อไม่ได้
    if (draft.vehicleType !== "ไม่มีรถ" && !draft.vehiclePlate.trim()) {
      showTab("vehicle");
      setError("กรุณากรอกเลขทะเบียนรถ หรือเลือกไม่มีรถ");
      return;
    }

    // ตัดช่องว่างหัวท้ายก่อนบันทึก จะได้ไม่มีชื่อที่ดูเหมือนกันแต่ค้นหาไม่เจอ
    onSave({
      ...draft,
      address: draft.address.trim(),
      guardianName: draft.guardianName.trim(),
      guardianPhone: draft.guardianPhone.trim(),
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      vehicleDetail: draft.vehicleDetail.trim(),
      vehiclePlate: draft.vehiclePlate.trim(),
    });
  };

  return (
    <><Dialog ariaDescribedBy="tenant-detail-description" ariaLabelledBy="tenant-detail-title" className="tenant-config-modal" onClose={requestClose}>
        <header className="modal-header">
          <div>
            <h2 id="tenant-detail-title">ห้อง {tenant.roomId} · {tenant.name}</h2>
            <p id="tenant-detail-description">{tenant.role === "CO_OCCUPANT" ? "ผู้พักร่วม" : "ผู้เช่าหลัก"}{tenant.startDate ? ` · เข้าพักตั้งแต่ ${formatDisplayDate(tenant.startDate)}` : ""}</p>
          </div>
          {/* บอกกล่องว่าเปิดมาให้โฟกัสปุ่มนี้ก่อน ดีกว่าไปโฟกัสช่องกรอกช่องแรก */}
          <IconButton data-dialog-initial-focus label="ปิดหน้าต่าง" onClick={requestClose}>
            <X aria-hidden="true" size={20} />
          </IconButton>
        </header>

        <form className="tenant-config-form" onSubmit={submit}>
          {readOnly ? <ReadOnlyNotice className="mt-4">ตรวจสอบข้อมูลผู้เช่าได้ แต่ไม่สามารถแก้ไข บันทึก หรือเปลี่ยนการเข้าพักได้</ReadOnlyNotice> : null}
          {/* แบ่งเป็นแท็บ เดิมเรียง 28 ช่องลงมาคอลัมน์เดียวยาวหกเท่าของจอ ต้องเลื่อนผ่านทุกช่องกว่าจะถึงเรื่องที่จะแก้
              ปุ่มบันทึกยังบันทึกทุกแท็บพร้อมกัน เพราะค่าทั้งหมดอยู่ใน draft ก้อนเดียว */}
          <div aria-label="หมวดข้อมูลผู้เช่า" className="figma-inline-tabs tenant-config-tabs" onKeyDown={handleTabKeyDown} role="tablist">
            {tenantTabs.map((tab) => <button aria-controls={tenantPanelId} aria-selected={activeTab === tab.key} className={activeTab === tab.key ? "active" : ""} id={tenantTabId(tab.key)} key={tab.key} onClick={() => setActiveTab(tab.key)} role="tab" tabIndex={activeTab === tab.key ? 0 : -1} type="button">{tab.label}</button>)}
          </div>
          <div className="room-editor-layout tenant-config-layout">

          {/* fieldset disabled ปิดทุกช่องข้างในทีเดียว ดีกว่าไปใส่ disabled ทีละช่อง */}
          <fieldset aria-labelledby={tenantTabId(activeTab)} className="tenant-config-scroll room-editor-content min-w-0 border-0" disabled={readOnly} id={tenantPanelId} role="tabpanel">
            {error ? <p className="tenant-config-error" role="alert">{error}</p> : null}

            {activeTab === "personal" ? <div className="tenant-config-grid">
              <DropdownField
                label="คำนำหน้า"
                onChange={(value) => update("prefix", value)}
                options={[{ value: "", label: "ไม่ระบุ" }, { value: "นาย", label: "นาย" }, { value: "นางสาว", label: "นางสาว" }, { value: "นาง", label: "นาง" }, { value: "อื่น ๆ", label: "อื่น ๆ" }]}
                value={draft.prefix ?? ""}
              />
              <TextField label="ชื่อเล่น" value={draft.nickname ?? ""} onChange={(value) => update("nickname", value)} />
              <TextField className="full-width" label="ชื่อ-นามสกุล" required value={draft.name} onChange={(value) => update("name", value)} />
              <TextField label="เบอร์โทร" inputMode="tel" required value={draft.phone} onChange={(value) => update("phone", value)} />
              <TextField label="LINE ID" value={draft.lineId ?? ""} onChange={(value) => update("lineId", value)} />
              <TextField label="เลขบัตรประชาชน/หนังสือเดินทาง" maxLength={24} value={draft.nationalId ?? ""} onChange={(value) => update("nationalId", value)} />
              <DatePickerField initialView="year" label="วันเกิด (ไม่บังคับ)" maxDate={new Date()} minDate={earliestBirthDate} value={draft.birthDate ?? ""} onChange={(value) => update("birthDate", value)} />
              <TextField label="สัญชาติ" placeholder="เช่น ไทย" value={draft.nationality ?? ""} onChange={(value) => update("nationality", value)} />
              {/* อีเมลคือชื่อที่ผู้เช่าใช้เข้าสู่ระบบ เจ้าของหอเปลี่ยนแทนไม่ได้ จึงแสดงอย่างเดียว */}
              <ReadOnlyField label="อีเมลที่ใช้เข้าสู่ระบบ">{draft.email || "-"}</ReadOnlyField>
              <p className="tenant-config-helper full-width">เก็บเลขประจำตัวเฉพาะเมื่อจำเป็นต่อสัญญา และจำกัดสิทธิ์การเข้าถึงข้อมูลส่วนบุคคล</p>
            </div> : null}

            {activeTab === "contact" ? <div className="tenant-config-grid">
              <TextAreaField className="full-width" label="ที่อยู่ (ไม่บังคับ)" value={draft.address} onChange={(value) => update("address", value)} />
              <TextField label="อาชีพ/สถานะ (ไม่บังคับ)" value={draft.occupation ?? ""} onChange={(value) => update("occupation", value)} placeholder="เช่น นักศึกษา พนักงานบริษัท" />
              <TextField label="สถานศึกษา/สถานที่ทำงาน (ไม่บังคับ)" value={draft.organization ?? ""} onChange={(value) => update("organization", value)} />
              <TextField className="full-width" label="รหัสนักศึกษา/รหัสพนักงาน (ไม่บังคับ)" value={draft.studentOrEmployeeId ?? ""} onChange={(value) => update("studentOrEmployeeId", value)} />
              <h3 className="tenant-config-subheading full-width">ผู้ติดต่อฉุกเฉิน</h3>
              <TextField label="ชื่อผู้ติดต่อฉุกเฉิน (ไม่บังคับ)" value={draft.guardianName} onChange={(value) => update("guardianName", value)} />
              <DropdownField
                label="ความสัมพันธ์"
                onChange={(value) => update("guardianRelation", value)}
                options={[{ value: "", label: "ไม่ระบุ" }, ...["บิดา", "มารดา", "ผู้ปกครอง", "คู่สมรส", "ญาติ", "เพื่อน", "อื่น ๆ"].map((value) => ({ value, label: value }))]}
                value={draft.guardianRelation ?? ""}
              />
              <TextField label="เบอร์ผู้ติดต่อฉุกเฉิน (ไม่บังคับ)" inputMode="tel" value={draft.guardianPhone} onChange={(value) => update("guardianPhone", value)} />
            </div> : null}

            {activeTab === "contract" ? <div className="grid gap-5">
              {/* สัญญามีประวัติฉบับแก้ไขของตัวเอง จึงแสดงเป็นรายการสรุป แก้ได้ที่หน้าสัญญาเช่า */}
              <dl className="tenant-contract-summary">
                <div><dt>ห้องพัก</dt><dd>ห้อง {draft.roomId}</dd></div>
                <div><dt>ช่วงสัญญา</dt><dd>{draft.startDate ? formatDisplayDate(draft.startDate) : "-"} – {draft.contractEnd ? formatDisplayDate(draft.contractEnd) : "ยังไม่ระบุ"}</dd></div>
                <div><dt>เงินประกัน</dt><dd>{currency.format(draft.deposit)}</dd></div>
                <div><dt>ผู้พัก</dt><dd>{draft.occupantCount ?? 1} คน</dd></div>
              </dl>
              <div>
                <span className="mb-2 block text-sm font-medium text-[#292a30]">ผู้พักร่วมในระบบ</span>
                {draft.coOccupants?.length ? (
                  <ul className="grid gap-2">
                    {draft.coOccupants.map((occupant) => (
                      <li className="rounded-lg border border-[#e4e4e7] px-3 py-2 text-sm" key={occupant.id}>
                        <span className="font-medium">{occupant.name}</span>
                        <small className="ml-2 text-[#62646c]">{occupant.role === "PRIMARY" ? "ผู้เช่าหลัก" : "ผู้พักร่วม"}</small>
                      </li>
                    ))}
                  </ul>
                ) : <p className="tenant-config-helper">ยังไม่มีผู้พักร่วมที่ได้รับอนุมัติ ใช้หน้าคำเชิญผู้เช่าเพื่อเพิ่มผู้พักร่วม</p>}
              </div>
              <p className="tenant-config-helper">แก้ไขวันสัญญาและเงินประกันได้ที่หน้าสัญญาเช่า</p>
              <TextAreaField label="หมายเหตุสำหรับเจ้าของหอ" placeholder="บันทึกเฉพาะข้อมูลที่จำเป็นต่อการดูแลการเข้าพัก" value={draft.note ?? ""} onChange={(value) => update("note", value)} />
            </div> : null}

            {activeTab === "vehicle" ? <div className="tenant-config-grid">
              <DropdownField
                label="ประเภทรถ"
                onChange={(value) => update("vehicleType", value)}
                options={["ไม่มีรถ", "รถจักรยานยนต์", "รถยนต์", "รถจักรยาน", "อื่น ๆ"].map((value) => ({ value, label: value }))}
                value={draft.vehicleType || "ไม่มีรถ"}
              />
              {/* ไม่มีรถก็ไม่ต้องเห็นช่องรถที่ปิดไว้ทั้งชุด เลือกประเภทรถแล้วช่องค่อยขึ้นมา */}
              {hasVehicle ? <>
                <TextField label="เลขทะเบียนรถ" value={draft.vehiclePlate} onChange={(value) => update("vehiclePlate", value)} />
                <TextField label="จังหวัดทะเบียน" value={draft.vehicleProvince ?? ""} onChange={(value) => update("vehicleProvince", value)} />
                <TextField label="ยี่ห้อ/รุ่น" value={draft.vehicleBrand ?? ""} onChange={(value) => update("vehicleBrand", value)} />
                <TextField label="สีรถ" value={draft.vehicleColor ?? ""} onChange={(value) => update("vehicleColor", value)} />
                <TextAreaField className="full-width" label="รายละเอียดรถเพิ่มเติม" value={draft.vehicleDetail} onChange={(value) => update("vehicleDetail", value)} />
              </> : <p className="tenant-config-helper full-width">เลือกประเภทรถแล้วค่อยกรอกทะเบียน จังหวัด ยี่ห้อ และสี กรอกเฉพาะผู้เช่าที่ใช้ที่จอดรถ</p>}
            </div> : null}
          </fieldset>
          </div>

          <footer className="modal-actions tenant-config-actions">
            {!readOnly && tenant.role !== "CO_OCCUPANT" ? <button className="secondary-button mr-auto" onClick={() => setIsTransitionOpen(true)} type="button">ย้ายออก / ย้ายห้อง</button> : null}
            <button className="secondary-button" onClick={requestClose} type="button">{readOnly ? "ปิด" : "ยกเลิก"}</button>
            {!readOnly ? <button className="primary-button" type="submit">บันทึกข้อมูลผู้เช่า</button> : null}
          </footer>
        </form>
      
      {isTransitionOpen ? <OccupancyTransitionModal onClose={() => setIsTransitionOpen(false)} onCompleted={onTransitionCompleted} propertyId={propertyId} rooms={rooms} tenant={tenant} /> : null}
    </Dialog>{confirmationDialog}</>
  );
}

// ช่องกรอกข้อความ ห่อ label กับ input ไว้ด้วยกัน กดที่ป้ายแล้วโฟกัสเข้าช่องได้เลย
function TextField({ className = "", disabled = false, inputMode, label, maxLength, onChange, placeholder, required = false, value }: Readonly<{
  className?: string; disabled?: boolean; inputMode?: "email" | "tel" | "text"; label: string; maxLength?: number; onChange: (value: string) => void; placeholder?: string; required?: boolean; value: string;
}>) {
  return <label className={className}><span>{label}</span><input disabled={disabled} inputMode={inputMode} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} value={value} /></label>;
}

// ช่องกรอกข้อความหลายบรรทัด ใช้กับที่อยู่และหมายเหตุ
function TextAreaField({ className = "", disabled = false, label, onChange, placeholder, value }: Readonly<{ className?: string; disabled?: boolean; label: string; onChange: (value: string) => void; placeholder?: string; value: string }>) {
  return <label className={className}><span>{label}</span><textarea disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} /></label>;
}
