"use client";
// ช่องเลือกห้องแบบค้นหาได้ เก็บสถานะเปิดปิด คำค้น และตัวกรองไว้ในเบราว์เซอร์

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  countInvitationRooms,
  filterInvitationRooms,
  type InvitationRoomFilter,
  type InvitationRoomOption,
  type InvitationRoomState,
  invitationRoomState,
  invitationRoomStateLabel,
  isInvitationRoomSelectable,
} from "@/lib/domain/invitation-rooms";
import { rovingIndex } from "@/components/ui/use-tablist-keyboard";

// สีป้ายสถานะ ใช้ชุดเดียวกับป้ายในประวัติคำเชิญ
const stateStyles: Record<InvitationRoomState, string> = {
  vacant: "bg-emerald-100 text-emerald-800",
  invited: "bg-amber-100 text-amber-800",
  occupied: "bg-slate-100 text-slate-700",
  full: "bg-slate-100 text-slate-700",
  closed: "bg-red-100 text-red-700",
};

const filters: Array<{ value: InvitationRoomFilter; label: string }> = [
  { value: "available", label: "ว่าง" },
  { value: "occupied", label: "มีผู้เช่า" },
  { value: "all", label: "ทั้งหมด" },
];

function roomLabel(room: InvitationRoomOption) {
  return `ห้อง ${room.number} · ${room.buildingName} ชั้น ${room.floorNumber}`;
}

// บรรทัดรองใต้เลขห้องในรายการ บอกที่ตั้ง และถ้ามีคนพักอยู่ก็บอกชื่อผู้เช่าหลักกับจำนวนคน
function roomDetail(room: InvitationRoomOption) {
  const place = `${room.buildingName} ชั้น ${room.floorNumber}`;
  if (!room.occupantCount) return place;
  return `${place} · ${room.primaryTenantName ?? "ผู้พักร่วม"} · พัก ${room.occupantCount}/${room.capacity} คน`;
}

function RoomStateBadge({ room }: Readonly<{ room: InvitationRoomOption }>) {
  return <span className={`room-state-badge ${stateStyles[invitationRoomState(room)]}`}>{invitationRoomStateLabel(room)}</span>;
}

