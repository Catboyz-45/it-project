"use client";
// เก็บค่าที่กรอกในฟอร์มทั้งหมดไว้ฝั่งเบราว์เซอร์ก่อนกดบันทึก

import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { ArrowLeft, Banknote, Building2, CalendarDays, CreditCard, FileText, Home, MailPlus, Package, UserRound } from "lucide-react";
import Link from "next/link";
import { ownerPagePath } from "@/lib/navigation-routes";
import { DropdownField } from "@/components/dorm/DropdownField";
import { DocumentTemplatePanel } from "@/components/dorm/DocumentTemplatePanel";
import { InvitationsPage } from "@/components/dorm/InvitationsPage";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { useTablistKeyboard } from "@/components/ui/use-tablist-keyboard";
import { SubscriptionPage } from "@/components/dorm/SubscriptionPage";
import { useToast } from "@/components/ui/ToastProvider";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { formatClientError } from "@/lib/client/api-error";
import { saveCatalogsRequest, type SettingsDraft, savePropertySettingsRequest } from "@/components/dorm/pages/settings-requests";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";
import type { Room } from "@/types/dorm";
import type {
  OwnerDashboardAggregation,
  PropertySettingsReadModel,
} from "@/types/dashboard";
import { EditableList, SettingsCard, TextAreaField, TextField } from "@/components/dorm/pages/settings-fields";
import { AccountSettingsSection } from "@/components/dorm/pages/AccountSettingsSection";
import { usePropertyStructureDraft } from "@/components/dorm/pages/usePropertyStructureDraft";

// เก้าหมวดของหน้าตั้งค่า แปดหมวดแรกเป็นของหอพัก ส่วน account เป็นของบัญชีผู้ใช้
// propertyName แสดงอย่างเดียว ไม่ได้ส่งขึ้นเซิร์ฟเวอร์ จึงไม่อยู่ใน SettingsDraft
type SettingsForm = SettingsDraft & { propertyName: string };

type SettingsSection = "general" | "billing" | "cycles" | "rooms" | "assets" | "documents" | "invitations" | "subscription" | "account";

// เก็บเป็นข้อมูล จะได้วนสร้างเมนูได้เลย และเพิ่มหมวดใหม่โดยไม่ต้องแก้ JSX
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
// แยก account ออก เพราะเป็นเรื่องของบัญชีผู้ใช้ ไม่ใช่การตั้งค่าหอ และมีหน้าตาคนละแบบ
const systemSettingSections = settingSections.filter((section) => section.key !== "account");
// เมนูตั้งค่าเป็น tablist ต้องเลื่อนด้วยลูกศรได้ตามมาตรฐาน ARIA จึงต้องมีรายการคีย์ตามลำดับ
const systemSettingSectionKeys = systemSettingSections.map(({ key }) => key);

