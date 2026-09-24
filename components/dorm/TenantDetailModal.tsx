"use client";
// เก็บค่าที่กรอกในฟอร์มและตามการเลื่อนหน้าจากเบราว์เซอร์

import { SyntheticEvent, useCallback, useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { DatePickerField } from "@/components/dorm/DatePickerField";
import { DropdownField } from "@/components/dorm/DropdownField";
import { OccupancyTransitionModal, type MoveRoomLeaseDraft } from "@/components/dorm/OccupancyTransitionModal";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { currency } from "@/lib/dorm-utils";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { IconButton } from "@/components/ui/IconButton";
import { Dialog } from "@/components/ui/Dialog";
import type { Tenant } from "@/types/dorm";

// สี่หมวดข้อมูลของผู้เช่า แสดงเรียงกันในหน้าเดียว ไม่ได้สลับแท็บจริง ๆ
type TenantTab = "personal" | "contact" | "contract" | "vehicle";

// รวมการตั้งชื่อ id ไว้ที่เดียว ทั้งตอนวางลงหน้าและตอนหาเพื่อเลื่อนไป
const tenantSectionId = (tab: TenantTab) => `tenant-section-${tab}`;

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
  const requestClose = useCallback(() => { if (!isDirty) return onClose(); void confirm({ title: "ทิ้งข้อมูลที่แก้ไข?", description: "ข้อมูลผู้เช่าที่ยังไม่บันทึกจะหายไป", confirmLabel: "ทิ้งข้อมูล" }).then((ok) => { if (ok) onClose(); }); }, [confirm, isDirty, onClose]);
  // เตือนอีกชั้นตอนผู้ใช้กดปิดแท็บหรือกดย้อนกลับของเบราว์เซอร์
  useUnsavedChanges(isDirty);

  // แผงเรียงทุกหมวดลงมาต่อกัน ช่องที่กรอกผิดจึงอาจอยู่นอกจอ ต้องเลื่อนไปให้เห็นเอง
  const scrollToSection = (tab: TenantTab) => {
    document.getElementById(tenantSectionId(tab))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
      scrollToSection("personal");
      setError("กรุณากรอกชื่อและเบอร์โทรของผู้เช่า");
      return;
    }
    // เทียบสตริงวันที่ได้ตรง ๆ เพราะรูปแบบ YYYY-MM-DD เรียงตามตัวอักษรแล้วตรงกับเรียงตามเวลา
    if (!draft.startDate || !draft.contractEnd || draft.contractEnd < draft.startDate) {
      scrollToSection("contract");
      setError("กรุณาตรวจสอบวันเริ่มและวันสิ้นสุดสัญญา");
      return;
    }
    // เลือกว่ามีรถแล้วต้องมีทะเบียน ไม่งั้นข้อมูลที่บันทึกไว้ใช้ทำอะไรต่อไม่ได้
    if (draft.vehicleType !== "ไม่มีรถ" && !draft.vehiclePlate.trim()) {
      scrollToSection("vehicle");
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
            <p className="eyebrow" id="tenant-detail-description">รายละเอียดผู้เช่า</p>
            <h2 id="tenant-detail-title">ห้อง {tenant.roomId} · {tenant.name}</h2>
          </div>
          {/* บอกกล่องว่าเปิดมาให้โฟกัสปุ่มนี้ก่อน ดีกว่าไปโฟกัสช่องกรอกช่องแรก */}
          <IconButton data-dialog-initial-focus label="ปิดหน้าต่าง" onClick={requestClose}>
            <X aria-hidden="true" size={20} />
          </IconButton>
        </header>

        <form className="tenant-config-form" onSubmit={submit}>
          {readOnly ? <ReadOnlyNotice className="mx-5 mt-5">ตรวจสอบข้อมูลผู้เช่าได้ แต่ไม่สามารถแก้ไข บันทึก หรือเปลี่ยนการเข้าพักได้</ReadOnlyNotice> : null}
          <div className="room-editor-layout tenant-config-layout">

          {/* fieldset disabled ปิดทุกช่องข้างในทีเดียว ดีกว่าไปใส่ disabled ทีละช่อง */}
          <fieldset className="tenant-config-scroll room-editor-content min-w-0 border-0 p-0" disabled={readOnly}>
            {error ? <p className="tenant-config-error" role="alert">{error}</p> : null}

              <ConfigSection id={tenantSectionId("personal")} title="ข้อมูลส่วนตัว" description="ข้อมูลที่ใช้ระบุตัวตนและติดต่อผู้เช่า">
                <div className="tenant-config-grid">
                  <Field label="คำนำหน้า">
                    <DropdownField
                      onChange={(value) => update("prefix", value)}
                      options={[{ value: "นาย", label: "นาย" }, { value: "นางสาว", label: "นางสาว" }, { value: "นาง", label: "นาง" }, { value: "อื่น ๆ", label: "อื่น ๆ" }]}
                      value={draft.prefix ?? "นาย"}
                    />
                  </Field>
                  <TextField label="ชื่อ-นามสกุล" required value={draft.name} onChange={(value) => update("name", value)} />
                  <TextField label="ชื่อเล่น" value={draft.nickname ?? ""} onChange={(value) => update("nickname", value)} />
                  <TextField label="สัญชาติ" value={draft.nationality ?? "ไทย"} onChange={(value) => update("nationality", value)} />
                  <TextField label="เลขบัตรประชาชน/หนังสือเดินทาง" maxLength={20} value={draft.nationalId ?? ""} onChange={(value) => update("nationalId", value)} />
                  <TextField label="วันเกิด (ไม่บังคับ)" placeholder="วว/ดด/ปปปป" value={draft.birthDate ?? ""} onChange={(value) => update("birthDate", value)} />
                  <TextField label="เบอร์โทร" inputMode="tel" required value={draft.phone} onChange={(value) => update("phone", value)} />
                  <TextField label="อีเมล" inputMode="email" value={draft.email ?? ""} onChange={(value) => update("email", value)} />
                  <TextField label="LINE ID" value={draft.lineId ?? ""} onChange={(value) => update("lineId", value)} />
                  <p className="tenant-config-helper full-width">เก็บเลขประจำตัวเฉพาะเมื่อจำเป็นต่อสัญญา และจำกัดสิทธิ์การเข้าถึงข้อมูลส่วนบุคคล</p>
                </div>
              </ConfigSection>

              <ConfigSection id={tenantSectionId("contact")} title="ที่อยู่และผู้ติดต่อ" description="ที่อยู่ อาชีพ และบุคคลที่ติดต่อได้ในกรณีฉุกเฉิน">
                <div className="tenant-config-grid">
                  <TextAreaField className="full-width" label="ที่อยู่ (ไม่บังคับ)" value={draft.address} onChange={(value) => update("address", value)} />
                  <TextField label="อาชีพ/สถานะ (ไม่บังคับ)" value={draft.occupation ?? ""} onChange={(value) => update("occupation", value)} placeholder="เช่น นักศึกษา พนักงานบริษัท" />
                  <TextField label="สถานศึกษา/สถานที่ทำงาน (ไม่บังคับ)" value={draft.organization ?? ""} onChange={(value) => update("organization", value)} />
                  <TextField label="รหัสนักศึกษา/รหัสพนักงาน (ไม่บังคับ)" value={draft.studentOrEmployeeId ?? ""} onChange={(value) => update("studentOrEmployeeId", value)} />
                  <TextField label="ชื่อผู้ติดต่อฉุกเฉิน (ไม่บังคับ)" value={draft.guardianName} onChange={(value) => update("guardianName", value)} />
                  <Field label="ความสัมพันธ์">
                    <DropdownField
                      onChange={(value) => update("guardianRelation", value)}
                      options={["บิดา", "มารดา", "ผู้ปกครอง", "คู่สมรส", "ญาติ", "เพื่อน", "อื่น ๆ"].map((value) => ({ value, label: value }))}
                      value={draft.guardianRelation ?? "ผู้ปกครอง"}
                    />
                  </Field>
                  <TextField label="เบอร์ผู้ติดต่อฉุกเฉิน (ไม่บังคับ)" inputMode="tel" value={draft.guardianPhone} onChange={(value) => update("guardianPhone", value)} />
                </div>
              </ConfigSection>

              <ConfigSection id={tenantSectionId("contract")} title="สัญญาและผู้พัก" description="ข้อมูลเข้าพัก เงินประกัน และผู้พักร่วมจากข้อมูลการเข้าพักจริง">
                <div className="tenant-config-grid">
                  <div className="tenant-config-summary"><span>ห้องพัก</span><strong>ห้อง {draft.roomId}</strong></div>
                  <div className="tenant-config-summary"><span>เงินประกันปัจจุบัน</span><strong>{currency.format(draft.deposit)}</strong></div>
                  <DatePickerField label="วันเริ่มสัญญา" value={draft.startDate} onChange={(value) => update("startDate", value)} />
                  <DatePickerField label="วันสิ้นสุดสัญญา" minDate={draft.startDate ? new Date(`${draft.startDate}T00:00:00`) : undefined} value={draft.contractEnd ?? ""} onChange={(value) => update("contractEnd", value)} />
                  <NumberField label="เงินประกัน" min={0} value={draft.deposit} onChange={(value) => update("deposit", value)} />
                  <div className="tenant-config-summary"><span>จำนวนผู้พักที่ใช้งาน</span><strong>{draft.occupantCount ?? 1} คน</strong></div>
                  <div className="full-width">
                    <span className="mb-2 block text-sm font-semibold">ผู้พักร่วมในระบบ</span>
                    {draft.coOccupants?.length ? (
                      <ul className="grid gap-2">
                        {draft.coOccupants.map((occupant) => (
                          <li className="rounded-xl border border-[#d9dae0] px-4 py-3" key={occupant.id}>
                            <strong>{occupant.name}</strong>
                            <small className="ml-2 text-[#62646c]">{occupant.role === "PRIMARY" ? "ผู้เช่าหลัก" : "ผู้พักร่วม"}</small>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="tenant-config-helper">ยังไม่มีผู้พักร่วมที่ได้รับอนุมัติ ใช้หน้าคำเชิญผู้เช่าเพื่อเพิ่มผู้พักร่วม</p>}
                  </div>
                  <TextAreaField className="full-width" label="หมายเหตุสำหรับเจ้าของหอ" placeholder="บันทึกเฉพาะข้อมูลที่จำเป็นต่อการดูแลการเข้าพัก" value={draft.note ?? ""} onChange={(value) => update("note", value)} />
                </div>
              </ConfigSection>

              <ConfigSection id={tenantSectionId("vehicle")} title="ข้อมูลรถ (ไม่บังคับ)" description="กรอกเฉพาะเมื่อผู้เช่าต้องใช้พื้นที่จอดรถ">
                <div className="tenant-config-grid">
                  <Field label="ประเภทรถ">
                    <DropdownField
                      onChange={(value) => update("vehicleType", value)}
                      options={["ไม่มีรถ", "รถจักรยานยนต์", "รถยนต์", "รถจักรยาน", "อื่น ๆ"].map((value) => ({ value, label: value }))}
                      value={draft.vehicleType || "ไม่มีรถ"}
                    />
                  </Field>
                  <TextField disabled={draft.vehicleType === "ไม่มีรถ"} label="เลขทะเบียนรถ" value={draft.vehiclePlate} onChange={(value) => update("vehiclePlate", value)} />
                  <TextField disabled={draft.vehicleType === "ไม่มีรถ"} label="จังหวัดทะเบียน" value={draft.vehicleProvince ?? ""} onChange={(value) => update("vehicleProvince", value)} />
                  <TextField disabled={draft.vehicleType === "ไม่มีรถ"} label="ยี่ห้อ/รุ่น" value={draft.vehicleBrand ?? ""} onChange={(value) => update("vehicleBrand", value)} />
                  <TextField disabled={draft.vehicleType === "ไม่มีรถ"} label="สีรถ" value={draft.vehicleColor ?? ""} onChange={(value) => update("vehicleColor", value)} />
                  <TextAreaField className="full-width" disabled={draft.vehicleType === "ไม่มีรถ"} label="รายละเอียดรถเพิ่มเติม" value={draft.vehicleDetail} onChange={(value) => update("vehicleDetail", value)} />
                </div>
              </ConfigSection>
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

// กรอบหนึ่งหมวดพร้อมหัวเรื่อง ใช้แค่ในไฟล์นี้ จึงไม่ต้อง export
function ConfigSection({ children, description, id, title }: Readonly<{ children: ReactNode; description: string; id: string; title: string }>) {
  return (
    <section className="tenant-config-section room-editor-section" id={id}>
      <header><div><h3>{title}</h3><p>{description}</p></div></header>
      <div className="tenant-config-section-body room-editor-section-body">{children}</div>
    </section>
  );
}

// ห่อป้ายกับตัวควบคุมที่ไม่ใช่ input ปกติ เช่น DropdownField ที่มี label ของตัวเองไม่ได้
function Field({ children, label }: Readonly<{ children: ReactNode; label: string }>) {
  return <div className="tenant-config-field"><span>{label}</span>{children}</div>;
}

// ช่องกรอกข้อความ ห่อ label กับ input ไว้ด้วยกัน กดที่ป้ายแล้วโฟกัสเข้าช่องได้เลย
function TextField({ className = "", disabled = false, inputMode, label, maxLength, onChange, placeholder, required = false, value }: Readonly<{
  className?: string; disabled?: boolean; inputMode?: "email" | "tel" | "text"; label: string; maxLength?: number; onChange: (value: string) => void; placeholder?: string; required?: boolean; value: string;
}>) {
  return <label className={className}><span>{label}</span><input disabled={disabled} inputMode={inputMode} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} value={value} /></label>;
}

// ช่องกรอกตัวเลข แปลงค่าว่างเป็น 0 เพราะผู้เรียกรับเฉพาะ number
function NumberField({ label, min, onChange, value }: Readonly<{ label: string; min: number; onChange: (value: number) => void; value: number | "" }>) {
  return <label><span>{label}</span><input min={min} onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))} type="number" value={value} /></label>;
}

// ช่องกรอกข้อความหลายบรรทัด ใช้กับที่อยู่และหมายเหตุ
function TextAreaField({ className = "", disabled = false, label, onChange, placeholder, value }: Readonly<{ className?: string; disabled?: boolean; label: string; onChange: (value: string) => void; placeholder?: string; value: string }>) {
  return <label className={className}><span>{label}</span><textarea disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} /></label>;
}
