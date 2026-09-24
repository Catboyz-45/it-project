"use client";
// ร่างโครงสร้างหอพักในหน้าตั้งค่า ชั้น ห้อง ประเภทห้อง และเฟอร์นิเจอร์
// แยกจาก SettingsPage เพราะเป็นตรรกะล้วน ๆ ที่ตรวจความถูกต้องแล้วค่อยยิงคำขอ
// การตรวจจริงอยู่ที่เซิร์ฟเวอร์เสมอ ฝั่งนี้เป็นแค่การช่วยผู้ใช้ให้รู้ตัวก่อนกด

import { useState } from "react";
import type { Room } from "@/types/dorm";
import type { PropertySettingsReadModel, RoomTypeSetting, ServiceChargeSetting } from "@/types/dashboard";

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "default" | "danger";
};

export function usePropertyStructureDraft({
  confirm,
  initialSettings,
  onDataChanged,
  propertyId,
  rooms,
}: {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  initialSettings: PropertySettingsReadModel;
  onDataChanged: () => Promise<void>;
  propertyId: string;
  rooms: Room[];
}) {
  const [roomTypes, setRoomTypes] = useState<RoomTypeSetting[]>(initialSettings.roomTypes);
  const [newRoomType, setNewRoomType] = useState({ name: "", rent: "", deposit: "", capacity: "2" });
  const [editingRoomTypeId, setEditingRoomTypeId] = useState<string | null>(null);
  const [serviceCharges] = useState<ServiceChargeSetting[]>(initialSettings.serviceCharges);
  const [defaultFurniture, setDefaultFurniture] = useState<string[]>(initialSettings.defaultFurniture);
  const [furnitureOptions, setFurnitureOptions] = useState<string[]>(initialSettings.furnitureOptions);
  const [newFurniture, setNewFurniture] = useState("");
  const [configuredFloors, setConfiguredFloors] = useState<number[]>(
    Array.from(new Set(initialSettings.floorDirectory.map((item) => item.number)))
      .sort((a, b) => a - b),
  );
  const floorDirectory = initialSettings.floorDirectory;
  const [newFloor, setNewFloor] = useState("");
  const [newRoomFloor, setNewRoomFloor] = useState("");
  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newRoomTypeId, setNewRoomTypeId] = useState("");
  const [roomManagementError, setRoomManagementError] = useState("");
  const floors = configuredFloors;

  // เพิ่มชั้นก่อนถึงจะสร้างห้องในชั้นนั้นได้
  const addFloor = async () => {
    const floor = Number(newFloor);
    // จำกัด 1-99 เพราะเลขห้องในระบบใช้ตัวแรกเป็นเลขชั้น
    if (!Number.isInteger(floor) || floor < 1 || floor > 99) {
      setRoomManagementError("กรุณาระบุชั้นเป็นเลข 1–99");
      return;
    }
    if (floors.includes(floor)) {
      setRoomManagementError(`มีชั้น ${floor} อยู่แล้ว`);
      return;
    }
    const buildingId = floorDirectory[0]?.buildingId;
    if (!buildingId) {
      setRoomManagementError("ยังไม่มีอาคาร กรุณาสร้างอาคารก่อนเพิ่มชั้น");
      return;
    }
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/buildings/${buildingId}/floors`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: floor, label: `ชั้น ${floor}` }),
      });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "เพิ่มชั้นไม่สำเร็จ");
      setConfiguredFloors((current) => [...current, floor].sort((a, b) => a - b));
      setNewFloor("");
      setNewRoomFloor(String(floor));
      setRoomManagementError("");
      await onDataChanged();
    } catch (error) {
      setRoomManagementError(error instanceof Error ? error.message : "เพิ่มชั้นไม่สำเร็จ");
    }
  };

  const addRoom = async () => {
    const floor = Number(newRoomFloor || floors[0]);
    const roomId = newRoomNumber.trim();
    const selectedType = roomTypes.find((item) => item.id === newRoomTypeId) ?? roomTypes[0];
    if (!floors.includes(floor)) {
      setRoomManagementError("กรุณาเลือกชั้นที่มีอยู่");
      return;
    }
    if (!/^[A-Za-z0-9-]{1,30}$/.test(roomId)) {
      setRoomManagementError("เลขห้องใช้ได้เฉพาะตัวอักษร ตัวเลข และขีดกลาง");
      return;
    }
    if (rooms.some((room) => room.id === roomId)) {
      setRoomManagementError(`มีห้อง ${roomId} อยู่แล้ว`);
      return;
    }
    const targetFloor = floorDirectory.find((item) => item.number === floor);
    if (!targetFloor) {
      setRoomManagementError("ไม่พบชั้นในฐานข้อมูล กรุณาเพิ่มชั้นก่อน");
      return;
    }
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/rooms`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buildingId: targetFloor.buildingId, floorId: targetFloor.id, number: roomId,
          roomType: selectedType?.name ?? "ห้องมาตรฐาน",
          monthlyRent: selectedType?.rent ?? 0,
          depositAmount: selectedType?.deposit ?? 0,
          capacity: selectedType?.capacity ?? 1,
          furniture: defaultFurniture,
        }),
      });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "เพิ่มห้องไม่สำเร็จ");
      setNewRoomNumber("");
      setRoomManagementError("");
      await onDataChanged();
    } catch (error) {
      setRoomManagementError(error instanceof Error ? error.message : "เพิ่มห้องไม่สำเร็จ");
    }
  };

  const removeRoom = async (room: Room) => {
    if (room.status !== "available") {
      setRoomManagementError(`ลบห้อง ${room.id} ไม่ได้ เพราะห้องไม่ได้ว่าง`);
      return;
    }
    if (!room.databaseId) {
      setRoomManagementError("ไม่พบรหัสห้องในฐานข้อมูล");
      return;
    }
    if (!await confirm({
      title: `ปิดใช้งานห้อง ${room.id}?`,
      description: "ห้องนี้จะหายจากรายการห้องที่เปิดใช้งาน และต้องตั้งค่าขึ้นใหม่หากต้องการนำกลับมาใช้",
      confirmLabel: "ปิดใช้งานห้อง",
      variant: "danger",
    })) return;
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/rooms/${room.databaseId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "INACTIVE" }),
      });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "ปิดใช้งานห้องไม่สำเร็จ");
      setRoomManagementError("");
      await onDataChanged();
    } catch (error) {
      setRoomManagementError(error instanceof Error ? error.message : "ปิดใช้งานห้องไม่สำเร็จ");
    }
  };

  const addFurniture = () => {
    const name = newFurniture.trim();
    if (!name) {
      setRoomManagementError("กรุณากรอกชื่อเฟอร์นิเจอร์หรืออุปกรณ์");
      return;
    }
    if (furnitureOptions.some((item) => item.toLocaleLowerCase("th-TH") === name.toLocaleLowerCase("th-TH"))) {
      setRoomManagementError(`มีรายการ “${name}” อยู่แล้ว`);
      return;
    }
    setFurnitureOptions((current) => [...current, name]);
    setDefaultFurniture((current) => [...current, name]);
    setNewFurniture("");
    setRoomManagementError("");
  };

  const removeFurniture = async (name: string) => {
    if (!await confirm({
      title: `ลบ “${name}”?`,
      description: "รายการนี้จะถูกนำออกจากตัวเลือกเฟอร์นิเจอร์และชุดเริ่มต้นของห้องใหม่",
      confirmLabel: "ลบรายการ",
      variant: "danger",
    })) return;
    setFurnitureOptions((current) => current.filter((item) => item !== name));
    setDefaultFurniture((current) => current.filter((item) => item !== name));
  };

  const removeFloor = async (floor: number) => {
    if (rooms.some((room) => room.floor === floor)) return;
    if (!await confirm({
      title: `ลบชั้น ${floor}?`,
      description: "ชั้นนี้จะถูกนำออกจากโครงสร้างหอพักหลังจากบันทึกการตั้งค่า",
      confirmLabel: "ลบชั้น",
      variant: "danger",
    })) return;
    setConfiguredFloors((current) => current.filter((item) => item !== floor));
  };

  const removeRoomType = async (id: string) => {
    const roomType = roomTypes.find((item) => item.id === id);
    if (!roomType) return;
    if (rooms.some((room) => room.roomType === id)) {
      setRoomManagementError("ลบประเภทห้องที่กำลังถูกใช้งานไม่ได้");
      return;
    }
    if (!await confirm({
      title: `ลบประเภทห้อง “${roomType.name}”?`,
      description: "ค่าเช่า เงินประกัน และจำนวนผู้พักของประเภทนี้จะถูกนำออกหลังจากบันทึกการตั้งค่า",
      confirmLabel: "ลบประเภทห้อง",
      variant: "danger",
    })) return;
    setRoomTypes((current) => current.filter((item) => item.id !== id));
  };

  const addRoomType = () => {
    const name = newRoomType.name.trim();
    if (!name || roomTypes.some((item) => item.id !== editingRoomTypeId && item.name.toLocaleLowerCase("th-TH") === name.toLocaleLowerCase("th-TH"))) {
      setRoomManagementError(name ? `มีประเภท “${name}” อยู่แล้ว` : "กรุณากรอกชื่อประเภทห้อง");
      return;
    }
    const updated = {
      id: editingRoomTypeId ?? name,
      name,
      rent: Math.max(0, Number(newRoomType.rent) || 0),
      deposit: Math.max(0, Number(newRoomType.deposit) || 0),
      capacity: Math.max(1, Number(newRoomType.capacity) || 1),
    };
    setRoomTypes((current) => editingRoomTypeId ? current.map((item) => item.id === editingRoomTypeId ? updated : item) : [...current, updated]);
    setNewRoomType({ name: "", rent: "", deposit: "", capacity: "2" });
    setEditingRoomTypeId(null);
    setRoomManagementError("");
  };

  return {
    addFloor,
    addFurniture,
    addRoom,
    addRoomType,
    configuredFloors,
    defaultFurniture,
    editingRoomTypeId,
    furnitureOptions,
    newFloor,
    newFurniture,
    newRoomFloor,
    newRoomNumber,
    newRoomType,
    newRoomTypeId,
    removeFloor,
    removeFurniture,
    removeRoom,
    removeRoomType,
    roomManagementError,
    roomTypes,
    serviceCharges,
    setDefaultFurniture,
    setEditingRoomTypeId,
    setNewFloor,
    setNewFurniture,
    setNewRoomFloor,
    setNewRoomNumber,
    setNewRoomType,
    setNewRoomTypeId,
  };
}
