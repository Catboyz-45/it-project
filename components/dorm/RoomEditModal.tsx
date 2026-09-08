"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Room Edit Modal” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { DatePickerField } from "@/components/dorm/DatePickerField";
import { DropdownField } from "@/components/dorm/DropdownField";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { currency } from "@/lib/dorm-utils";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { IconButton } from "@/components/ui/IconButton";
import { Dialog } from "@/components/ui/Dialog";
import type { Room, RoomStatus, Tenant } from "@/types/dorm";

const roomStatusOptions: Array<{ value: RoomStatus; label: string }> = [
  { value: "available", label: "ว่าง" },
  { value: "occupied", label: "มีผู้เช่า" },
  { value: "maintenance", label: "ซ่อมบำรุง" },
];

const roomSectionIds = ["room-section-general", "room-section-billing", "room-section-furniture", "room-section-tenant"] as const;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: interface “Room Edit Payload” ระบุว่าข้อมูลต้องมีฟิลด์อะไร เพื่อให้หลายส่วนส่งข้อมูลตรงรูปแบบกัน
 */
export interface RoomEditPayload {
  removeTenant: boolean;
  room: Room;
  tenant?: Tenant;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Room Edit Modal” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { room, tenant, floorOptions, furnitureOptions, onClose, onS: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function RoomEditModal({
  room,
  tenant,
  floorOptions,
  furnitureOptions,
  onClose,
  onSave,
  readOnly = false,
}: {
  room: Room;
  tenant?: Tenant;
  floorOptions: Array<{ id: string; number: number }>;
  furnitureOptions: string[];
  onClose: () => void;
  onSave: (payload: RoomEditPayload) => void;
  readOnly?: boolean;
}) {
  const [status, setStatus] = useState<RoomStatus>(room.status);
  const [rent, setRent] = useState(String(room.rent));
  const [floorId, setFloorId] = useState(room.floorId ?? "");
  const [roomType, setRoomType] = useState<Room["roomType"]>(room.roomType);
  const [waterMeter, setWaterMeter] = useState(String(room.waterMeter));
  const [electricMeter, setElectricMeter] = useState(String(room.electricMeter));
  const [furniture, setFurniture] = useState<string[]>(room.furniture);
  const [activeSection, setActiveSection] = useState<(typeof roomSectionIds)[number]>("room-section-general");
  const [name, setName] = useState(tenant?.name ?? "");
  const [phone, setPhone] = useState(tenant?.phone ?? "");
  const [nationalId, setNationalId] = useState(tenant?.nationalId ?? "");
  const [startDate, setStartDate] = useState(tenant?.startDate ?? "");
  const [contractEnd, setContractEnd] = useState(tenant?.contractEnd ?? "");
  const [deposit, setDeposit] = useState(String(tenant?.deposit ?? room.rent));
  const [address, setAddress] = useState(tenant?.address === "-" ? "" : tenant?.address ?? "");
  const [guardianName, setGuardianName] = useState(tenant?.guardianName === "-" ? "" : tenant?.guardianName ?? "");
  const [guardianPhone, setGuardianPhone] = useState(tenant?.guardianPhone === "-" ? "" : tenant?.guardianPhone ?? "");
  const [formError, setFormError] = useState("");
  const hasTenant = status === "occupied";
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “initial Snapshot” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const initialSnapshot = useMemo(() => JSON.stringify({
    address: tenant?.address === "-" ? "" : tenant?.address ?? "",
    contractEnd: tenant?.contractEnd ?? "",
    deposit: String(tenant?.deposit ?? room.rent), electricMeter: String(room.electricMeter),
    floorId: room.floorId ?? "", furniture: room.furniture, guardianName: tenant?.guardianName === "-" ? "" : tenant?.guardianName ?? "",
    guardianPhone: tenant?.guardianPhone === "-" ? "" : tenant?.guardianPhone ?? "", name: tenant?.name ?? "",
    nationalId: tenant?.nationalId ?? "", phone: tenant?.phone ?? "", rent: String(room.rent), roomType: room.roomType,
    startDate: tenant?.startDate ?? "", status: room.status, waterMeter: String(room.waterMeter),
  }), [room, tenant]);
  const currentSnapshot = JSON.stringify({ address, contractEnd, deposit, electricMeter, floorId, furniture, guardianName, guardianPhone, name, nationalId, phone, rent, roomType, startDate, status, waterMeter });
  const isDirty = !readOnly && currentSnapshot !== initialSnapshot;
  const { confirm, confirmationDialog } = useConfirmation();
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “request Close” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const requestClose = useCallback(() => { if (!isDirty) return onClose(); void confirm({ title: "ทิ้งข้อมูลที่แก้ไข?", description: "ข้อมูลห้องที่ยังไม่บันทึกจะหายไป", confirmLabel: "ทิ้งข้อมูล" }).then((ok) => { if (ok) onClose(); }); }, [confirm, isDirty, onClose]);
  useUnsavedChanges(isDirty);

  useEffect(() => {
    setStatus(room.status);
    setRent(String(room.rent));
    setFloorId(room.floorId ?? "");
    setRoomType(room.roomType);
    setWaterMeter(String(room.waterMeter));
    setElectricMeter(String(room.electricMeter));
    setFurniture(room.furniture);
    setName(tenant?.name ?? "");
    setPhone(tenant?.phone ?? "");
    setNationalId(tenant?.nationalId ?? "");
    setStartDate(tenant?.startDate ?? "");
    setContractEnd(tenant?.contractEnd ?? "");
    setDeposit(String(tenant?.deposit ?? room.rent));
    setAddress(tenant?.address === "-" ? "" : tenant?.address ?? "");
    setGuardianName(tenant?.guardianName === "-" ? "" : tenant?.guardianName ?? "");
    setGuardianPhone(tenant?.guardianPhone === "-" ? "" : tenant?.guardianPhone ?? "");
    setFormError("");
  }, [room, tenant]);

  useEffect(() => {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “sections” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - section: ค่า “section” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนข้อมูลชนิด section is HTMLElement ตามสัญญา TypeScript ของฟังก์ชัน
     */
    const sections = roomSectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    const contentContainer = sections[0]?.closest<HTMLElement>(".room-editor-content");
    const modalContainer = sections[0]?.closest<HTMLElement>(".room-edit-modal");
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
      const containerTop = scrollContainer.getBoundingClientRect().top;
      const activationOffset = scrollContainer === contentContainer ? 32 : 150;
      const activationLine = containerTop + activationOffset;
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
      setActiveSection(currentSection.id as (typeof roomSectionIds)[number]);
    };

    updateActiveSection();
    scrollContainer.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", updateActiveSection);
  }, []);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: แปลงข้อมูลในขั้นตอน “toggle Furniture” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
   * รับค่า:
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const toggleFurniture = (item: string) => {
    setFurniture((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]));
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “go To Section” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - sectionId: รหัสภายในของ section
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const goToSection = (sectionId: string) => {
    setActiveSection(sectionId as (typeof roomSectionIds)[number]);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “submit Form” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) return;

    if (hasTenant && (!name.trim() || !phone.trim() || !startDate || !contractEnd)) {
      setFormError("กรุณากรอกชื่อ เบอร์โทร และช่วงสัญญาของผู้เช่าให้ครบ");
      return;
    }
    if (hasTenant && contractEnd < startDate) {
      setFormError("วันสิ้นสุดสัญญาต้องอยู่หลังวันเริ่มสัญญา");
      return;
    }

    const tenantId = tenant?.id ?? `t-${room.id}`;
    const nextTenant: Tenant | undefined = hasTenant
      ? {
          ...tenant,
          address: address.trim() || "-",
          contractEnd,
          deposit: Number(deposit) || 0,
          guardianName: guardianName.trim() || "-",
          guardianPhone: guardianPhone.trim() || "-",
          id: tenantId,
          name: name.trim(),
          nationalId: nationalId.trim(),
          phone: phone.trim(),
          roomId: room.id,
          startDate,
          vehicleDetail: tenant?.vehicleDetail ?? "",
          vehiclePlate: tenant?.vehiclePlate ?? "",
          vehicleType: tenant?.vehicleType ?? "ไม่มีรถ",
        }
      : undefined;

    onSave({
      removeTenant: !hasTenant,
      room: {
        ...room,
        electricMeter: Number(electricMeter) || 0,
        floor: floorOptions.find((item) => item.id === floorId)?.number ?? room.floor,
        floorId,
        furniture,
        rent: Number(rent) || room.rent,
        roomType,
        status,
        tenantId: hasTenant ? tenantId : undefined,
        waterMeter: Number(waterMeter) || 0,
      },
      tenant: nextTenant,
    });
  };

