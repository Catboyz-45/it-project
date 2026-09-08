"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Tenant Detail Modal” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Tenant Tab” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type TenantTab = "personal" | "contact" | "contract" | "vehicle";

const tabs: Array<{ id: TenantTab; label: string }> = [
  { id: "personal", label: "ข้อมูลส่วนตัว" },
  { id: "contact", label: "ที่อยู่และผู้ติดต่อ" },
  { id: "contract", label: "สัญญาและผู้พัก" },
  { id: "vehicle", label: "ข้อมูลรถ" },
];
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “tenant Section Id” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - tab: ค่า “tab” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const tenantSectionId = (tab: TenantTab) => `tenant-section-${tab}`;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Tenant Detail Modal” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { onClose, onSave, onTransitionCompleted, propertyId, readOn: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function TenantDetailModal({
  onClose,
  onSave,
  onTransitionCompleted,
  propertyId,
  readOnly = false,
  rooms,
  tenant,
}: {
  onClose: () => void;
  onSave: (tenant: Tenant) => void;
  onTransitionCompleted: (leaseDraft?: MoveRoomLeaseDraft) => Promise<void>;
  propertyId: string;
  readOnly?: boolean;
  rooms: import("@/types/dorm").Room[];
  tenant: Tenant;
}) {
  const [activeTab, setActiveTab] = useState<TenantTab>("personal");
  const [draft, setDraft] = useState<Tenant>(tenant);
  const [error, setError] = useState("");
  const [isTransitionOpen, setIsTransitionOpen] = useState(false);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “initial Snapshot” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const initialSnapshot = useMemo(() => JSON.stringify(tenant), [tenant]);
  const isDirty = !readOnly && JSON.stringify(draft) !== initialSnapshot;
  const { confirm, confirmationDialog } = useConfirmation();
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “request Close” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const requestClose = useCallback(() => { if (!isDirty) return onClose(); void confirm({ title: "ทิ้งข้อมูลที่แก้ไข?", description: "ข้อมูลผู้เช่าที่ยังไม่บันทึกจะหายไป", confirmLabel: "ทิ้งข้อมูล" }).then((ok) => { if (ok) onClose(); }); }, [confirm, isDirty, onClose]);
  useUnsavedChanges(isDirty);

  useEffect(() => {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “sections” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - section: ค่า “section” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนข้อมูลชนิด section is HTMLElement ตามสัญญา TypeScript ของฟังก์ชัน
     */
    const sections = tabs
      .map((tab) => document.getElementById(tenantSectionId(tab.id)))
      .filter((section): section is HTMLElement => Boolean(section));
    const contentContainer = sections[0]?.closest<HTMLElement>(".tenant-config-scroll");
    const modalContainer = sections[0]?.closest<HTMLElement>(".tenant-config-modal");
    const scrollContainer =
      contentContainer && window.getComputedStyle(contentContainer).overflowY !== "visible"
        ? contentContainer
        : modalContainer;
    if (!scrollContainer) return;

    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Active Section” โดยใช้ค่าที่รับเข้ามา
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const updateActiveSection = () => {
      const activationOffset = scrollContainer === contentContainer ? 32 : 150;
      const activationLine = scrollContainer.getBoundingClientRect().top + activationOffset;
      /**
       * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
       * หน้าที่: รวมขั้นตอนย่อยของ “current Section” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
       * รับค่า:
       * - current: ค่า “current” ที่จำเป็นต่อการทำงานของก้อนนี้
       * - section: ค่า “section” ที่จำเป็นต่อการทำงานของก้อนนี้
       * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
       */
      const currentSection = sections.reduce((current, section) => (
        section.getBoundingClientRect().top <= activationLine ? section : current
      ), sections[0]);
      setActiveTab(currentSection.id.replace("tenant-section-", "") as TenantTab);
    };

    updateActiveSection();
    scrollContainer.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", updateActiveSection);
  }, []);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “go To Tab” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - tab: ค่า “tab” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const goToTab = (tab: TenantTab) => {
    setActiveTab(tab);
    document.getElementById(tenantSectionId(tab))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - key: ค่า “key” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const update = <Key extends keyof Tenant>(key: Key, value: Tenant[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “submit” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) return;
    if (!draft.name.trim() || !draft.phone.trim()) {
      setActiveTab("personal");
      setError("กรุณากรอกชื่อและเบอร์โทรของผู้เช่า");
      return;
    }
    if (!draft.startDate || !draft.contractEnd || draft.contractEnd < draft.startDate) {
      setActiveTab("contract");
      setError("กรุณาตรวจสอบวันเริ่มและวันสิ้นสุดสัญญา");
      return;
    }
    if (draft.vehicleType !== "ไม่มีรถ" && !draft.vehiclePlate.trim()) {
      setActiveTab("vehicle");
      setError("กรุณากรอกเลขทะเบียนรถ หรือเลือกไม่มีรถ");
      return;
    }

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
          <IconButton data-dialog-initial-focus label="ปิดหน้าต่าง" onClick={requestClose}>
            <X aria-hidden="true" size={20} />
          </IconButton>
        </header>

        <form className="tenant-config-form" onSubmit={submit}>
          {readOnly ? <ReadOnlyNotice className="mx-5 mt-5">ตรวจสอบข้อมูลผู้เช่าได้ แต่ไม่สามารถแก้ไข บันทึก หรือเปลี่ยนการเข้าพักได้</ReadOnlyNotice> : null}
          <div className="room-editor-layout tenant-config-layout">
            <aside aria-label="หมวดข้อมูลผู้เช่า" className="room-editor-nav tenant-config-tabs">
              <strong>จัดการข้อมูลผู้เช่า</strong>
              <nav>
                {tabs.map((tab) => (
                  <button
                    aria-current={activeTab === tab.id ? "location" : undefined}
                    className={activeTab === tab.id ? "active" : ""}
                    key={tab.id}
                    onClick={() => goToTab(tab.id)}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </aside>

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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Config Section” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { children, description, id, title }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function ConfigSection({ children, description, id, title }: { children: ReactNode; description: string; id: string; title: string }) {
  return (
    <section className="tenant-config-section room-editor-section" id={id}>
      <header><div><h3>{title}</h3><p>{description}</p></div></header>
      <div className="tenant-config-section-body room-editor-section-body">{children}</div>
    </section>
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Field” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { children, label }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function Field({ children, label }: { children: ReactNode; label: string }) {
  return <div className="tenant-config-field"><span>{label}</span>{children}</div>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Text Field” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { className = "", disabled = false, inputMode, label, maxLen: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function TextField({ className = "", disabled = false, inputMode, label, maxLength, onChange, placeholder, required = false, value }: {
  className?: string; disabled?: boolean; inputMode?: "email" | "tel" | "text"; label: string; maxLength?: number; onChange: (value: string) => void; placeholder?: string; required?: boolean; value: string;
}) {
  return <label className={className}><span>{label}</span><input disabled={disabled} inputMode={inputMode} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} value={value} /></label>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Number Field” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { label, min, onChange, value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function NumberField({ label, min, onChange, value }: { label: string; min: number; onChange: (value: number) => void; value: number | "" }) {
  return <label><span>{label}</span><input min={min} onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))} type="number" value={value} /></label>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Text Area Field” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { className = "", disabled = false, label, onChange, placeho: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function TextAreaField({ className = "", disabled = false, label, onChange, placeholder, value }: { className?: string; disabled?: boolean; label: string; onChange: (value: string) => void; placeholder?: string; value: string }) {
  return <label className={className}><span>{label}</span><textarea disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} /></label>;
}
