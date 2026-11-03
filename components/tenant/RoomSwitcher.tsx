"use client";
// ห้องที่กำลังดูอยู่ ขึ้นเป็นการ์ดบนสุดของแถบข้างแบบเดียวกับตัวเลือกหอของเจ้าของหอ
// บนมือถือไม่มีแถบข้าง จึงย่อเหลือป้ายเล็กข้างกระดิ่ง
// ผู้เช่าส่วนใหญ่มีห้องเดียว การ์ดจึงเป็นแค่ป้ายบอก กดได้เฉพาะคนที่มีหลายห้อง

import { Building2, Check, ChevronDown, ChevronsUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type SwitchableRoom = {
  id: string;
  role: "PRIMARY" | "CO_OCCUPANT";
  room: { number: string };
  property: { name: string; shortName: string };
};

export function RoomSwitcher({ activeId, disabled, onSwitch, rooms, variant }: Readonly<{
  activeId: string;
  disabled: boolean;
  onSwitch: (occupancyId: string) => void;
  rooms: SwitchableRoom[];
  variant: "sidebar" | "chip";
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const active = rooms.find(({ id }) => id === activeId);

  useEffect(() => {
    if (!isOpen) return;
    // คลิกนอกเมนูหรือกด Esc แล้วปิด เหมือนเมนูบัญชีท้ายแถบข้าง
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  if (!active) return null;
  const canSwitch = rooms.length > 1;
  const face = variant === "sidebar"
    ? <>
      <span aria-hidden="true" className="tenant-room-icon"><Building2 size={18} /></span>
      <span className="tenant-room-copy">
        <strong>ห้อง {active.room.number}</strong>
        <small>{active.property.name}</small>
      </span>
      {canSwitch ? <ChevronsUpDown aria-hidden="true" className="tenant-room-switch-icon" size={16} /> : null}
    </>
    : <>
      <Building2 aria-hidden="true" size={15} />
      <span>ห้อง {active.room.number}</span>
      {canSwitch ? <ChevronDown aria-hidden="true" size={15} /> : null}
    </>;
  const className = variant === "sidebar" ? "tenant-room-card" : "tenant-room-chip";

  if (!canSwitch) {
    return <div className={className} title={`${active.property.name} · ห้อง ${active.room.number}`}>{face}</div>;
  }

  const choose = (occupancyId: string) => {
    setIsOpen(false);
    if (occupancyId !== activeId) onSwitch(occupancyId);
  };

  return <div className="relative" ref={containerRef}>
    <button
      aria-expanded={isOpen}
      aria-haspopup="menu"
      aria-label={`สลับห้อง ตอนนี้ดูห้อง ${active.room.number} ${active.property.name}`}
      className={className}
      disabled={disabled}
      onClick={() => setIsOpen((current) => !current)}
      type="button"
    >
      {face}
    </button>
    {isOpen ? <div className={`property-menu ${variant === "sidebar" ? "sidebar-property-menu" : "tenant-room-chip-menu"}`} role="menu">
      <p>สลับห้อง</p>
      {rooms.map((room) => <button aria-checked={room.id === activeId} key={room.id} onClick={() => choose(room.id)} role="menuitemradio" type="button">
        <span aria-hidden="true" className="tenant-room-icon"><Building2 size={16} /></span>
        <span>
          <strong>ห้อง {room.room.number}</strong>
          <small>{room.property.shortName} · {room.role === "PRIMARY" ? "ผู้เช่าหลัก" : "ผู้พักร่วม"}</small>
        </span>
        {room.id === activeId ? <Check aria-hidden="true" size={16} /> : null}
      </button>)}
    </div> : null}
  </div>;
}
