"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Settings Page” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Banknote, Building2, CalendarDays, CheckCircle2, ChevronRight, CreditCard, FileText, Home, LockKeyhole, MailPlus, Package, UserRound, X } from "lucide-react";
import { DropdownField } from "@/components/dorm/DropdownField";
import { DocumentTemplatePanel } from "@/components/dorm/DocumentTemplatePanel";
import { InvitationsPage } from "@/components/dorm/InvitationsPage";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { useTablistKeyboard } from "@/components/ui/use-tablist-keyboard";
import { SubscriptionPage } from "@/components/dorm/SubscriptionPage";
import { useToast } from "@/components/ui/ToastProvider";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { createApiError, formatClientError } from "@/lib/client/api-error";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";
import type { Room } from "@/types/dorm";
import type {
  OwnerDashboardAggregation,
  PropertySettingsReadModel,
  RoomTypeSetting,
  ServiceChargeSetting,
} from "@/types/dashboard";
import { PrivacyPreferencesPanel } from "@/components/legal/PrivacyPreferencesPanel";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Settings Section” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type SettingsSection = "general" | "billing" | "cycles" | "rooms" | "assets" | "documents" | "invitations" | "subscription" | "account";

const settingSections: Array<{ key: SettingsSection; label: string; icon: ComponentType<{ "aria-hidden"?: boolean; size?: number }> }> = [
  { key: "general", label: "ข้อมูลหอ", icon: Building2 },
  { key: "billing", label: "ค่าใช้จ่าย", icon: Banknote },
  { key: "cycles", label: "รอบบิล", icon: CalendarDays },
  { key: "rooms", label: "ห้องพัก", icon: Home },
  { key: "assets", label: "เฟอร์นิเจอร์และทรัพย์สิน", icon: Package },
  { key: "documents", label: "เอกสาร", icon: FileText },
  { key: "invitations", label: "คำเชิญผู้เช่า", icon: MailPlus },
  { key: "subscription", label: "แพ็กเกจและการต่ออายุ", icon: CreditCard },
  { key: "account", label: "บัญชีและความปลอดภัย", icon: UserRound },
];
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “system Setting Sections” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - section: ค่า “section” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const systemSettingSections = settingSections.filter((section) => section.key !== "account");
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “system Setting Section Keys” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - { key }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const systemSettingSectionKeys = systemSettingSections.map(({ key }) => key);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Settings Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { accountEmail, accountName, initialSection, initialSettings: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function SettingsPage({
  accountEmail,
  accountName,
  initialSection,
  initialSettings,
  onAccountNameChange,
  onDataChanged,
  propertyId,
  readOnly = false,
  rooms,
  subscription,
}: {
  accountEmail: string;
  accountName: string;
  initialSection: "account" | "general" | "invitations" | "subscription";
  initialSettings: PropertySettingsReadModel;
  onAccountNameChange: (name: string) => void;
  onDataChanged: () => Promise<void>;
  propertyId: string;
  readOnly?: boolean;
  rooms: Room[];
  subscription: OwnerDashboardAggregation["subscription"];
}) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const handleSettingsKeyDown = useTablistKeyboard(systemSettingSectionKeys, setActiveSection);
  const [settings, setSettings] = useState({
    businessName: initialSettings.legalName ?? "",
    contactPhone: initialSettings.contactPhone ?? "",
    contactEmail: initialSettings.contactEmail ?? "",
    dueDay: String(initialSettings.dueDay ?? 5),
    electricityUnitRate: String(initialSettings.electricityUnitRate ?? 0),
    invoicePrefix: initialSettings.invoicePrefix ?? "INV",
    lateFee: String(initialSettings.lateFeePerDay ?? 0),
    meterReadDay: String(initialSettings.meterReadDay ?? 28),
    promptPay: initialSettings.promptPayId ?? "",
    propertyAddress: initialSettings.address ?? "",
    propertyName: initialSettings.propertyName,
    waterExtraRate: String(initialSettings.waterExtraRate ?? 0),
    paymentNote: initialSettings.invoiceFooter ?? "",
  });
  const [roomTypes, setRoomTypes] = useState<RoomTypeSetting[]>(initialSettings.roomTypes);
  const [newRoomType, setNewRoomType] = useState({ name: "", rent: "", deposit: "", capacity: "2" });
  const [editingRoomTypeId, setEditingRoomTypeId] = useState<string | null>(null);
  const [serviceCharges] = useState<ServiceChargeSetting[]>(initialSettings.serviceCharges);
  const [defaultFurniture, setDefaultFurniture] = useState<string[]>(initialSettings.defaultFurniture);
  const [furnitureOptions, setFurnitureOptions] = useState<string[]>(initialSettings.furnitureOptions);
  const [newFurniture, setNewFurniture] = useState("");
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “[configured Floors, set Configured Floors]” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - a: ค่า “a” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - b: ค่า “b” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
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
  const [profileName, setProfileName] = useState(accountName);
  const [profileState, setProfileState] = useState<{ message: string; tone: "error" | "success" } | null>(null);
  const [passwordState, setPasswordState] = useState<{ message: string; tone: "error" | "success" } | null>(null);
  const [passwords, setPasswords] = useState({ confirmPassword: "", currentPassword: "", newPassword: "" });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [isPasswordEditorOpen, setIsPasswordEditorOpen] = useState(false);
  const [saveState, setSaveState] = useState<{ message: string; tone: "error" | "success" } | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const notify = useToast();
  const { confirm, confirmationDialog } = useConfirmation();
  const currentSettingsSnapshot = JSON.stringify({
    settings, roomTypes, serviceCharges, defaultFurniture, furnitureOptions,
  });
  const [savedSettingsSnapshot, setSavedSettingsSnapshot] = useState(currentSettingsSnapshot);
  useUnsavedChanges(currentSettingsSnapshot !== savedSettingsSnapshot);
  const floors = configuredFloors;

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “add Floor” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const addFloor = async () => {
    const floor = Number(newFloor);
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “add Room” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
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
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “target Floor” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “remove Room” ตามกฎของระบบ
   * รับค่า:
   * - room: ค่า “room” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “add Furniture” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “remove Furniture” ตามกฎของระบบ
   * รับค่า:
   * - name: ค่า “name” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “remove Floor” ตามกฎของระบบ
   * รับค่า:
   * - floor: ค่า “floor” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “remove Room Type” ตามกฎของระบบ
   * รับค่า:
   * - id: ค่า “id” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const removeRoomType = async (id: string) => {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “room Type” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “add Room Type” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “save Property Settings” โดยใช้ค่าที่รับเข้ามา
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const savePropertySettings = async () => {
    setIsSavingSettings(true);
    setSaveState(null);
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/settings`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          legalName: settings.businessName.trim() || null,
          lessorName: null,
          address: settings.propertyAddress.trim(),
          contactPhone: settings.contactPhone.trim(),
          contactEmail: settings.contactEmail.trim() || null,
          promptPayId: settings.promptPay.trim() || null,
          waterUnitRate: Number(settings.waterExtraRate) || 0,
          electricityUnitRate: Number(settings.electricityUnitRate) || 0,
          billingDay: Math.min(28, Math.max(1, Number(settings.meterReadDay) || 1)),
          dueDay: Math.min(31, Math.max(1, Number(settings.dueDay) || 5)),
          lateFeePerDay: Number(settings.lateFee) || 0,
          lateFeeCap: null,
          invoicePrefix: settings.invoicePrefix.trim() || "INV",
          invoiceFooter: settings.paymentNote.trim() || null,
        }),
      });
      const result = await response.json() as { error?: string; requestId?: string };
      if (!response.ok) throw createApiError(result, "บันทึกการตั้งค่าไม่สำเร็จ");
      const catalogResponse = await fetch(`/api/v1/admin/properties/${propertyId}/catalogs`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomTypes: roomTypes.map(({ name, rent, deposit, capacity }) => ({ name, rent, deposit, capacity })),
          serviceCharges: serviceCharges.map(({ name, amount, frequency, calculation }) => ({ name, amount, frequency, calculation })),
          furnitureOptions: furnitureOptions.map((name) => ({ name, isDefault: defaultFurniture.includes(name) })),
        }),
      });
      if (!catalogResponse.ok) {
        const result = await catalogResponse.json() as { error?: string; requestId?: string };
        throw createApiError(result, "บันทึกรายการตั้งค่าไม่สำเร็จ");
      }
      await onDataChanged();
      setSavedSettingsSnapshot(currentSettingsSnapshot);
      setSaveState({ message: "บันทึกการตั้งค่าหอพักแล้ว", tone: "success" });
      notify({ message: "บันทึกการตั้งค่าหอพักแล้ว" });
    } catch (error) {
      const message = formatClientError(error, "บันทึกการตั้งค่าไม่สำเร็จ");
      setSaveState({ message, tone: "error" });
      notify({ message, tone: "error" });
    } finally {
      setIsSavingSettings(false);
    }
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Setting” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - key: ค่า “key” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const updateSetting = (key: keyof typeof settings, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “save Profile” โดยใช้ค่าที่รับเข้ามา
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const saveProfile = async () => {
    const displayName = profileName.trim();
    if (displayName.length < 2) {
      setProfileState({ message: "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร", tone: "error" });
      return;
    }
    setIsSavingProfile(true);
    setProfileState(null);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const result = await response.json() as { error?: string; user?: { displayName: string } };
      if (!response.ok || !result.user) throw new Error(result.error ?? "บันทึกโปรไฟล์ไม่สำเร็จ");
      setProfileName(result.user.displayName);
      onAccountNameChange(result.user.displayName);
      setProfileState({ message: "บันทึกข้อมูลโปรไฟล์แล้ว", tone: "success" });
      setIsProfileEditorOpen(false);
    } catch (error) {
      setProfileState({ message: error instanceof Error ? error.message : "บันทึกโปรไฟล์ไม่สำเร็จ", tone: "error" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “change Password” โดยใช้ค่าที่รับเข้ามา
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const changePassword = async () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordState({ message: "รหัสผ่านใหม่และการยืนยันไม่ตรงกัน", tone: "error" });
      return;
    }
    setIsSavingPassword(true);
    setPasswordState(null);
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }),
      });
      const result = await response.json() as { error?: string; redirectTo?: string };
      if (!response.ok) throw new Error(result.error ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      setPasswordState({ message: "เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่", tone: "success" });
      window.location.assign(result.redirectTo ?? "/login");
    } catch (error) {
      setPasswordState({ message: error instanceof Error ? error.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ", tone: "error" });
      setIsSavingPassword(false);
    }
  };

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  return (
    <section className={activeSection === "account" ? "account-page" : "settings-page"}>
      <LiveAnnouncement message={`เปิดแท็บ ${settingSections.find(({ key }) => key === activeSection)?.label ?? "ตั้งค่า"}`} />
      {activeSection !== "account" ? <aside className="settings-nav">
        <div aria-label="เมนูตั้งค่า" aria-orientation="vertical" className="settings-nav-group" onKeyDown={handleSettingsKeyDown} role="tablist">
          <p>ระบบหอพัก</p>
          {systemSettingSections.map(({ key, label, icon: Icon }) => (
            <button aria-controls="settings-active-panel" aria-selected={activeSection === key} className={activeSection === key ? "active" : ""} id={`settings-tab-${key}`} key={key} onClick={() => setActiveSection(key)} role="tab" tabIndex={activeSection === key ? 0 : -1} type="button">
              <Icon aria-hidden={true} size={18} />
              {label}
            </button>
          ))}
        </div>
      </aside> : null}

      <fieldset aria-labelledby={activeSection === "account" ? undefined : `settings-tab-${activeSection}`} className="settings-content view-transition min-w-0 border-0 p-0" disabled={readOnly && !["account", "documents", "invitations", "subscription"].includes(activeSection)} id={activeSection === "account" ? undefined : "settings-active-panel"} key={activeSection} role={activeSection === "account" ? undefined : "tabpanel"} tabIndex={activeSection === "account" ? undefined : 0}>
        {readOnly && !["account", "invitations", "subscription"].includes(activeSection) ? <ReadOnlyNotice>ตรวจสอบค่าปัจจุบันและดูตัวอย่างเอกสารได้ แต่ไม่สามารถแก้ไขหรือบันทึกการตั้งค่าหอได้</ReadOnlyNotice> : null}
        {activeSection !== "account" ? <div className="settings-heading">
          <h2>{settingSections.find((section) => section.key === activeSection)?.label}</h2>
          <p>ตั้งค่าข้อมูลที่ใช้กับห้องพัก รอบบิล มิเตอร์ เอกสาร และการคำนวณค่าใช้จ่ายของหอ</p>
          {saveState ? <p className={`account-settings-message ${saveState.tone}`}>{saveState.message}</p> : null}
        </div> : null}

        {activeSection === "general" ? (
          <SettingsCard isSaving={isSavingSettings} onSave={() => void savePropertySettings()} title="ข้อมูลหอพัก" description="ข้อมูลนี้ใช้แสดงในระบบ เอกสาร สัญญา และใบแจ้งหนี้">
            <div className="settings-form-grid">
              <TextField label="ชื่อเจ้าของหอ/นิติบุคคล" value={settings.businessName} onChange={(value) => updateSetting("businessName", value)} />
              <TextField label="เบอร์ติดต่อ" value={settings.contactPhone} onChange={(value) => updateSetting("contactPhone", value)} />
              <TextField label="อีเมลติดต่อ" value={settings.contactEmail} onChange={(value) => updateSetting("contactEmail", value)} />
              <TextAreaField label="ที่อยู่สำหรับเอกสาร" value={settings.propertyAddress} onChange={(value) => updateSetting("propertyAddress", value)} />
            </div>
          </SettingsCard>
        ) : null}

        {activeSection === "billing" ? (
          <>
            <SettingsCard isSaving={isSavingSettings} onSave={() => void savePropertySettings()} title="ประเภทห้อง ค่าเช่า และเงินประกัน" description="สร้างประเภทห้องของหอเองได้ โดยไม่จำกัดเฉพาะห้องพัดลมหรือห้องแอร์">
              <div className="settings-inline-editor">
                <TextField label="ชื่อประเภทห้อง" value={newRoomType.name} onChange={(value) => setNewRoomType((current) => ({ ...current, name: value }))} />
                <TextField label="ค่าเช่า" suffix="บาท/เดือน" type="number" value={newRoomType.rent} onChange={(value) => setNewRoomType((current) => ({ ...current, rent: value }))} />
                <TextField label="เงินประกัน" suffix="บาท" type="number" value={newRoomType.deposit} onChange={(value) => setNewRoomType((current) => ({ ...current, deposit: value }))} />
                <TextField label="ผู้พักสูงสุด" suffix="คน" type="number" value={newRoomType.capacity} onChange={(value) => setNewRoomType((current) => ({ ...current, capacity: value }))} />
                <button className="primary-button" onClick={addRoomType} type="button">{editingRoomTypeId ? "บันทึกการแก้ไข" : "เพิ่มประเภทห้อง"}</button>
              </div>
              <EditableList
                emptyText="ยังไม่มีประเภทห้อง"
                items={roomTypes.map((item) => ({ id: item.id, title: item.name, detail: `${item.rent.toLocaleString("th-TH")} บาท/เดือน · ประกัน ${item.deposit.toLocaleString("th-TH")} บาท · สูงสุด ${item.capacity} คน` }))}
                onEdit={(id) => {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “item” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - type: ค่า “type” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const item = roomTypes.find((type) => type.id === id);
                  if (!item) return;
                  setEditingRoomTypeId(id);
                  setNewRoomType({ name: item.name, rent: String(item.rent), deposit: String(item.deposit), capacity: String(item.capacity) });
                }}
                onRemove={(id) => void removeRoomType(id)}
              />
            </SettingsCard>

            <SettingsCard isSaving={isSavingSettings} onSave={() => void savePropertySettings()} title="ค่าน้ำและค่าไฟ" description="รุ่นนี้คิดตามหน่วยมิเตอร์ด้วยอัตราเดียวของหอ กำหนดเป็น 0 เมื่อต้องการไม่คิดรายการนั้น">
              <div className="settings-form-grid three">
                <TextField label="ค่าน้ำ" suffix="บาท/หน่วย" type="number" value={settings.waterExtraRate} onChange={(value) => updateSetting("waterExtraRate", value)} />
                <TextField label="ค่าไฟ" suffix="บาท/หน่วย" type="number" value={settings.electricityUnitRate} onChange={(value) => updateSetting("electricityUnitRate", value)} />
              </div>
            </SettingsCard>
          </>
        ) : null}

        {activeSection === "cycles" ? (
          <SettingsCard isSaving={isSavingSettings} onSave={() => void savePropertySettings()} title="รอบบิลและวันชำระ" description="ช่วยให้เจ้าของหอรู้ว่าควรจดมิเตอร์และติดตามยอดค้างช่วงไหน">
            <div className="settings-form-grid three">
              <TextField label="วันจดมิเตอร์" suffix="ของเดือน" type="number" value={settings.meterReadDay} onChange={(value) => updateSetting("meterReadDay", value)} />
              <TextField label="วันครบกำหนดชำระ" suffix="ของเดือนถัดไป" type="number" value={settings.dueDay} onChange={(value) => updateSetting("dueDay", value)} />
              <TextField label="ค่าปรับชำระล่าช้า" suffix="บาท" type="number" value={settings.lateFee} onChange={(value) => updateSetting("lateFee", value)} />
              <TextField label="เลขพร้อมเพย์รับเงิน" value={settings.promptPay} onChange={(value) => updateSetting("promptPay", value)} />
              <TextAreaField label="ข้อความท้ายบิล" value={settings.paymentNote} onChange={(value) => updateSetting("paymentNote", value)} />
            </div>
          </SettingsCard>
        ) : null}

        {activeSection === "rooms" ? (
          <>
            <SettingsCard isSaving={isSavingSettings} onSave={() => void savePropertySettings()} title="ชั้นและห้องพัก" description="เพิ่มชั้น เพิ่มห้อง และจัดการโครงสร้างที่แสดงในผังห้อง">
              <div className="settings-room-actions">
                <div>
                  <label><span>เพิ่มชั้นใหม่</span><input min={1} max={99} onChange={(event) => setNewFloor(event.target.value)} placeholder="เช่น 6" type="number" value={newFloor} /></label>
                  <button className="primary-button" onClick={addFloor} type="button">เพิ่มชั้น</button>
                </div>
                <div>
                  <DropdownField label="ชั้น" onChange={setNewRoomFloor} options={floors.map((floor) => ({ value: String(floor), label: `ชั้น ${floor}` }))} value={newRoomFloor || String(floors[0] ?? "")} />
                  <DropdownField label="ประเภทห้อง" onChange={setNewRoomTypeId} options={roomTypes.map((type) => ({ value: type.id, label: type.name }))} value={newRoomTypeId || roomTypes[0]?.id || ""} />
                  <label><span>เลขห้องใหม่</span><input maxLength={30} onChange={(event) => setNewRoomNumber(event.target.value)} placeholder="เช่น 601" value={newRoomNumber} /></label>
                  <button className="primary-button" onClick={addRoom} type="button">เพิ่มห้อง</button>
                </div>
              </div>
              {roomManagementError ? <p className="form-hint error" role="alert">{roomManagementError}</p> : null}
              <div className="settings-floor-list">
                {floors.map((floor) => (
                  <section key={floor}>
                    <header><strong>ชั้น {floor}</strong><span>{rooms.filter((room) => room.floor === floor).length} ห้อง <button aria-describedby={rooms.some((room) => room.floor === floor) ? `floor-${floor}-delete-disabled-reason` : undefined} disabled={rooms.some((room) => room.floor === floor)} onClick={() => void removeFloor(floor)} type="button">ลบชั้น</button>{rooms.some((room) => room.floor === floor) ? <small className="disabled-reason" id={`floor-${floor}-delete-disabled-reason`}>ย้ายหรือลบห้องในชั้นนี้ก่อน</small> : null}</span></header>
                    <div>{rooms.filter((room) => room.floor === floor).map((room) => (
                      <article key={room.id}><span><strong>ห้อง {room.id}</strong><small>{room.status === "available" ? "ว่าง" : room.status === "occupied" ? "มีผู้เช่า" : "ซ่อมบำรุง"}</small>{room.status !== "available" ? <small className="disabled-reason" id={`room-${room.databaseId ?? room.id}-delete-disabled-reason`}>{room.status === "occupied" ? "ย้ายผู้เช่าออกก่อนจึงจะลบห้องได้" : "เปลี่ยนห้องเป็นสถานะว่างก่อนจึงจะลบได้"}</small> : null}</span><button aria-describedby={room.status !== "available" ? `room-${room.databaseId ?? room.id}-delete-disabled-reason` : undefined} disabled={room.status !== "available"} onClick={() => removeRoom(room)} type="button">ลบ</button></article>
                    ))}</div>
                  </section>
                ))}
              </div>
            </SettingsCard>
          </>
        ) : null}

        {activeSection === "assets" ? (
          <>
            <SettingsCard isSaving={isSavingSettings} onSave={() => void savePropertySettings()} title="เฟอร์นิเจอร์และอุปกรณ์" description="สร้างรายการทรัพย์สินและเลือกชุดเริ่มต้นสำหรับห้องใหม่">
              <div className="settings-add-furniture">
                <label><span>เพิ่มเฟอร์นิเจอร์หรืออุปกรณ์</span><input maxLength={80} onChange={(event) => setNewFurniture(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addFurniture(); } }} placeholder="เช่น ชั้นวางรองเท้า" value={newFurniture} /></label>
                <button className="primary-button" onClick={addFurniture} type="button">เพิ่มรายการ</button>
              </div>
              <div className="settings-furniture-grid">
                {furnitureOptions.map((item) => {
                  const selected = defaultFurniture.includes(item);
                  return <div className={selected ? "selected" : ""} key={item}>
                    <label><input checked={selected} onChange={() => setDefaultFurniture((current) => selected ? current.filter((value) => value !== item) : [...current, item])} type="checkbox" /><span>{item}</span></label>
                    <button aria-label={`ลบ ${item}`} onClick={() => void removeFurniture(item)} type="button">ลบ</button>
                  </div>;
                })}
              </div>
              {furnitureOptions.length === 0 ? <p className="settings-empty-list">ยังไม่มีรายการเฟอร์นิเจอร์ กรอกชื่อด้านบนเพื่อเพิ่มรายการใหม่</p> : null}
            </SettingsCard>
          </>
        ) : null}

        {activeSection === "documents" ? (
          <>
            <fieldset className="min-w-0 border-0 p-0" disabled={readOnly}>
              <SettingsCard isSaving={isSavingSettings} onSave={() => void savePropertySettings()} title="เอกสารและเลขที่อ้างอิง" description="ใช้กำหนดรูปแบบเลขเอกสารและข้อมูลที่พิมพ์ลงสัญญา/ใบแจ้งหนี้">
                <div className="settings-form-grid three">
                  <TextField label="คำนำหน้าเลขบิล" value={settings.invoicePrefix} onChange={(value) => updateSetting("invoicePrefix", value)} />
                </div>
              </SettingsCard>
            </fieldset>
            <DocumentTemplatePanel editable={!readOnly} kind="contract" propertyId={propertyId} />
            <DocumentTemplatePanel editable={!readOnly} kind="invoice" propertyId={propertyId} />
          </>
        ) : null}

        {activeSection === "invitations" ? <InvitationsPage propertyId={propertyId} readOnly={readOnly} /> : null}

        {activeSection === "subscription" ? <SubscriptionPage propertyId={propertyId} subscription={subscription} /> : null}

        {activeSection === "account" ? (
          <div className="account-content">
            <section className="account-content-section">
              <h2>ข้อมูลบัญชี</h2>
              <div className="account-detail-row">
                <strong>ชื่อที่แสดง</strong>
                <span>{profileName}</span>
                <button onClick={() => { setProfileState(null); setIsProfileEditorOpen(true); }} type="button">แก้ไข</button>
              </div>
              <div className="account-detail-row">
                <strong>อีเมล</strong>
                <span>{accountEmail}</span>
                <small>จัดการโดยแอดมินใหญ่</small>
              </div>
              {profileState ? <p className={`account-settings-message ${profileState.tone}`} role={profileState.tone === "error" ? "alert" : "status"}>{profileState.message}</p> : null}
            </section>

            <section className="account-content-section">
              <h2>รหัสผ่านและความปลอดภัย</h2>
              <div className="account-detail-row">
                <strong>รหัสผ่าน</strong>
                <span>••••••••••••</span>
                <button onClick={() => { setPasswordState(null); setIsPasswordEditorOpen(true); }} type="button">แก้ไข</button>
              </div>
            </section>

            <section className="account-content-section">
              <h2>สถานะบัญชี</h2>
              <div className="account-standing-row">
                <span><CheckCircle2 size={22} /></span>
                <div><strong>บัญชีของคุณพร้อมใช้งาน</strong><p>บัญชีเปิดใช้งานตามปกติและยังไม่พบปัญหาด้านความปลอดภัย</p></div>
                <ChevronRight size={20} />
              </div>
            </section>

            <PrivacyPreferencesPanel />

            {isProfileEditorOpen ? (
              <Dialog ariaDescribedBy="profile-editor-description" ariaLabelledBy="profile-editor-title" className="confirmation-modal" onClose={() => setIsProfileEditorOpen(false)}>
                <form className="modal-form" onSubmit={(event) => { event.preventDefault(); void saveProfile(); }}>
                  <header className="modal-header"><div><h2 id="profile-editor-title">แก้ไขชื่อโปรไฟล์</h2><p id="profile-editor-description">ชื่อนี้จะแสดงในระบบและข้อความถึงผู้เช่า</p></div><IconButton label="ปิด" onClick={() => setIsProfileEditorOpen(false)} tooltip="ปิดหน้าต่างแก้ไขชื่อโปรไฟล์"><X /></IconButton></header>
                  <TextField label="ชื่อที่แสดง" value={profileName} onChange={(value) => { setProfileName(value); setProfileState(null); }} />
                  {profileState ? <p className={`account-settings-message ${profileState.tone}`} role={profileState.tone === "error" ? "alert" : "status"}>{profileState.message}</p> : null}
                  <footer className="modal-actions"><button onClick={() => setIsProfileEditorOpen(false)} type="button">ยกเลิก</button><button disabled={isSavingProfile} type="submit">{isSavingProfile ? "กำลังบันทึก..." : "บันทึก"}</button></footer>
                </form>
              </Dialog>
            ) : null}

            {isPasswordEditorOpen ? (
              <Dialog ariaDescribedBy="password-editor-description" ariaLabelledBy="password-editor-title" onClose={() => setIsPasswordEditorOpen(false)}>
                <form className="modal-form" onSubmit={(event) => { event.preventDefault(); void changePassword(); }}>
                  <header className="modal-header"><div><h2 id="password-editor-title">เปลี่ยนรหัสผ่าน</h2><p id="password-editor-description">หลังเปลี่ยนแล้วระบบจะออกจากทุกอุปกรณ์</p></div><IconButton label="ปิด" onClick={() => setIsPasswordEditorOpen(false)} tooltip="ปิดหน้าต่างเปลี่ยนรหัสผ่าน"><X /></IconButton></header>
                  <div className="account-password-fields">
                    <PasswordField label="รหัสผ่านปัจจุบัน" onChange={(value) => setPasswords((current) => ({ ...current, currentPassword: value }))} value={passwords.currentPassword} />
                    <PasswordField label="รหัสผ่านใหม่" onChange={(value) => setPasswords((current) => ({ ...current, newPassword: value }))} value={passwords.newPassword} />
                    <PasswordField label="ยืนยันรหัสผ่านใหม่" onChange={(value) => setPasswords((current) => ({ ...current, confirmPassword: value }))} value={passwords.confirmPassword} />
                  </div>
                  <p className="account-password-hint"><LockKeyhole size={17} /> อย่างน้อย 12 ตัวอักษร พร้อมตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข</p>
                  {passwordState ? <p className={`account-settings-message ${passwordState.tone}`} role={passwordState.tone === "error" ? "alert" : "status"}>{passwordState.message}</p> : null}
                  <footer className="modal-actions"><button onClick={() => setIsPasswordEditorOpen(false)} type="button">ยกเลิก</button><button disabled={isSavingPassword} type="submit">{isSavingPassword ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}</button></footer>
                </form>
              </Dialog>
            ) : null}
          </div>
        ) : null}
      </fieldset>
      {confirmationDialog}
    </section>
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Settings Card” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { actions, children, description, isSaving = false, onSave, : ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function SettingsCard({
  actions,
  children,
  description,
  isSaving = false,
  onSave,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  description: string;
  isSaving?: boolean;
  onSave?: () => void;
  title: string;
}) {
  return (
    <article className="settings-card settings-section">
      <div className="settings-card-body">
        <div className="settings-card-head">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {children}
      </div>
      <div className="settings-card-actions">
        {actions ?? <button className="settings-update-button" disabled={isSaving} onClick={onSave} type="button">{isSaving ? "กำลังบันทึก..." : "บันทึก"}</button>}
      </div>
    </article>
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Password Field” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { label, onChange, value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function PasswordField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      <input autoComplete={label === "รหัสผ่านปัจจุบัน" ? "current-password" : "new-password"} maxLength={128} minLength={12} onChange={(event) => onChange(event.target.value)} type="password" value={value} />
    </label>
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Text Field” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { label, onChange, suffix, type = "text", value, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function TextField({
  label,
  onChange,
  suffix,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  suffix?: string;
  type?: "number" | "text";
  value: string;
}) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      <div className="settings-input-wrap">
        <input onChange={(event) => onChange(event.target.value)} type={type} value={value} />
        {suffix ? <em>{suffix}</em> : null}
      </div>
    </label>
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Text Area Field” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { label, onChange, value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function TextAreaField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="settings-field full">
      <span>{label}</span>
      <textarea onChange={(event) => onChange(event.target.value)} rows={3} value={value} />
    </label>
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Editable List” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { emptyText, items, onEdit, onRemove, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function EditableList({
  emptyText,
  items,
  onEdit,
  onRemove,
}: {
  emptyText: string;
  items: Array<{ detail: string; id: string; title: string }>;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return <p className="settings-empty-list">{emptyText}</p>;
  return (
    <div className="settings-editable-list">
      {items.map((item) => (
        <article key={item.id}>
          <span><strong>{item.title}</strong><small>{item.detail}</small></span>
          <div><button onClick={() => onEdit(item.id)} type="button">แก้ไข</button><button className="danger" onClick={() => onRemove(item.id)} type="button">ลบ</button></div>
        </article>
      ))}
    </div>
  );
}