// หน้าตั้งค่าของหอพัก เมนูซ้ายกับเนื้อหาขวา บนมือถือสลับกันทีละอย่าง
export function SettingsPage({
  accountEmail,
  accountName,
  initialInvitations = null,
  initialSubscriptionData = null,
  initialSection,
  initialSettings,
  onAccountNameChange,
  onDataChanged,
  propertyId,
  readOnly = false,
  rooms,
  subscription,
}: Readonly<{
  accountEmail: string;
  accountName: string;
  // ส่งต่อให้หัวข้อคำเชิญ ซึ่ง Server Component ของหน้าดึงมาให้แล้ว
  initialInvitations?: Exclude<Parameters<typeof InvitationsPage>[0]["initialData"], undefined>;
  // ส่งต่อให้หัวข้อแพ็กเกจ
  initialSubscriptionData?: Exclude<Parameters<typeof SubscriptionPage>[0]["initialData"], undefined>;
  initialSection: "account" | "general" | "invitations" | "subscription";
  initialSettings: PropertySettingsReadModel;
  onAccountNameChange: (name: string) => void;
  onDataChanged: () => Promise<void>;
  propertyId: string;
  readOnly?: boolean;
  rooms: Room[];
  subscription: OwnerDashboardAggregation["subscription"];
}>) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  // จอแคบวางสองคอลัมน์ไม่ไหว จึงสลับทีละอย่างแทนการวางเมนูกองทับเนื้อหา
  // เข้ามาแบบลิงก์ตรง เช่น /subscription ให้ไปที่เนื้อหาเลย ไม่ต้องผ่านรายการ
  const [mobileView, setMobileView] = useState<"list" | "section">(initialSection === "general" ? "list" : "section");
  const handleSettingsKeyDown = useTablistKeyboard(systemSettingSectionKeys, setActiveSection);
  // เก็บทุกค่าเป็นสตริง เพราะมาจากช่องกรอก ค่อยแปลงเป็นตัวเลขตอนส่งขึ้นเซิร์ฟเวอร์
  const [settings, setSettings] = useState<SettingsForm>({
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
  const [saveState, setSaveState] = useState<{ message: string; tone: "error" | "success" } | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const notify = useToast();
  const { confirm, confirmationDialog } = useConfirmation();
  // โครงสร้างหอทั้งหมด ชั้น ห้อง ประเภทห้อง และเฟอร์นิเจอร์ อยู่ในฮุกของตัวเอง
  const structure = usePropertyStructureDraft({ confirm, initialSettings, onDataChanged, propertyId, rooms });
  // โครงหน้าต้องใช้แค่สี่ค่านี้ไปเทียบร่างที่ยังไม่ได้บันทึก ที่เหลือแต่ละหมวดหยิบเอง
  const { defaultFurniture, furnitureOptions, roomTypes, serviceCharges } = structure;

  // เทียบภาพปัจจุบันกับภาพที่บันทึกไว้ล่าสุด จะได้รู้ว่ายังมีอะไรค้างไม่ได้บันทึก
  const currentSettingsSnapshot = JSON.stringify({
    settings, roomTypes, serviceCharges, defaultFurniture, furnitureOptions,
  });
  const [savedSettingsSnapshot, setSavedSettingsSnapshot] = useState(currentSettingsSnapshot);
  // เตือนตอนผู้ใช้กดปิดแท็บหรือกดย้อนกลับทั้งที่ยังไม่ได้บันทึก
  useUnsavedChanges(currentSettingsSnapshot !== savedSettingsSnapshot);

  // บันทึกการตั้งค่าของหอทั้งหมดในครั้งเดียว ไม่ได้บันทึกทีละหมวด
  const savePropertySettings = async () => {
    setIsSavingSettings(true);
    setSaveState(null);
    try {
      await savePropertySettingsRequest(propertyId, settings);
      await saveCatalogsRequest(propertyId, { defaultFurniture, furnitureOptions, roomTypes, serviceCharges });
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

  // ตัวช่วยแก้ทีละช่อง keyof บังคับให้ชื่อฟิลด์ต้องมีอยู่จริงตั้งแต่ตอนคอมไพล์
  const updateSetting = (key: keyof typeof settings, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };


  // ตามการเปลี่ยน URL ด้วย เพราะหน้าตั้งค่าแต่ละหมวดมีที่อยู่ของตัวเอง
  useEffect(() => {
    setActiveSection(initialSection);
    setMobileView(initialSection === "general" ? "list" : "section");
  }, [initialSection]);

  return (
    <section className={activeSection === "account" ? "account-page" : "settings-page"} data-mobile-view={mobileView}>
      {/* บอกโปรแกรมอ่านหน้าจอว่าเปลี่ยนหมวดแล้ว เพราะเนื้อหาเปลี่ยนโดยหน้าไม่ได้โหลดใหม่ */}
      <LiveAnnouncement message={`เปิดแท็บ ${settingSections.find(({ key }) => key === activeSection)?.label ?? "ตั้งค่า"}`} />
      {activeSection !== "account" ? <aside className="settings-nav">
        <Link className="settings-back" href={ownerPagePath(propertyId, "overview")}>
          <ArrowLeft aria-hidden={true} size={16} /> กลับหน้าหลัก
        </Link>
        <div aria-label="เมนูตั้งค่า" aria-orientation="vertical" className="settings-nav-group" onKeyDown={handleSettingsKeyDown} role="tablist">
          <p>ระบบหอพัก</p>
          {systemSettingSections.map(({ key, label, icon: Icon }) => (
            <button aria-controls="settings-active-panel" aria-selected={activeSection === key} className={activeSection === key ? "active" : ""} id={`settings-tab-${key}`} key={key} onClick={() => { setActiveSection(key); setMobileView("section"); }} role="tab" tabIndex={activeSection === key ? 0 : -1} type="button">
              <Icon aria-hidden={true} size={18} />
              {label}
            </button>
          ))}
        </div>
      </aside> : null}

      {activeSection !== "account" ? <button className="settings-back-to-list" onClick={() => setMobileView("list")} type="button">
        <ArrowLeft aria-hidden={true} size={16} /> รายการตั้งค่าทั้งหมด
      </button> : null}
      <SettingsPanel activeSection={activeSection} key={activeSection} readOnly={readOnly}>
        {readOnly && !ownAccountSections.has(activeSection) ? <ReadOnlyNotice>ตรวจสอบค่าปัจจุบันและดูตัวอย่างเอกสารได้ แต่ไม่สามารถแก้ไขหรือบันทึกการตั้งค่าหอได้</ReadOnlyNotice> : null}
        {activeSection !== "account" ? <div className="settings-heading">
          <h2>{settingSections.find((section) => section.key === activeSection)?.label}</h2>
          <p>ตั้งค่าข้อมูลที่ใช้กับห้องพัก รอบบิล มิเตอร์ เอกสาร และการคำนวณค่าใช้จ่ายของหอ</p>
          {saveState ? <p className={`account-settings-message ${saveState.tone}`}>{saveState.message}</p> : null}
        </div> : null}

        <SettingsSectionBody
          accountEmail={accountEmail}
          accountName={accountName}
          activeSection={activeSection}
          initialInvitations={initialInvitations}
          initialSubscriptionData={initialSubscriptionData}
          isSavingSettings={isSavingSettings}
          onAccountNameChange={onAccountNameChange}
          propertyId={propertyId}
          readOnly={readOnly}
          rooms={rooms}
          savePropertySettings={savePropertySettings}
          settings={settings}
          structure={structure}
          subscription={subscription}
          updateSetting={updateSetting}
        />
      </SettingsPanel>
      {confirmationDialog}
    </section>
  );
}

// สถานะห้องในรายการโครงสร้าง ใช้คำสั้น ๆ เพราะพื้นที่แคบ
const roomStatusText: Record<Room["status"], string> = {
  available: "ว่าง",
  occupied: "มีผู้เช่า",
  maintenance: "ซ่อมบำรุง",
};

// เอกสารเป็นแค่การดูตัวอย่าง ส่วนคำเชิญ แพ็กเกจ และบัญชี ไม่ใช่การตั้งค่าหอ
// ทั้งหมดจึงยังใช้งานได้แม้หอจะอยู่ในโหมดอ่านอย่างเดียว
const editableWhileReadOnly = new Set<SettingsSection>(["account", "documents", "invitations", "subscription"]);
// สามหมวดนี้ไม่ต้องขึ้นป้ายบอกว่าอ่านอย่างเดียว เพราะไม่ได้แก้ข้อมูลของหอตั้งแต่แรก
const ownAccountSections = new Set<SettingsSection>(["account", "invitations", "subscription"]);

// กรอบของแผงเนื้อหา หมวดบัญชีไม่ใช่แท็บของหน้าตั้งค่าหอ จึงไม่ต้องมี attribute ของ tabpanel
// ห่อเป็นคอมโพเนนต์แทนการ spread attribute ลง fieldset ตรง ๆ เพราะ JSX ที่มีทั้ง spread
// และ key จะกลืน key เข้าไปใน props ทำให้แผงไม่ถูกสร้างใหม่ตอนสลับหมวด
function SettingsPanel({ activeSection, children, readOnly }: Readonly<{
  activeSection: SettingsSection;
  children: ReactNode;
  readOnly: boolean;
}>) {
  const className = "settings-content view-transition min-w-0 border-0 p-0";
  const disabled = readOnly && !editableWhileReadOnly.has(activeSection);
  if (activeSection === "account") return <fieldset className={className} disabled={disabled}>{children}</fieldset>;
  return <fieldset
    aria-labelledby={`settings-tab-${activeSection}`}
    className={className}
    disabled={disabled}
    id="settings-active-panel"
    role="tabpanel"
    tabIndex={0}
  >{children}</fieldset>;
}

type StructureDraft = ReturnType<typeof usePropertyStructureDraft>;

// หมวดห้องพัก จัดการชั้นและห้องในแต่ละชั้น
function RoomsSection({ isSaving, onSave, rooms, structure }: Readonly<{
  isSaving: boolean;
  onSave: () => Promise<void>;
  rooms: Room[];
  structure: StructureDraft;
}>) {
  const {
    addFloor, addRoom, configuredFloors: floors, newFloor, newRoomFloor, newRoomNumber,
    newRoomTypeId, removeFloor, removeRoom, roomManagementError, roomTypes,
    setNewFloor, setNewRoomFloor, setNewRoomNumber, setNewRoomTypeId,
  } = structure;
  const isSavingSettings = isSaving;
  const savePropertySettings = onSave;
  return <SettingsCard isSaving={isSavingSettings} onSave={() => void savePropertySettings()} title="ชั้นและห้องพัก" description="เพิ่มชั้น เพิ่มห้อง และจัดการโครงสร้างที่แสดงในผังห้อง">
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
                      <article key={room.id}><span><strong>ห้อง {room.id}</strong><small>{roomStatusText[room.status]}</small>{room.status !== "available" ? <small className="disabled-reason" id={`room-${room.databaseId ?? room.id}-delete-disabled-reason`}>{room.status === "occupied" ? "ย้ายผู้เช่าออกก่อนจึงจะลบห้องได้" : "เปลี่ยนห้องเป็นสถานะว่างก่อนจึงจะลบได้"}</small> : null}</span><button aria-describedby={room.status !== "available" ? `room-${room.databaseId ?? room.id}-delete-disabled-reason` : undefined} disabled={room.status !== "available"} onClick={() => removeRoom(room)} type="button">ลบ</button></article>
                    ))}</div>
                  </section>
                ))}
              </div>
            </SettingsCard>;
}

