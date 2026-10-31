"use client";
// เก็บค่าที่กรอกในฟอร์มและตามการเลื่อนหน้าจากเบราว์เซอร์

import { SyntheticEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { DropdownField } from "@/components/dorm/DropdownField";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { formatDisplayDate } from "@/components/dorm/DatePickerField";
import { currency } from "@/lib/dorm-utils";
import { isValidIdentityDocumentNumber } from "@/lib/domain/identity-document";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { IconButton } from "@/components/ui/IconButton";
import { Dialog } from "@/components/ui/Dialog";
import type { Room, RoomStatus, Tenant } from "@/types/dorm";
import { UnitInput } from "@/components/ui/UnitInput";

// ห้องที่ไม่มีคนอยู่สลับได้แค่ว่างกับซ่อมบำรุง ส่วน "มีผู้เช่า" เกิดจากการอนุมัติเข้าพักเท่านั้น
// และห้องที่มีคนอยู่จะว่างได้ก็ต่อเมื่อย้ายออก เซิร์ฟเวอร์ปฏิเสธการเปลี่ยนแบบอื่นอยู่แล้ว
const roomStatusOptions: Array<{ value: RoomStatus; label: string }> = [
  { value: "available", label: "ว่าง" },
  { value: "maintenance", label: "ซ่อมบำรุง" },
];

// as const ทำให้ TypeScript รู้ว่ามีแค่สี่ค่านี้ ไม่ใช่ string อะไรก็ได้
// เรียงตามลำดับที่ปรากฏบนหน้าจอ เพราะใช้หาว่าตอนนี้เลื่อนมาถึงหัวข้อไหนแล้ว

// ช่วงสัญญาแบบอ่านอย่างเดียว ยังไม่มีวันสิ้นสุดก็บอกตรง ๆ แทนการเว้นว่าง
function describeLeasePeriod(tenant: Tenant | undefined) {
  if (!tenant?.startDate) return "ยังไม่มีสัญญา";
  return `${formatDisplayDate(tenant.startDate)} – ${tenant.contractEnd ? formatDisplayDate(tenant.contractEnd) : "ยังไม่ระบุ"}`;
}

// removeTenant แยกออกมาต่างหาก เพราะ tenant เป็น undefined บอกไม่ได้ว่าตั้งใจลบหรือไม่มีตั้งแต่แรก
export interface RoomEditPayload {
  removeTenant: boolean;
  room: Room;
  tenant?: Tenant;
}

// กล่องแก้ไขห้อง รวมข้อมูลห้อง ค่าเช่า มิเตอร์ เฟอร์นิเจอร์ และผู้เช่าไว้ในที่เดียว
export function RoomEditModal({
  room,
  tenant,
  floorOptions,
  furnitureOptions,
  onClose,
  onSave,
  readOnly = false,
}: Readonly<{
  room: Room;
  tenant?: Tenant;
  floorOptions: Array<{ id: string; number: number }>;
  furnitureOptions: string[];
  onClose: () => void;
  onSave: (payload: RoomEditPayload) => void;
  readOnly?: boolean;
}>) {
  const [status, setStatus] = useState<RoomStatus>(room.status);
  const [rent, setRent] = useState(String(room.rent));
  const [floorId, setFloorId] = useState(room.floorId ?? "");
  const [roomType, setRoomType] = useState<Room["roomType"]>(room.roomType);
  const [furniture, setFurniture] = useState<string[]>(room.furniture);
  const [name, setName] = useState(tenant?.name ?? "");
  const [phone, setPhone] = useState(tenant?.phone ?? "");
  const [nationalId, setNationalId] = useState(tenant?.nationalId ?? "");
  // ฐานข้อมูลเก็บ "-" แทนค่าว่าง แต่ในช่องกรอกต้องเป็นว่างจริง ๆ ไม่งั้นผู้ใช้ต้องมาลบขีดเอง
  const [address, setAddress] = useState(tenant?.address === "-" ? "" : tenant?.address ?? "");
  const [guardianName, setGuardianName] = useState(tenant?.guardianName === "-" ? "" : tenant?.guardianName ?? "");
  const [guardianPhone, setGuardianPhone] = useState(tenant?.guardianPhone === "-" ? "" : tenant?.guardianPhone ?? "");
  const [formError, setFormError] = useState("");
  // ห้องที่มีผู้เช่าล็อกสถานะไว้ จะเปลี่ยนได้ต้องผ่านการย้ายออกหรือย้ายห้องเท่านั้น
  const isOccupied = room.status === "occupied";
  const hasTenant = isOccupied && Boolean(tenant);
  // เก็บภาพค่าเริ่มต้นไว้เทียบ จะได้รู้ว่าผู้ใช้แก้อะไรไปแล้วหรือยัง
  const initialSnapshot = useMemo(() => JSON.stringify({
    address: tenant?.address === "-" ? "" : tenant?.address ?? "",
    floorId: room.floorId ?? "", furniture: room.furniture, guardianName: tenant?.guardianName === "-" ? "" : tenant?.guardianName ?? "",
    guardianPhone: tenant?.guardianPhone === "-" ? "" : tenant?.guardianPhone ?? "", name: tenant?.name ?? "",
    nationalId: tenant?.nationalId ?? "", phone: tenant?.phone ?? "", rent: String(room.rent), roomType: room.roomType,
    status: room.status,
  }), [room, tenant]);
  // คีย์ต้องเรียงเหมือนกับของเดิมเป๊ะ ๆ เพราะเทียบเป็นสตริง ไม่ได้เทียบทีละฟิลด์
  const currentSnapshot = JSON.stringify({ address, floorId, furniture, guardianName, guardianPhone, name, nationalId, phone, rent, roomType, status });
  // โหมดอ่านอย่างเดียวแก้อะไรไม่ได้อยู่แล้ว จึงไม่ต้องถามตอนปิด
  const isDirty = !readOnly && currentSnapshot !== initialSnapshot;
  const { confirm, confirmationDialog } = useConfirmation();
  // ยังไม่ได้แก้อะไรก็ปิดไปเลย แก้แล้วต้องถามก่อน ไม่งั้นกดพลาดแล้วที่กรอกไว้หายหมด
  const requestClose = useCallback(() => {
    if (!isDirty) return onClose();
    return void confirm({ title: "ทิ้งข้อมูลที่แก้ไข?", description: "ข้อมูลห้องที่ยังไม่บันทึกจะหายไป", confirmLabel: "ทิ้งข้อมูล" })
      .then((ok) => { if (ok) onClose(); });
  }, [confirm, isDirty, onClose]);
  // เตือนอีกชั้นตอนผู้ใช้กดปิดแท็บหรือกดย้อนกลับของเบราว์เซอร์
  useUnsavedChanges(isDirty);

  // เปิดกล่องให้ห้องอื่น ต้องล้างค่าที่ค้างจากห้องก่อนหน้าทิ้งให้หมด
  useEffect(() => {
    setStatus(room.status);
    setRent(String(room.rent));
    setFloorId(room.floorId ?? "");
    setRoomType(room.roomType);
    setFurniture(room.furniture);
    setName(tenant?.name ?? "");
    setPhone(tenant?.phone ?? "");
    setNationalId(tenant?.nationalId ?? "");
    setAddress(tenant?.address === "-" ? "" : tenant?.address ?? "");
    setGuardianName(tenant?.guardianName === "-" ? "" : tenant?.guardianName ?? "");
    setGuardianPhone(tenant?.guardianPhone === "-" ? "" : tenant?.guardianPhone ?? "");
    setFormError("");
  }, [room, tenant]);

  // ติ๊กเพิ่ม ติ๊กซ้ำเอาออก เก็บเป็นรายการชื่อ ไม่ใช่ค่าจริงเท็จทีละชิ้น
  const toggleFurniture = (item: string) => {
    setFurniture((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]));
  };

  const submitForm = (event: SyntheticEvent<HTMLFormElement>) => {
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ
    event.preventDefault();
    // กันไว้อีกชั้น เผื่อมีทางกดส่งที่เล็ดลอดจาก fieldset ที่ปิดไว้
    if (readOnly) return;

    if (hasTenant && (!name.trim() || !phone.trim())) {
      setFormError("กรุณากรอกชื่อและเบอร์โทรของผู้เช่าให้ครบ");
      return;
    }
    // ตรวจรูปแบบก่อนส่ง ผู้ใช้จะได้รู้ทันทีว่าพิมพ์ผิด ส่วนเซิร์ฟเวอร์ตรวจซ้ำอีกรอบ
    if (hasTenant && nationalId.trim() && !isValidIdentityDocumentNumber(nationalId)) {
      setFormError("เลขบัตรประชาชนหรือหนังสือเดินทางไม่ถูกต้อง");
      return;
    }

    // ผู้เช่าใหม่ยังไม่มี id จริงจากฐานข้อมูล จึงตั้งชั่วคราวไว้ก่อน
    const tenantId = tenant?.id ?? `t-${room.id}`;
    const nextTenant: Tenant | undefined = hasTenant
      ? {
          // กระจายของเดิมมาก่อน แล้วทับด้วยค่าที่แก้ ฟิลด์ที่กล่องนี้ไม่ได้แตะจะได้ไม่หาย
          ...tenant,
          // แปลงค่าว่างกลับเป็น "-" ให้ตรงกับที่ฐานข้อมูลเก็บ
          address: address.trim() || "-",
          guardianName: guardianName.trim() || "-",
          guardianPhone: guardianPhone.trim() || "-",
          id: tenantId,
          name: name.trim(),
          nationalId: nationalId.trim(),
          phone: phone.trim(),
          roomId: room.id,
          // สัญญากับเงินประกันกล่องนี้ไม่ได้แก้ คงค่าเดิมไว้
          deposit: tenant?.deposit ?? 0,
          startDate: tenant?.startDate ?? "",
          vehicleDetail: tenant?.vehicleDetail ?? "",
          vehiclePlate: tenant?.vehiclePlate ?? "",
          vehicleType: tenant?.vehicleType ?? "ไม่มีรถ",
        }
      : undefined;

    onSave({
      removeTenant: !hasTenant,
      room: {
        ...room,
        floor: floorOptions.find((item) => item.id === floorId)?.number ?? room.floor,
        floorId,
        furniture,
        // || room.rent กันกรอกไม่เป็นตัวเลขแล้วค่าเช่ากลายเป็น 0
        rent: Number(rent) || room.rent,
        roomType,
        status,
        tenantId: hasTenant ? tenantId : undefined,
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
            {/* fieldset disabled ปิดทุกช่องข้างในทีเดียว ดีกว่าไปใส่ disabled ทีละช่อง */}
            <fieldset className="room-editor-content min-w-0 border-0 p-0" disabled={readOnly}>
          <section className="room-editor-section" id="room-section-general">
            <header><div><h3>ข้อมูลห้อง</h3><p>สถานะ ประเภท และตำแหน่งของห้อง</p></div></header>
            <div className="room-editor-section-body modal-grid">
              <div className="modal-field">
                {isOccupied ? (
                  <div className="modal-summary room-status-locked">
                    <span>สถานะห้อง</span>
                    <strong>มีผู้เช่า</strong>
                    <small>เปลี่ยนได้ผ่านการย้ายออกหรือย้ายห้องในรายละเอียดผู้เช่า</small>
                  </div>
                ) : <DropdownField label="สถานะห้อง" value={status} onChange={(value) => setStatus(value as RoomStatus)} options={roomStatusOptions} />}
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
              <label><span>ค่าเช่าต่อเดือน</span><UnitInput min={0} required type="number" unit="บาท/เดือน" value={rent} onChange={(event) => setRent(event.target.value)} /></label>
              <div className="modal-summary"><span>ค่าเช่าปัจจุบัน</span><strong>{currency.format(Number(rent) || 0)}</strong></div>
              {/* เลขมิเตอร์มาจากการจดประจำเดือน แก้ตรงนี้ไม่ได้ เพราะบิลที่ออกไปแล้วอ้างอิงเลขเหล่านี้ */}
              <div className="modal-summary"><span>มิเตอร์น้ำล่าสุด</span><strong>{room.waterMeter.toLocaleString("th-TH")} หน่วย</strong></div>
              <div className="modal-summary"><span>มิเตอร์ไฟล่าสุด</span><strong>{room.electricMeter.toLocaleString("th-TH")} หน่วย</strong></div>
              <p className="room-editor-hint">จดเลขมิเตอร์ประจำเดือนได้ที่หน้าค่าน้ำและค่าไฟ</p>
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
            <header><div><h3>ข้อมูลผู้เช่า</h3><p>{hasTenant ? "แก้ไขข้อมูลติดต่อและข้อมูลฉุกเฉิน" : "ผู้เช่าใหม่เข้าพักด้วยรหัสเชิญ แล้วเจ้าของหออนุมัติการเข้าพัก"}</p></div></header>
            {hasTenant ? (
              <div className="room-editor-section-body modal-grid">
                <label><span>ชื่อ-นามสกุล *</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label>
                <label><span>เบอร์โทร *</span><input inputMode="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
                {/* รับทั้งบัตรประชาชนและหนังสือเดินทาง จึงไม่ตัดตัวอักษรทิ้ง ขีดกับเว้นวรรคเซิร์ฟเวอร์ตัดให้เอง */}
                <label><span>เลขบัตรประชาชน/หนังสือเดินทาง</span><input autoComplete="off" maxLength={24} value={nationalId} onChange={(event) => setNationalId(event.target.value)} /></label>
                {/* สัญญามีประวัติฉบับแก้ไขของตัวเอง จึงแสดงอย่างเดียว แก้ได้ที่หน้าสัญญาเช่า */}
                <div className="modal-summary"><span>ช่วงสัญญา</span><strong>{describeLeasePeriod(tenant)}</strong></div>
                <div className="modal-summary"><span>เงินประกัน</span><strong>{currency.format(tenant?.deposit ?? 0)}</strong></div>
                <p className="room-editor-hint">แก้ไขช่วงสัญญาและเงินประกันได้ที่หน้าสัญญาเช่า</p>
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