  return (
    <><Dialog ariaDescribedBy="room-edit-description" ariaLabelledBy="room-edit-title" className="room-edit-modal" onClose={requestClose}>
        <header className="modal-header">
          <div>
            <p className="eyebrow" id="room-edit-description">จัดการข้อมูลห้อง</p>
            <h2 id="room-edit-title">ห้อง {room.id}</h2>
          </div>
          <IconButton label="ปิดหน้าต่าง" onClick={requestClose}>
            <X aria-hidden="true" size={20} />
          </IconButton>
        </header>

        <form className="modal-form room-editor-form" onSubmit={submitForm}>
          {readOnly ? <ReadOnlyNotice>ตรวจสอบข้อมูลห้อง ค่าเช่า มิเตอร์ เฟอร์นิเจอร์ และผู้เช่าได้ แต่ไม่สามารถแก้ไขหรือบันทึกได้</ReadOnlyNotice> : null}
          <div className="room-editor-layout">
            <aside aria-label="หัวข้อจัดการข้อมูลห้อง" className="room-editor-nav">
              <strong>จัดการข้อมูลห้อง</strong>
              <nav>
                <button aria-current={activeSection === "room-section-general" ? "location" : undefined} className={activeSection === "room-section-general" ? "active" : ""} onClick={() => goToSection("room-section-general")} type="button">ข้อมูลห้อง</button>
                <button aria-current={activeSection === "room-section-billing" ? "location" : undefined} className={activeSection === "room-section-billing" ? "active" : ""} onClick={() => goToSection("room-section-billing")} type="button">ค่าเช่าและมิเตอร์</button>
                <button aria-current={activeSection === "room-section-furniture" ? "location" : undefined} className={activeSection === "room-section-furniture" ? "active" : ""} onClick={() => goToSection("room-section-furniture")} type="button">เฟอร์นิเจอร์และอุปกรณ์</button>
                <button aria-current={activeSection === "room-section-tenant" ? "location" : undefined} className={activeSection === "room-section-tenant" ? "active" : ""} onClick={() => goToSection("room-section-tenant")} type="button">ข้อมูลผู้เช่า</button>
              </nav>
            </aside>
            <fieldset className="room-editor-content min-w-0 border-0 p-0" disabled={readOnly}>
          <section className="room-editor-section" id="room-section-general">
            <header><div><h3>ข้อมูลห้อง</h3><p>สถานะ ประเภท และตำแหน่งของห้อง</p></div></header>
            <div className="room-editor-section-body modal-grid">
              <div className="modal-field">
                <DropdownField label="สถานะห้อง" value={status} onChange={(value) => setStatus(value as RoomStatus)} options={roomStatusOptions} />
              </div>
              <div className="modal-field">
                <DropdownField
                  label="ประเภทห้อง"
                  value={roomType}
                  onChange={(value) => setRoomType(value as Room["roomType"])}
                  options={[{ value: "fan", label: "ห้องพัดลม" }, { value: "air", label: "ห้องแอร์" }]}
                />
              </div>
              <div className="modal-field">
                <DropdownField label="ชั้น" value={floorId} onChange={setFloorId} options={floorOptions.map((item) => ({ value: item.id, label: `ชั้น ${item.number}` }))} />
              </div>
            </div>
          </section>

          <section className="room-editor-section" id="room-section-billing">
            <header><div><h3>ค่าเช่าและมิเตอร์</h3><p>ข้อมูลที่ใช้คำนวณบิลประจำเดือน</p></div></header>
            <div className="room-editor-section-body modal-grid">
              <label><span>ค่าเช่าต่อเดือน</span><input min={0} required type="number" value={rent} onChange={(event) => setRent(event.target.value)} /></label>
              <label><span>เลขมิเตอร์น้ำล่าสุด</span><input min={0} required type="number" value={waterMeter} onChange={(event) => setWaterMeter(event.target.value)} /></label>
              <label><span>เลขมิเตอร์ไฟล่าสุด</span><input min={0} required type="number" value={electricMeter} onChange={(event) => setElectricMeter(event.target.value)} /></label>
              <div className="modal-summary"><span>ค่าเช่าปัจจุบัน</span><strong>{currency.format(Number(rent) || 0)}</strong></div>
            </div>
          </section>

          <section className="room-editor-section" id="room-section-furniture">
            <header><div><h3>เฟอร์นิเจอร์และอุปกรณ์</h3><p>ใช้ตรวจรับห้องและติดตามทรัพย์สินประจำห้อง</p></div></header>
            <div className="room-editor-section-body">
              <div className="furniture-grid">
                {furnitureOptions.map((item) => {
                  const isSelected = furniture.includes(item);
                  return (
                    <label className={`furniture-option${isSelected ? " selected" : ""}`} key={item}>
                      <input checked={isSelected} onChange={() => toggleFurniture(item)} type="checkbox" />
                      <span aria-hidden="true" className="furniture-checkbox">{isSelected ? <Check size={16} strokeWidth={3} /> : null}</span>
                      <span className="furniture-copy"><strong>{item}</strong><small>{isSelected ? "มีให้ภายในห้อง" : "ไม่มีภายในห้อง"}</small></span>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="room-editor-section tenant-editor-section" id="room-section-tenant">
            <header><div><h3>ข้อมูลผู้เช่า</h3><p>{hasTenant ? "แก้ไขข้อมูลติดต่อ สัญญา และข้อมูลฉุกเฉิน" : "เปลี่ยนสถานะห้องเป็นมีผู้เช่าเพื่อเพิ่มผู้เช่า"}</p></div></header>
            {hasTenant ? (
              <div className="room-editor-section-body modal-grid">
                <label><span>ชื่อ-นามสกุล *</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label>
                <label><span>เบอร์โทร *</span><input inputMode="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
                <label><span>เลขบัตรประชาชน</span><input inputMode="numeric" maxLength={13} value={nationalId} onChange={(event) => setNationalId(event.target.value.replace(/\D/g, ""))} /></label>
                <label><span>เงินประกัน</span><input min={0} type="number" value={deposit} onChange={(event) => setDeposit(event.target.value)} /></label>
                <DatePickerField label="วันเริ่มสัญญา *" value={startDate} onChange={setStartDate} />
                <DatePickerField label="วันสิ้นสุดสัญญา *" minDate={startDate ? new Date(`${startDate}T00:00:00`) : new Date()} value={contractEnd} onChange={setContractEnd} />
                <label className="full-width"><span>ที่อยู่ตามทะเบียนบ้าน</span><textarea value={address} onChange={(event) => setAddress(event.target.value)} /></label>
                <label><span>ชื่อผู้ติดต่อฉุกเฉิน/ผู้ปกครอง</span><input value={guardianName} onChange={(event) => setGuardianName(event.target.value)} /></label>
                <label><span>เบอร์ผู้ติดต่อฉุกเฉิน</span><input inputMode="tel" value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value)} /></label>
              </div>
            ) : <div className="room-editor-empty">ห้องนี้ไม่มีผู้เช่า ระบบจะไม่ผูกข้อมูลสัญญาหรือผู้เช่าไว้กับห้อง</div>}
          </section>
            </fieldset>
          </div>

          {formError ? <p className="room-editor-error" role="alert">{formError}</p> : null}
          <footer className="modal-actions room-editor-actions">
            <button className="secondary-button" onClick={requestClose} type="button">{readOnly ? "ปิด" : "ยกเลิก"}</button>
            {!readOnly ? <button className="primary-button" type="submit">บันทึกข้อมูล</button> : null}
          </footer>
        </form>
    </Dialog>{confirmationDialog}</>
  );
}
