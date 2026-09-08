"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Tenant Edit Modal” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { DatePickerField } from "@/components/dorm/DatePickerField";
import { DropdownField } from "@/components/dorm/DropdownField";
import { currency } from "@/lib/dorm-utils";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { IconButton } from "@/components/ui/IconButton";
import { Dialog } from "@/components/ui/Dialog";
import type { Room, Tenant } from "@/types/dorm";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: interface “Tenant Edit Payload” ระบุว่าข้อมูลต้องมีฟิลด์อะไร เพื่อให้หลายส่วนส่งข้อมูลตรงรูปแบบกัน
 */
export interface TenantEditPayload {
  tenant: Tenant;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Tenant Edit Modal” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { mode = "edit", room, rooms, tenant, onClose, onSave, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function TenantEditModal({
  mode = "edit",
  room,
  rooms,
  tenant,
  onClose,
  onSave,
}: {
  mode?: "add" | "edit";
  room: Room;
  rooms?: Room[];
  tenant?: Tenant;
  onClose: () => void;
  onSave: (payload: TenantEditPayload) => void;
}) {
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “all Rooms” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const allRooms = useMemo(() => rooms ?? [room], [room, rooms]);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “available Rooms” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const availableRooms = useMemo(() => allRooms.filter((item) => item.status === "available"), [allRooms]);
  const initialRoom = mode === "add" ? availableRooms.find((item) => item.id === room.id) ?? availableRooms[0] ?? room : room;
  const [selectedRoomId, setSelectedRoomId] = useState(initialRoom.id);
  const [name, setName] = useState(tenant?.name ?? "");
  const [phone, setPhone] = useState(tenant?.phone ?? "");
  const [startDate, setStartDate] = useState(tenant?.startDate ?? "");
  const [contractEnd, setContractEnd] = useState(tenant?.contractEnd ?? "");
  const selectedTenantRoom = allRooms.find((item) => item.id === selectedRoomId) ?? initialRoom;
  const [deposit, setDeposit] = useState(tenant ? String(tenant.deposit) : "");
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “floors” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - a: ค่า “a” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - b: ค่า “b” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const floors = Array.from(new Set(availableRooms.map((item) => item.floor))).sort((a, b) => a - b);
  const selectedFloor = selectedTenantRoom.floor;
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “rooms On Selected Floor” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const roomsOnSelectedFloor = availableRooms.filter((item) => item.floor === selectedFloor);
  const initialSnapshot = JSON.stringify({ contractEnd: tenant?.contractEnd ?? "", deposit: tenant ? String(tenant.deposit) : "", name: tenant?.name ?? "", phone: tenant?.phone ?? "", selectedRoomId: initialRoom.id, startDate: tenant?.startDate ?? "" });
  const isDirty = JSON.stringify({ contractEnd, deposit, name, phone, selectedRoomId, startDate }) !== initialSnapshot;
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
    const nextRoom = mode === "add" ? availableRooms.find((item) => item.id === room.id) ?? availableRooms[0] ?? room : room;
    setSelectedRoomId(nextRoom.id);
    setName(tenant?.name ?? "");
    setPhone(tenant?.phone ?? "");
    setStartDate(tenant?.startDate ?? "");
    setContractEnd(tenant?.contractEnd ?? "");
    setDeposit(tenant ? String(tenant.deposit) : "");
  }, [availableRooms, mode, room, tenant]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “change Floor” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - floorValue: ค่า “floor Value” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const changeFloor = (floorValue: string) => {
    const nextFloor = Number(floorValue);
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “next Room” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const nextRoom = availableRooms.find((item) => item.floor === nextFloor);
    if (nextRoom) {
      setSelectedRoomId(nextRoom.id);
      setDeposit(tenant ? String(tenant.deposit) : "");
    }
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “change Room” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - roomId: รหัสภายในของห้องพัก
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const changeRoom = (roomId: string) => {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “next Room” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const nextRoom = availableRooms.find((item) => item.id === roomId);
    setSelectedRoomId(roomId);
    if (nextRoom && tenant) setDeposit(String(tenant.deposit));
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
    if (mode === "add" && availableRooms.length === 0) return;
    if (!name.trim() || !phone.trim() || !startDate || !contractEnd || deposit === "" || !Number.isFinite(Number(deposit))) return;

    onSave({
      tenant: {
        ...tenant,
        address: tenant?.address ?? "-",
        guardianName: tenant?.guardianName ?? "-",
        guardianPhone: tenant?.guardianPhone ?? "-",
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
            {mode === "add" ? (
              availableRooms.length > 0 ? (
                <>
                  <div className="modal-field">
                    <DropdownField
                      label="ชั้น"
                      value={String(selectedFloor)}
                      onChange={changeFloor}
                      options={floors.map((floor) => ({ value: String(floor), label: `ชั้น ${floor}` }))}
                    />
                  </div>
                  <div className="modal-field">
                    <DropdownField
                      label="ห้องว่าง"
                      value={selectedTenantRoom.id}
                      onChange={changeRoom}
                      options={roomsOnSelectedFloor.map((item) => ({ value: item.id, label: `ห้อง ${item.id}` }))}
                    />
                  </div>
                </>
              ) : (
                <div className="modal-summary full-width">
                  <span>ไม่มีห้องว่างสำหรับเพิ่มผู้เช่าใหม่</span>
                  <strong>กรุณาปรับสถานะห้องเป็นว่างก่อน</strong>
                </div>
              )
            ) : null}

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
              {mode === "add" && availableRooms.length === 0 ? <p className="disabled-reason" id="tenant-save-disabled-reason">ยังไม่มีห้องว่างสำหรับเพิ่มผู้เช่า</p> : null}
            </div>
          </footer>
        </form>
    </Dialog>{confirmationDialog}</>
  );
}