// แบบช่องค้นหาของ GitHub กับ Stripe โฟกัสอยู่ที่ช่องพิมพ์ตลอด ลูกศรเลื่อนรายการผ่าน aria-activedescendant
export function InvitationRoomPicker({ disabled = false, onChange, rooms, value }: Readonly<{
  disabled?: boolean;
  onChange: (room: InvitationRoomOption) => void;
  rooms: readonly InvitationRoomOption[];
  value: string;
}>) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InvitationRoomFilter>("available");
  const [activeId, setActiveId] = useState("");
  const selected = rooms.find((room) => room.id === value);
  const visible = filterInvitationRooms(rooms, query, filter);
  const selectable = visible.filter(isInvitationRoomSelectable);
  const counts = countInvitationRooms(rooms, query);

  // เปิดมาแล้วถ้าห้องที่เลือกอยู่ไม่อยู่ในตัวกรองเริ่มต้น สลับไปดูทั้งหมด ผู้ใช้จะได้เห็นห้องที่เลือกไว้
  const open = () => {
    const startFilter: InvitationRoomFilter = selected && filterInvitationRooms([selected], "", "available").length === 0 ? "all" : "available";
    setQuery("");
    setFilter(startFilter);
    setActiveId(selected && isInvitationRoomSelectable(selected) ? selected.id : "");
    setIsOpen(true);
  };

  const close = (restoreFocus: boolean) => {
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const choose = (room: InvitationRoomOption) => {
    if (!isInvitationRoomSelectable(room)) return;
    onChange(room);
    close(true);
  };

  // ตัวที่ไฮไลต์อยู่ต้องอยู่ในรายการที่เห็นเสมอ พิมพ์หรือสลับตัวกรองแล้วหายไปก็ย้ายไปตัวแรกแทน
  const activeRoom = selectable.find((room) => room.id === activeId) ?? selectable[0];

  useEffect(() => {
    if (!isOpen || !activeRoom) return;
    listRef.current?.querySelector(`[data-room-id="${activeRoom.id}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeRoom, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // คลิกนอกกล่องแล้วปิด ไม่คืนโฟกัสเพราะผู้ใช้กำลังจะไปกดที่อื่น
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isOpen]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      setIsOpen(false);
      return;
    }
    if (event.key === "Enter") {
      // Enter ในช่องค้นหาต้องไม่ไปส่งฟอร์มสร้างคำเชิญ
      event.preventDefault();
      if (activeRoom) choose(activeRoom);
      return;
    }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && selectable.length) {
      event.preventDefault();
      const position = Math.max(0, selectable.findIndex((room) => room.id === activeRoom?.id));
      setActiveId(selectable[rovingIndex(event.key, position, selectable.length)].id);
    }
  };

  return <div className="dropdown-field room-picker" ref={rootRef}>
    <span className="dropdown-label" id={`${id}-label`}>ห้อง</span>
    <button
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      aria-labelledby={`${id}-label ${id}-value`}
      className={`dropdown-trigger${isOpen ? " open" : ""}`}
      disabled={disabled}
      onClick={() => isOpen ? close(false) : open()}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          open();
        }
      }}
      ref={triggerRef}
      type="button"
    >
      <span className="dropdown-trigger-value" id={`${id}-value`}>{selected ? roomLabel(selected) : "เลือกห้อง"}</span>
      <span className="flex shrink-0 items-center gap-2">
        {selected ? <RoomStateBadge room={selected} /> : null}
        <ChevronDown aria-hidden="true" className={isOpen ? "open" : ""} size={20} />
      </span>
    </button>
    {isOpen ? <div className="dropdown-popover room-picker-popover">
      <div className="room-picker-search">
        <Search aria-hidden="true" size={16} />
        <input
          aria-activedescendant={activeRoom ? `${id}-room-${activeRoom.id}` : undefined}
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
          aria-expanded="true"
          aria-label="ค้นหาห้อง"
          // ผู้ใช้กดเปิดเพื่อเลือกห้อง พิมพ์ค้นได้ทันทีโดยไม่ต้องคลิกช่องค้นหาอีกครั้ง
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="พิมพ์เลขห้อง อาคาร หรือชื่อผู้เช่า"
          role="combobox"
          type="search"
          value={query}
        />
      </div>
      <div aria-label="กรองตามสถานะห้อง" className="room-picker-filters" role="group">
        {filters.map((option) => <button
          aria-pressed={filter === option.value}
          className={filter === option.value ? "active" : ""}
          key={option.value}
          // กดแล้วโฟกัสยังอยู่ที่ช่องค้นหา พิมพ์ต่อได้เลย
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setFilter(option.value)}
          type="button"
        >
          {option.label} <span>{counts[option.value]}</span>
        </button>)}
      </div>
      <div className="dropdown-menu room-picker-list" id={`${id}-listbox`} ref={listRef} role="listbox" aria-label="ห้อง">
        {visible.length === 0 ? <div className="room-picker-empty">
          <p>{query.trim() ? `ไม่พบห้องที่ตรงกับ "${query.trim()}"` : "ไม่มีห้องในหมวดนี้"}</p>
          {filter === "all" ? null : <button onClick={() => setFilter("all")} onMouseDown={(event) => event.preventDefault()} type="button">ดูทุกห้อง</button>}
        </div> : visible.map((room) => {
          const isSelectable = isInvitationRoomSelectable(room);
          const isSelected = room.id === value;
          const isActive = room.id === activeRoom?.id;
          return <div
            aria-disabled={!isSelectable}
            aria-selected={isSelected}
            className={`room-picker-option${isActive ? " active" : ""}${isSelected ? " selected" : ""}${isSelectable ? "" : " disabled"}`}
            data-room-id={room.id}
            id={`${id}-room-${room.id}`}
            key={room.id}
            // ไม่ให้ช่องค้นหาเสียโฟกัสตอนกดเลือก
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(room)}
            onMouseEnter={() => { if (isSelectable) setActiveId(room.id); }}
            role="option"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate">ห้อง {room.number}</span>
              <small className="block truncate">{roomDetail(room)}</small>
            </span>
            <RoomStateBadge room={room} />
            <span className="dropdown-check">{isSelected ? <Check size={18} /> : null}</span>
          </div>;
        })}
      </div>
      <div className="room-picker-footer">
        <span aria-live="polite">แสดง {visible.length} จาก {rooms.length} ห้อง</span>
        <span aria-hidden="true" className="room-picker-keys"><kbd>↑</kbd><kbd>↓</kbd> เลื่อน <kbd>Enter</kbd> เลือก <kbd>Esc</kbd> ปิด</span>
      </div>
    </div> : null}
  </div>;
}
