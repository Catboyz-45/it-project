"use client";
// เก็บค่าที่กรอกในฟอร์มไว้ในสถานะฝั่งเบราว์เซอร์

import { SyntheticEvent, useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { DatePickerField } from "@/components/dorm/DatePickerField";
import { DropdownField } from "@/components/dorm/DropdownField";
import { currency } from "@/lib/dorm-utils";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { IconButton } from "@/components/ui/IconButton";
import { Dialog } from "@/components/ui/Dialog";
import type { Room, Tenant } from "@/types/dorm";

// ห่อไว้เป็น object เผื่อวันหลังต้องส่งอย่างอื่นกลับไปด้วย จะได้ไม่ต้องแก้ทุกที่ที่เรียก
export interface TenantEditPayload {
  tenant: Tenant;
}

// กล่องเพิ่มและแก้ไขผู้เช่า ใช้ตัวเดียวกันทั้งสองงาน ต่างกันที่ต้องเลือกห้องหรือไม่
export function TenantEditModal({
  // add = เลือกห้องว่างก่อน edit = แก้ข้อมูลของห้องที่มีคนอยู่แล้ว
  mode = "edit",
  room,
  rooms,
  tenant,
  onClose,
  onSave,
}: Readonly<{
  mode?: "add" | "edit";
  room: Room;
  rooms?: Room[];
  tenant?: Tenant;
  onClose: () => void;
  onSave: (payload: TenantEditPayload) => void;
}>) {
  // โหมดแก้ไขไม่ต้องส่งรายการห้องมา เพราะแก้อยู่ห้องเดียว
  const allRooms = useMemo(() => rooms ?? [room], [room, rooms]);
  // ย้ายคนเข้าได้เฉพาะห้องว่าง กันเผลอใส่ผู้เช่าซ้อนห้องที่มีคนอยู่แล้ว
  const availableRooms = useMemo(() => allRooms.filter((item) => item.status === "available"), [allRooms]);
  // เปิดมาที่ห้องที่กดเข้ามาก่อน ถ้าห้องนั้นไม่ว่างแล้วก็ถอยไปห้องว่างห้องแรก
  const initialRoom = mode === "add" ? availableRooms.find((item) => item.id === room.id) ?? availableRooms[0] ?? room : room;
  const [selectedRoomId, setSelectedRoomId] = useState(initialRoom.id);
  const [name, setName] = useState(tenant?.name ?? "");
  const [phone, setPhone] = useState(tenant?.phone ?? "");
  const [startDate, setStartDate] = useState(tenant?.startDate ?? "");
  const [contractEnd, setContractEnd] = useState(tenant?.contractEnd ?? "");
  const selectedTenantRoom = allRooms.find((item) => item.id === selectedRoomId) ?? initialRoom;
  const [deposit, setDeposit] = useState(tenant ? String(tenant.deposit) : "");
  // Set ตัดชั้นที่ซ้ำกันออก เหลือรายชื่อชั้นที่ยังมีห้องว่างจริง ๆ
  const floors = Array.from(new Set(availableRooms.map((item) => item.floor))).sort((a, b) => a - b);
  const selectedFloor = selectedTenantRoom.floor;
  // เลือกชั้นก่อนแล้วค่อยเลือกห้อง หอที่มีหลายสิบห้องจะได้ไม่ต้องไถหาในรายการเดียว
  const roomsOnSelectedFloor = availableRooms.filter((item) => item.floor === selectedFloor);
  // เก็บภาพค่าเริ่มต้นไว้เทียบ จะได้รู้ว่าผู้ใช้แก้อะไรไปแล้วหรือยัง
  const initialSnapshot = JSON.stringify({ contractEnd: tenant?.contractEnd ?? "", deposit: tenant ? String(tenant.deposit) : "", name: tenant?.name ?? "", phone: tenant?.phone ?? "", selectedRoomId: initialRoom.id, startDate: tenant?.startDate ?? "" });
  // เทียบเป็นสตริงทั้งก้อน ง่ายกว่าไล่เช็คทีละช่อง และคีย์เรียงเหมือนกันทั้งสองฝั่ง
  const isDirty = JSON.stringify({ contractEnd, deposit, name, phone, selectedRoomId, startDate }) !== initialSnapshot;
  const { confirm, confirmationDialog } = useConfirmation();
  // ยังไม่ได้แก้อะไรก็ปิดไปเลย แก้แล้วต้องถามก่อน ไม่งั้นกดพลาดแล้วที่กรอกไว้หายหมด
  const requestClose = useCallback(() => { if (!isDirty) return onClose(); void confirm({ title: "ทิ้งข้อมูลที่แก้ไข?", description: "ข้อมูลผู้เช่าที่ยังไม่บันทึกจะหายไป", confirmLabel: "ทิ้งข้อมูล" }).then((ok) => { if (ok) onClose(); }); }, [confirm, isDirty, onClose]);
  // เตือนอีกชั้นตอนผู้ใช้กดปิดแท็บหรือกดย้อนกลับของเบราว์เซอร์
  useUnsavedChanges(isDirty);

  // เปิดกล่องให้ห้องอื่นหรือคนอื่น ต้องล้างค่าที่ค้างจากรอบก่อนทิ้งให้หมด
  useEffect(() => {
    const nextRoom = mode === "add" ? availableRooms.find((item) => item.id === room.id) ?? availableRooms[0] ?? room : room;
    setSelectedRoomId(nextRoom.id);
    setName(tenant?.name ?? "");
    setPhone(tenant?.phone ?? "");
    setStartDate(tenant?.startDate ?? "");
    setContractEnd(tenant?.contractEnd ?? "");
    setDeposit(tenant ? String(tenant.deposit) : "");
  }, [availableRooms, mode, room, tenant]);

  // เปลี่ยนชั้นแล้วเด้งไปห้องว่างห้องแรกของชั้นนั้น ไม่ปล่อยให้ค้างห้องของชั้นเดิม
  const changeFloor = (floorValue: string) => {
    const nextFloor = Number(floorValue);
    const nextRoom = availableRooms.find((item) => item.floor === nextFloor);
    if (nextRoom) {
      setSelectedRoomId(nextRoom.id);
      setDeposit(tenant ? String(tenant.deposit) : "");
    }
  };

  const changeRoom = (roomId: string) => {
    const nextRoom = availableRooms.find((item) => item.id === roomId);
    setSelectedRoomId(roomId);
    if (nextRoom && tenant) setDeposit(String(tenant.deposit));
  };

  const submitForm = (event: SyntheticEvent<HTMLFormElement>) => {
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ
    event.preventDefault();
    if (mode === "add" && availableRooms.length === 0) return;
    // ตรวจครบทุกช่องก่อนส่ง ส่วนการตรวจจริงยังต้องทำซ้ำที่เซิร์ฟเวอร์อยู่ดี
    if (!name.trim() || !phone.trim() || !startDate || !contractEnd || deposit === "" || !Number.isFinite(Number(deposit))) return;

    onSave({
      tenant: {
        // กระจายของเดิมมาก่อน แล้วทับด้วยค่าที่แก้ ฟิลด์ที่กล่องนี้ไม่ได้แตะจะได้ไม่หาย
        ...tenant,
        address: tenant?.address ?? "-",
        guardianName: tenant?.guardianName ?? "-",
        guardianPhone: tenant?.guardianPhone ?? "-",
        // ผู้เช่าใหม่ยังไม่มี id จริงจากฐานข้อมูล จึงตั้งชั่วคราวไว้ให้ React ใช้เป็น key ก่อน
        id: tenant?.id ?? `t-${selectedTenantRoom.id}`,
        name: name.trim(),
        phone: phone.trim(),
        roomId: selectedTenantRoom.id,
        startDate,
        contractEnd,
        deposit: Number(deposit),
        vehicleDetail: tenant?.vehicleDetail ?? "-",
        vehiclePlate: tenant?.vehiclePlate ?? "-",
        vehicleType: tenant?.vehicleType ?? "ไม่มีรถ",
      },
    });
  };

  return (
    <><Dialog ariaDescribedBy="tenant-edit-description" ariaLabelledBy="tenant-edit-title" onClose={requestClose}>
        <header className="modal-header">
          <div>
            <p className="eyebrow" id="tenant-edit-description">{mode === "add" ? "เพิ่มผู้เช่าใหม่" : "แก้ไขข้อมูลผู้เช่า"}</p>
            <h2 id="tenant-edit-title">{mode === "add" ? "เลือกห้องว่าง" : `ห้อง ${selectedTenantRoom.id}`}</h2>
          </div>
          <IconButton label="ปิดหน้าต่าง" onClick={requestClose}>
            <X aria-hidden="true" size={18} />
          </IconButton>
        </header>

        <form className="modal-form" onSubmit={submitForm}>
          <div className="modal-grid">
            {mode === "add" ? <RoomPickerFields
              availableRooms={availableRooms}
              changeFloor={changeFloor}
              changeRoom={changeRoom}
              floors={floors}
              roomsOnSelectedFloor={roomsOnSelectedFloor}
              selectedFloor={selectedFloor}
              selectedRoomId={selectedTenantRoom.id}
            /> : null}

            <label>
              <span>ชื่อผู้เช่า</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>

            <label>
              <span>เบอร์โทร</span>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>

            <DatePickerField label="วันเริ่มสัญญา" value={startDate} onChange={setStartDate} />

            <DatePickerField label="วันสิ้นสุดสัญญา" value={contractEnd} onChange={setContractEnd} />

            <label>
              <span>เงินประกัน</span>
              <input min={0} required step="0.01" type="number" value={deposit} onChange={(event) => setDeposit(event.target.value)} />
            </label>

            <div className="modal-summary">
              <span>เงินประกันปัจจุบัน</span>
              <strong>{deposit === "" ? "ยังไม่ระบุ" : currency.format(Number(deposit))}</strong>
            </div>
          </div>

          <footer className="modal-actions">
            <button className="secondary-button" onClick={requestClose} type="button">ยกเลิก</button>
            <div className="disabled-action">
              <button aria-describedby={mode === "add" && availableRooms.length === 0 ? "tenant-save-disabled-reason" : undefined} className="primary-button" disabled={mode === "add" && availableRooms.length === 0} type="submit">บันทึกข้อมูลผู้เช่า</button>
              {/* ปุ่มที่กดไม่ได้ต้องบอกเหตุผลด้วย ไม่งั้นคนใช้โปรแกรมอ่านหน้าจอจะไม่รู้ว่าติดอะไร */}
              {mode === "add" && availableRooms.length === 0 ? <p className="disabled-reason" id="tenant-save-disabled-reason">ยังไม่มีห้องว่างสำหรับเพิ่มผู้เช่า</p> : null}
            </div>
          </footer>
        </form>
    </Dialog>{confirmationDialog}</>
  );
}

// ช่องเลือกชั้นและห้อง มีเฉพาะตอนเพิ่มผู้เช่าใหม่ แก้ไขผู้เช่าเดิมไม่ต้องย้ายห้องที่นี่
// ไม่มีห้องว่างก็บอกทางแก้ไปเลยว่าต้องไปปรับสถานะห้องก่อน ไม่ใช่แค่บอกว่าไม่มี
function RoomPickerFields({ availableRooms, changeFloor, changeRoom, floors, roomsOnSelectedFloor, selectedFloor, selectedRoomId }: Readonly<{
  availableRooms: Room[];
  changeFloor: (value: string) => void;
  changeRoom: (value: string) => void;
  floors: number[];
  roomsOnSelectedFloor: Room[];
  selectedFloor: number;
  selectedRoomId: string;
}>) {
  if (availableRooms.length === 0) {
    return <div className="modal-summary full-width">
      <span>ไม่มีห้องว่างสำหรับเพิ่มผู้เช่าใหม่</span>
      <strong>กรุณาปรับสถานะห้องเป็นว่างก่อน</strong>
    </div>;
  }
  return <>
    <div className="modal-field">
      <DropdownField label="ชั้น" onChange={changeFloor} options={floors.map((floor) => ({ value: String(floor), label: `ชั้น ${floor}` }))} value={String(selectedFloor)} />
    </div>
    <div className="modal-field">
      <DropdownField label="ห้องว่าง" onChange={changeRoom} options={roomsOnSelectedFloor.map((item) => ({ value: item.id, label: `ห้อง ${item.id}` }))} value={selectedRoomId} />
    </div>
  </>;
}