// หมวดเฟอร์นิเจอร์และอุปกรณ์ เลือกชุดเริ่มต้นที่จะติดไปกับห้องใหม่
function AssetsSection({ isSaving, onSave, structure }: Readonly<{
  isSaving: boolean;
  onSave: () => Promise<void>;
  structure: StructureDraft;
}>) {
  const { addFurniture, defaultFurniture, furnitureOptions, newFurniture, removeFurniture, setDefaultFurniture, setNewFurniture } = structure;
  const isSavingSettings = isSaving;
  const savePropertySettings = onSave;
  return <SettingsCard isSaving={isSavingSettings} onSave={() => void savePropertySettings()} title="เฟอร์นิเจอร์และอุปกรณ์" description="สร้างรายการทรัพย์สินและเลือกชุดเริ่มต้นสำหรับห้องใหม่">
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
            </SettingsCard>;
}

// เนื้อของหมวดที่เปิดอยู่ แยกออกจากโครงหน้าเพราะโครงหน้าไม่ควรต้องรู้จักทุกหมวด
function SettingsSectionBody({
  accountEmail,
  accountName,
  activeSection,
  initialInvitations,
  initialSubscriptionData,
  isSavingSettings,
  onAccountNameChange,
  propertyId,
  readOnly,
  rooms,
  savePropertySettings,
  settings,
  structure,
  subscription,
  updateSetting,
}: Readonly<{
  accountEmail: string;
  accountName: string;
  activeSection: SettingsSection;
  initialInvitations: Parameters<typeof InvitationsPage>[0]["initialData"];
  initialSubscriptionData: Parameters<typeof SubscriptionPage>[0]["initialData"];
  isSavingSettings: boolean;
  onAccountNameChange: (name: string) => void;
  propertyId: string;
  readOnly: boolean;
  rooms: Room[];
  savePropertySettings: () => Promise<void>;
  settings: SettingsForm;
  structure: StructureDraft;
  subscription: OwnerDashboardAggregation["subscription"];
  updateSetting: (key: keyof SettingsForm, value: string) => void;
}>) {
  const { addRoomType, editingRoomTypeId, newRoomType, removeRoomType, roomTypes, setEditingRoomTypeId, setNewRoomType } = structure;
  if (activeSection === "general") {
    return (
          <SettingsCard isSaving={isSavingSettings} onSave={() => void savePropertySettings()} title="ข้อมูลหอพัก" description="ข้อมูลนี้ใช้แสดงในระบบ เอกสาร สัญญา และใบแจ้งหนี้">
            <div className="settings-form-grid">
              <TextField label="ชื่อเจ้าของหอ/นิติบุคคล" value={settings.businessName} onChange={(value) => updateSetting("businessName", value)} />
              <TextField label="เบอร์ติดต่อ" value={settings.contactPhone} onChange={(value) => updateSetting("contactPhone", value)} />
              <TextField label="อีเมลติดต่อ" value={settings.contactEmail} onChange={(value) => updateSetting("contactEmail", value)} />
              <TextAreaField label="ที่อยู่สำหรับเอกสาร" value={settings.propertyAddress} onChange={(value) => updateSetting("propertyAddress", value)} />
            </div>
          </SettingsCard>
    );
  }

  if (activeSection === "billing") {
    return (
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
    );
  }

  if (activeSection === "cycles") {
    return (
          <SettingsCard isSaving={isSavingSettings} onSave={() => void savePropertySettings()} title="รอบบิลและวันชำระ" description="ช่วยให้เจ้าของหอรู้ว่าควรจดมิเตอร์และติดตามยอดค้างช่วงไหน">
            <div className="settings-form-grid three">
              <TextField label="วันจดมิเตอร์" suffix="ของเดือน" type="number" value={settings.meterReadDay} onChange={(value) => updateSetting("meterReadDay", value)} />
              <TextField label="วันครบกำหนดชำระ" suffix="ของเดือนถัดไป" type="number" value={settings.dueDay} onChange={(value) => updateSetting("dueDay", value)} />
              <TextField label="ค่าปรับชำระล่าช้า" suffix="บาท" type="number" value={settings.lateFee} onChange={(value) => updateSetting("lateFee", value)} />
              <TextField label="เลขพร้อมเพย์รับเงิน" value={settings.promptPay} onChange={(value) => updateSetting("promptPay", value)} />
              <TextAreaField label="ข้อความท้ายบิล" value={settings.paymentNote} onChange={(value) => updateSetting("paymentNote", value)} />
            </div>
          </SettingsCard>
    );
  }

  if (activeSection === "rooms") return <RoomsSection isSaving={isSavingSettings} onSave={savePropertySettings} rooms={rooms} structure={structure} />;

  if (activeSection === "assets") return <AssetsSection isSaving={isSavingSettings} onSave={savePropertySettings} structure={structure} />;

  if (activeSection === "documents") {
    return (
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
    );
  }

  if (activeSection === "invitations") return <InvitationsPage initialData={initialInvitations} propertyId={propertyId} readOnly={readOnly} />;

  if (activeSection === "subscription") return <SubscriptionPage initialData={initialSubscriptionData} propertyId={propertyId} subscription={subscription} />;

  if (activeSection === "account") return <AccountSettingsSection accountEmail={accountEmail} accountName={accountName} onAccountNameChange={onAccountNameChange} />;
  return null;
}
