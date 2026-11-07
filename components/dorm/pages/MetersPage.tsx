"use client";
// เก็บร่างที่ยังไม่บันทึกไว้ใน localStorage และจัดการโฟกัสของช่องกรอกเอง

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, LoaderCircle, Pencil, Save, Search, X } from "lucide-react";
import { ConfirmationDialog } from "@/components/dorm/ConfirmationDialog";
import { DropdownField } from "@/components/dorm/DropdownField";
import { TablePagination, useTablePagination } from "@/components/dorm/TablePagination";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { useToast } from "@/components/ui/ToastProvider";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";
import { currentThaiMonth, formatThaiMonth, thaiMonthOptions } from "@/lib/thai-format";
import { isMeterUsageWithinLimit, MAX_MONTHLY_METER_USAGE } from "@/lib/domain/billing";
import { type MeterDraftField, meterDraftProblem } from "@/lib/domain/meter-draft";
import { SummaryCard, SummaryCards } from "@/components/ui/SummaryCards";

// ห้องต่อหน้าของตาราง ใช้คำนวณว่าห้องที่ต้องตรวจอยู่หน้าไหน
const meterPageSize = 10;

// หนึ่งแถวของใบจดมิเตอร์ ห้องหนึ่งห้องในรอบเดือนหนึ่ง
type MeterWorksheetRow = {
  room: {
    id: string;
    number: string;
    building: { id: string; name: string; code: string };
    floor: { id: string; number: number; label: string | null };
  };
  tenantName: string | null;
  // มีค่าแล้วแปลว่าบันทึกไปแล้ว แถวนั้นจะถูกล็อกไม่ให้แก้ซ้ำ
  readingId: string | null;
  previousReading: string | null;
  currentReading: string | null;
  unitRate: string;
  recordedAt: string | null;
  // หน่วยที่ใช้ในรอบก่อน ใช้เทียบว่ารอบนี้พุ่งผิดปกติหรือเปล่า
  previousUsage: number | null;
};

type PageInfo = { hasNextPage: boolean };

type MeterReadingDraft = {
  roomId: string;
  type: "WATER" | "ELECTRICITY";
  billingMonth: string;
  previousReading?: number;
  currentReading: number;
};

// ใบจดมิเตอร์ กรอกทั้งหอแล้วบันทึกทีเดียว จึงต้องเก็บร่างไว้กันกรอกค้างแล้วหาย
// ร่างที่เก็บไว้ในเครื่อง ค่าที่เสียก็ลบทิ้ง ดีกว่าปล่อยให้พังทุกครั้งที่เปิดหน้า
function readSavedDraft(draftKey: string) {
  const saved = localStorage.getItem(draftKey);
  if (!saved) return { current: {} as Record<string, string>, previous: {} as Record<string, string> };
  try {
    const draft = JSON.parse(saved) as { current?: Record<string, string>; previous?: Record<string, string> };
    return { current: draft.current ?? {}, previous: draft.previous ?? {} };
  } catch {
    localStorage.removeItem(draftKey);
    return { current: {}, previous: {} };
  }
}

// โหลดทุกห้องมาให้ครบ ไม่แบ่งหน้าจากเซิร์ฟเวอร์ เพราะคนจดต้องกรอกทั้งหอในรอบเดียว
// วนขอทีละ 100 ห้องจนหมด เพราะ API จำกัดจำนวนต่อครั้ง
async function requestWorksheet({ billingMonth, mode, propertyId, signal }: {
  billingMonth: string;
  mode: "water" | "electric";
  propertyId: string;
  signal?: AbortSignal;
}) {
  const collected: MeterWorksheetRow[] = [];
  let page = 1;
  let hasNextPage = true;
  while (hasNextPage) {
    const params = new URLSearchParams({
      billingMonth,
      type: meterTypeOf(mode),
      page: String(page),
      pageSize: "100",
    });
    const response = await fetch(`/api/v1/admin/properties/${propertyId}/meter-readings/worksheet?${params}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal,
    });
    const payload = await response.json() as { data?: MeterWorksheetRow[]; error?: string; pageInfo?: PageInfo };
    if (!response.ok || !payload.data) throw new Error(payload.error || "โหลดข้อมูลมิเตอร์ไม่สำเร็จ");
    collected.push(...payload.data);
    hasNextPage = payload.pageInfo?.hasNextPage ?? false;
    page += 1;
  }
  return collected;
}

// คืนสำเนาที่ไม่มี key นั้น ใช้ล้างเลขที่กำลังแก้ของห้องที่บันทึกหรือยกเลิกแล้ว
function withoutKey(record: Record<string, string>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

function meterTypeOf(mode: "water" | "electric") {
  return mode === "water" ? "WATER" : "ELECTRICITY";
}

// ปัญหาของร่างห้องหนึ่ง ใช้ทั้งตอนตรวจก่อนบันทึกและตอนชี้ช่องที่ผิดในตาราง
function draftProblemOf(row: MeterWorksheetRow, currentDrafts: Record<string, string>, previousDrafts: Record<string, string>) {
  return meterDraftProblem(row.previousReading ?? previousDrafts[row.room.id] ?? "", currentDrafts[row.room.id] ?? "");
}

function toMeterReading({ billingMonth, currentDrafts, mode, previousDrafts, row }: {
  billingMonth: string;
  currentDrafts: Record<string, string>;
  mode: "water" | "electric";
  previousDrafts: Record<string, string>;
  row: MeterWorksheetRow;
}): MeterReadingDraft {
  const previousText = row.previousReading ?? previousDrafts[row.room.id] ?? "";
  const currentText = currentDrafts[row.room.id] ?? "";
  const previous = previousText.trim() === "" ? undefined : Number(previousText);
  const current = Number(currentText);
  const problem = meterDraftProblem(previousText, currentText);
  if (problem) throw new Error(`ห้อง ${row.room.number}: ${problem.message}`);
  return {
    roomId: row.room.id,
    type: meterTypeOf(mode),
    billingMonth,
    // ส่งเลขตั้งต้นไปเฉพาะห้องที่ยังไม่เคยมีในระบบ ห้องเดิมใช้เลขจากรอบก่อนที่เซิร์ฟเวอร์มีอยู่แล้ว
    ...(row.previousReading === null && previous !== undefined ? { previousReading: previous } : {}),
    currentReading: current,
  };
}

// รอบมิเตอร์อยู่บนสุดของหน้า เพราะเปลี่ยนทั้งการ์ดสรุปและตาราง ส่วนตัวกรองอื่นกรองแค่ตาราง จึงไปอยู่หัวตาราง
// ดรอปดาวน์ชื่อเดือนภาษาไทย แทนช่องเดือนของเบราว์เซอร์ที่ขึ้นภาษาอังกฤษและปี ค.ศ.
// เดือนล่าสุดคือเดือนปัจจุบัน เพราะยังจดมิเตอร์ของเดือนที่ยังไม่ถึงไม่ได้ ย้อนหลังได้สองปี
function MeterPeriodBar({ billingMonth, currentMonth, onBillingMonthChange }: Readonly<{
  billingMonth: string;
  currentMonth: string;
  onBillingMonthChange: (value: string) => void;
}>) {
  return <div className="meter-period-bar">
    <span aria-hidden="true">รอบมิเตอร์</span>
    <DropdownField ariaLabel="รอบมิเตอร์" onChange={onBillingMonthChange} options={thaiMonthOptions(currentMonth, 24, billingMonth)} value={billingMonth} />
  </div>;
}

// แถบค้นหาและกรองบนหัวตาราง กรองเฉพาะแถวในตาราง ไม่เปลี่ยนตัวเลขบนการ์ดสรุป
// เปลี่ยนอะไรก็กลับไปหน้าแรกของตารางเสมอ
function MeterTableToolbar({ building, buildings, floor, floors, onBuildingChange, onFloorChange, onQueryChange, query }: Readonly<{
  building: string;
  buildings: Array<[string, string]>;
  floor: string;
  floors: number[];
  onBuildingChange: (value: string) => void;
  onFloorChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  query: string;
}>) {
  return <div className="figma-table-toolbar">
    <div><Search size={16} /><input aria-label="ค้นหาห้องหรือผู้เช่า" onChange={(event) => onQueryChange(event.target.value)} placeholder="ค้นหาห้องหรือผู้เช่า..." value={query} /></div>
    <div className="contract-actions">
      <DropdownField
        ariaLabel="กรองอาคาร"
        // เปลี่ยนอาคารแล้วรีเซ็ตชั้นด้วย ไม่งั้นจะค้างชั้นของอาคารเดิมแล้วผลลัพธ์ว่าง
        onChange={onBuildingChange}
        options={[{ value: "all", label: "ทุกอาคาร" }, ...buildings.map(([value, label]) => ({ value, label }))]}
        value={building}
      />
      <DropdownField
        ariaLabel="กรองชั้น"
        onChange={onFloorChange}
        options={[{ value: "all", label: "ทุกชั้น" }, ...floors.map((item) => ({ value: String(item), label: `ชั้น ${item}` }))]}
        value={floor}
      />
    </div>
  </div>;
}

// แถบบันทึกลอยติดขอบล่าง โผล่เมื่อกรอกเลขไปแล้วอย่างน้อยหนึ่งห้อง แบบแถบ "ยังไม่บันทึก" ของ Discord
// อยู่ใกล้ตารางที่กำลังกรอกเสมอ หอใหญ่กรอกห้องสุดท้ายเสร็จก็กดบันทึกได้เลย ไม่ต้องเลื่อนกลับขึ้นไปหาปุ่มบนหัวหน้า
// ถ้ากดบันทึกแล้วติด ข้อความจะขึ้นในแถบนี้เลยพร้อมปุ่มพาไปช่องที่ต้องแก้ ไม่ไปโผล่เป็นกล่องใหญ่บนหัวตาราง
function MeterSaveBar({ error, isSaving, issue, onClear, onFixIssue, onReviewRoom, onSave, touchedCount, warningRooms }: Readonly<{
  error: string;
  isSaving: boolean;
  issue: string | null;
  onClear: () => void;
  onFixIssue: () => void;
  onReviewRoom: (roomId: string) => void;
  onSave: () => void;
  touchedCount: number;
  warningRooms: { id: string; number: string }[];
}>) {
  if (touchedCount === 0 && !isSaving) return null;
  const firstWarning = warningRooms[0];
  return <div aria-label="บันทึกมิเตอร์" className="meter-save-bar" data-state={issue || error ? "error" : undefined} role="region">
    <span aria-hidden="true" className="meter-save-bar-dot" />
    <div className="meter-save-bar-text">
      <strong>กรอกแล้ว {touchedCount} ห้อง ยังไม่ได้บันทึก</strong>
      {issue ? <button className="meter-save-bar-error" onClick={onFixIssue} role="alert" type="button">
        <AlertTriangle aria-hidden="true" size={13} />
        {issue} · ไปแก้
      </button> : error ? <small className="meter-save-bar-error" role="alert">{error}</small> : firstWarning ? <button className="meter-save-bar-warning" onClick={() => onReviewRoom(firstWarning.id)} type="button">
        <AlertTriangle aria-hidden="true" size={13} />
        ห้อง {warningRooms.map((room) => room.number).join(", ")} ควรตรวจเลขอีกครั้ง · ไปดู
      </button> : <small>ระบบเก็บฉบับร่างในเครื่องไว้ให้แล้ว ปิดหน้าแล้วกลับมากรอกต่อได้</small>}
    </div>
    <button className="secondary-button" disabled={isSaving} onClick={onClear} type="button">ล้างที่กรอก</button>
    <button className="primary-button" disabled={isSaving} onClick={onSave} type="button">
      {isSaving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
      {isSaving ? "กำลังบันทึกทั้งชุด..." : `ตรวจสอบและบันทึก ${touchedCount} ห้อง`}
    </button>
  </div>;
}

export function MetersPage({
  mode,
  onSaveMeters,
  propertyId,
  readOnly = false,
}: Readonly<{
  mode: "water" | "electric";
  onSaveMeters: (readings: MeterReadingDraft[]) => Promise<void>;
  propertyId: string;
  readOnly?: boolean;
}>) {
  const notify = useToast();
  const currentMonth = currentThaiMonth();
  const [billingMonth, setBillingMonth] = useState(currentMonth);
  const [building, setBuilding] = useState("all");
  const [floor, setFloor] = useState("all");
  const [query, setQuery] = useState("");
  const [currentDrafts, setCurrentDrafts] = useState<Record<string, string>>({});
  const [previousDrafts, setPreviousDrafts] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<MeterWorksheetRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  // ห้องที่ติดตอนกดบันทึกล่าสุด ข้อความคำนวณใหม่จากร่างทุกครั้ง แก้ถูกแล้วแถบเตือนหายเองไม่ต้องกดบันทึกซ้ำ
  const [problemRoomId, setProblemRoomId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  // เลขที่กำลังแก้ของแถวที่บันทึกไปแล้ว แยกจากร่างปกติเพราะส่งทีละห้องและไม่เก็บลงเครื่อง
  const [editingDrafts, setEditingDrafts] = useState<Record<string, string>>({});
  const [savingEditRoomId, setSavingEditRoomId] = useState<string | null>(null);
  // แยก key ตามหอ ชนิดมิเตอร์ และเดือน ร่างของแต่ละรอบจะได้ไม่ปนกัน
  const draftKey = `meter-draft:${propertyId}:${mode}:${billingMonth}`;
  const hasUnsavedDrafts = Object.keys(currentDrafts).length > 0 || Object.keys(previousDrafts).length > 0;
  useUnsavedChanges(
    !readOnly && hasUnsavedDrafts,
    "มีเลขมิเตอร์ฉบับร่างที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?",
  );

  // โหลดทุกห้องมาให้ครบ ไม่แบ่งหน้าจากเซิร์ฟเวอร์ เพราะคนจดต้องกรอกทั้งหอในรอบเดียว
  // แล้วค่อยมาแบ่งหน้าแสดงผลในเครื่องแทน
  const loadWorksheet = useCallback(async (signal?: AbortSignal, restoreDraft = true) => {
    setIsLoading(true);
    setLoadError("");
    try {
      setRows(await requestWorksheet({ billingMonth, mode, propertyId, signal }));
      // มีร่างค้างอยู่ก็เอากลับมาใส่ให้ เผื่อปิดหน้าไปตอนจดยังไม่เสร็จ
      // หลังบันทึกไม่ต้องอ่าน เพราะตัวบันทึกร่างอัตโนมัติที่ยังค้างอาจเขียนร่างเก่ากลับลงไปแล้ว
      if (!restoreDraft) return;
      const draft = readSavedDraft(draftKey);
      setCurrentDrafts(draft.current);
      setPreviousDrafts(draft.previous);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(error instanceof Error ? error.message : "โหลดข้อมูลมิเตอร์ไม่สำเร็จ");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [billingMonth, draftKey, mode, propertyId]);

  // บันทึกร่างลง localStorage อัตโนมัติ หน่วงไว้ 250 มิลลิวินาทีจะได้ไม่เขียนทุกครั้งที่กดแป้น
  useEffect(() => {
    if (readOnly) return;
    const timer = window.setTimeout(() => {
      if (Object.keys(currentDrafts).length || Object.keys(previousDrafts).length) {
        localStorage.setItem(draftKey, JSON.stringify({ current: currentDrafts, previous: previousDrafts }));
      // ลบร่างที่ว่างทิ้ง ไม่ให้ค้างอยู่เปล่า ๆ
      } else localStorage.removeItem(draftKey);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [currentDrafts, draftKey, previousDrafts, readOnly]);

  useEffect(() => {
    const controller = new AbortController();
    void loadWorksheet(controller.signal);
    return () => controller.abort();
  }, [loadWorksheet]);

  const buildings = useMemo(
    () => Array.from(new Map(rows.map(({ room }) => [
      room.building.id,
      `${room.building.code} · ${room.building.name}`,
    ])).entries()),
    [rows],
  );
  const floors = useMemo(
    () => Array.from(new Set(rows
      .filter(({ room }) => building === "all" || room.building.id === building)
      .map(({ room }) => room.floor.number)))
      .sort((left, right) => left - right),
    [building, rows],
  );
  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    return rows.filter(({ room, tenantName }) => (
      (building === "all" || room.building.id === building)
      && (floor === "all" || String(room.floor.number) === floor)
      && (!normalized || `${room.number} ${tenantName ?? ""}`.toLocaleLowerCase("th").includes(normalized))
    ));
  }, [building, floor, query, rows]);
  const { page, pageItems, setPage, totalPages } = useTablePagination(visibleRows, meterPageSize);

  // แถวที่ผู้ใช้แตะแล้วและยังไม่เคยบันทึก มีเฉพาะแถวเหล่านี้ที่จะถูกส่งขึ้นเซิร์ฟเวอร์
  const touchedRows = rows.filter((row) => (
    !row.readingId
    && (Object.hasOwn(currentDrafts, row.room.id) || Object.hasOwn(previousDrafts, row.room.id))
  ));

  // ตรวจและรวบรวมค่าที่กรอกไว้ เจอค่าไม่ถูกต้องก็โยน error พร้อมบอกว่าห้องไหน
  function collectReadings() {
    return touchedRows.map((row) => toMeterReading({ billingMonth, currentDrafts, mode, previousDrafts, row }));
  }

  // ตรวจให้ครบก่อนเปิดกล่องยืนยัน ผู้ใช้จะได้ไม่กดยืนยันแล้วเจอปฏิเสธทีหลัง
  // เจอห้องที่ยังผิดก็พาไปที่ช่องนั้นเลย
  function requestConfirmation() {
    setSaveError("");
    const firstProblem = touchedRows
      .map((row) => ({ row, problem: draftProblemOf(row, currentDrafts, previousDrafts) }))
      .find(({ problem }) => problem);
    if (firstProblem?.problem) {
      setProblemRoomId(firstProblem.row.room.id);
      reviewRoom(firstProblem.row.room.id, firstProblem.problem.field);
      return;
    }
    setProblemRoomId(null);
    setIsConfirming(true);
  }

  async function saveAll() {
    setIsSaving(true);
    setSaveError("");
    try {
      await onSaveMeters(collectReadings());
      // บันทึกขึ้นเซิร์ฟเวอร์แล้วจึงลบร่างทิ้ง ถ้าพลาดร่างจะยังอยู่ให้กดบันทึกใหม่ได้
      // ล้าง state ด้วย ไม่งั้นหน้ายังนับว่ามีร่างค้างและถามยืนยันทุกครั้งที่จะออกจากหน้า
      localStorage.removeItem(draftKey);
      setCurrentDrafts({});
      setPreviousDrafts({});
      setIsConfirming(false);
      await loadWorksheet(undefined, false);
      notify({ message: `บันทึกมิเตอร์${mode === "water" ? "น้ำ" : "ไฟ"} ${touchedRows.length} ห้องแล้ว` });
    } catch (error) {
      setIsConfirming(false);
      setSaveError(error instanceof Error ? error.message : "บันทึกมิเตอร์ไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  }

  // ส่งเลขที่แก้ของห้องเดียวขึ้นไป เซิร์ฟเวอร์ยอมเฉพาะเลขที่ยังไม่ถูกออกบิล
  async function submitEdit(row: MeterWorksheetRow) {
    const text = editingDrafts[row.room.id] ?? "";
    const current = Number(text);
    const problem = meterDraftProblem(row.previousReading ?? "", text);
    if (!row.readingId) return;
    if (problem) {
      setLoadError(`ห้อง ${row.room.number}: ${problem.message}`);
      return;
    }
    setSavingEditRoomId(row.room.id);
    setLoadError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/meter-readings/${row.readingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentReading: current }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "แก้เลขมิเตอร์ไม่สำเร็จ");
      setEditingDrafts((current) => withoutKey(current, row.room.id));
      await loadWorksheet(undefined, false);
      notify({ message: `แก้เลขมิเตอร์ห้อง ${row.room.number} แล้ว` });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "แก้เลขมิเตอร์ไม่สำเร็จ");
    } finally {
      setSavingEditRoomId(null);
    }
  }

  // คำเตือนในกล่องยืนยัน ห้องที่ใช้สูงผิดปกติต้องโผล่ให้เห็นก่อนกดยืนยัน ไม่ใช่แค่ในตาราง
  const abnormalRooms = touchedRows
    .filter((row) => meterRowFigures(row, currentDrafts, previousDrafts, editingDrafts).abnormal)
    .map((row) => row.room.number);
  const rowFigures = rows.map((row) => meterRowFigures(row, currentDrafts, previousDrafts, editingDrafts));
  // ห้องที่กรอกแล้วแต่เลขดูผิด ทั้งสูงผิดปกติและเกินเพดาน แถบบันทึกจะชี้ให้ไปดูก่อนกดบันทึก
  const warningRooms = touchedRows
    .filter((row) => {
      const figures = meterRowFigures(row, currentDrafts, previousDrafts, editingDrafts);
      return figures.abnormal || figures.overLimit;
    })
    .map((row) => ({ id: row.room.id, number: row.room.number }));

  const problemRow = problemRoomId ? touchedRows.find((row) => row.room.id === problemRoomId) : undefined;
  const problem = problemRow ? draftProblemOf(problemRow, currentDrafts, previousDrafts) : null;
  const invalidField = problemRow && problem ? { field: problem.field, roomId: problemRow.room.id } : null;

  // พาไปห้องที่ต้องตรวจ ห้องนั้นอาจอยู่หน้าอื่นหรือถูกตัวกรองซ่อนอยู่ จึงล้างตัวกรองก่อนถ้าจำเป็น แล้วโฟกัสช่องที่ต้องแก้
  function reviewRoom(roomId: string, field: MeterDraftField = "latest") {
    let list = visibleRows;
    if (!visibleRows.some((row) => row.room.id === roomId)) {
      setQuery("");
      setBuilding("all");
      setFloor("all");
      list = rows;
    }
    const index = list.findIndex((row) => row.room.id === roomId);
    if (index < 0) return;
    setPage(Math.floor(index / meterPageSize) + 1);
    window.requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(`tr[data-room-id="${roomId}"] input[data-meter-field="${field}"]`);
      input?.scrollIntoView({ block: "center" });
      input?.focus({ preventScroll: true });
    });
  }

  return (
    <section className="meter-figma-page">
      <MeterPeriodBar billingMonth={billingMonth} currentMonth={currentMonth} onBillingMonthChange={(value) => { setBillingMonth(value); setPage(1); }} />

      <MeterProgress
        amount={rowFigures.reduce((total, figures) => total + figures.amount, 0)}
        // นับเฉพาะห้องที่มีผู้เช่า เพราะเป็นห้องที่ต้องออกบิล ห้องว่างจดหรือไม่จดก็ได้ ไม่ควรทำให้ดูเหมือนยังค้างอยู่
        drafted={touchedRows.filter((row) => row.tenantName && (currentDrafts[row.room.id] ?? "").trim() !== "").length}
        mode={mode}
        saved={rows.filter((row) => row.tenantName && row.readingId).length}
        total={rows.filter((row) => row.tenantName).length}
        warnings={rowFigures.filter((figures) => figures.abnormal || figures.overLimit).length}
      />

      <article className="meter-table-card">
        <div className="additional-card-head">
          <div><h2>{mode === "water" ? "รายการมิเตอร์น้ำ" : "รายการมิเตอร์ไฟ"}</h2><p>กด Enter เพื่อไปห้องถัดไป · ระบบเก็บฉบับร่างในเครื่องให้อัตโนมัติ</p></div>
        </div>
        <MeterTableToolbar
          building={building}
          buildings={buildings}
          floor={floor}
          floors={floors}
          onBuildingChange={(value) => { setBuilding(value); setFloor("all"); setPage(1); }}
          onFloorChange={(value) => { setFloor(value); setPage(1); }}
          onQueryChange={(value) => { setQuery(value); setPage(1); }}
          query={query}
        />
        {readOnly ? <ReadOnlyNotice className="m-4">ดู ค้นหา และกรองข้อมูลมิเตอร์ได้ แต่ไม่สามารถกรอกหรือบันทึกเลขมิเตอร์ใหม่ได้</ReadOnlyNotice> : null}
        {loadError ? <p className="form-alert error mx-6 my-3" role="alert">{loadError}</p> : null}
        <MeterWorksheetTable
          currentDrafts={currentDrafts}
          editingDrafts={editingDrafts}
          onCancelEdit={(roomId) => setEditingDrafts((current) => withoutKey(current, roomId))}
          onEditChange={(roomId, value) => setEditingDrafts((current) => ({ ...current, [roomId]: value }))}
          onStartEdit={(row) => setEditingDrafts((current) => ({ ...current, [row.room.id]: row.currentReading ?? "" }))}
          onSubmitEdit={(row) => void submitEdit(row)}
          savingEditRoomId={savingEditRoomId}
          hasFilter={Boolean(query.trim()) || building !== "all" || floor !== "all"}
          invalidField={invalidField}
          isLoading={isLoading}
          pageItems={pageItems}
          previousDrafts={previousDrafts}
          readOnly={readOnly}
          setCurrentDrafts={setCurrentDrafts}
          setPreviousDrafts={setPreviousDrafts}
          visibleCount={visibleRows.length}
        />
        <TablePagination
          page={page}
          setPage={setPage}
          totalItems={visibleRows.length}
          totalPages={totalPages}
        />
      </article>
      {readOnly ? null : <MeterSaveBar
        error={saveError}
        isSaving={isSaving}
        issue={problemRow && problem ? `ห้อง ${problemRow.room.number}: ${problem.message}` : null}
        onClear={() => setIsConfirmingClear(true)}
        onFixIssue={() => { if (invalidField) reviewRoom(invalidField.roomId, invalidField.field); }}
        onReviewRoom={(roomId) => reviewRoom(roomId)}
        onSave={requestConfirmation}
        touchedCount={touchedRows.length}
        warningRooms={warningRooms}
      />}
      {isConfirmingClear ? <ConfirmationDialog
        confirmLabel="ล้างที่กรอก"
        description={`เลขที่กรอกไว้ ${touchedRows.length} ห้องจะหายไป ห้องที่บันทึกแล้วไม่ได้รับผลกระทบ`}
        onCancel={() => setIsConfirmingClear(false)}
        onConfirm={() => {
          setCurrentDrafts({});
          setPreviousDrafts({});
          setProblemRoomId(null);
          setSaveError("");
          setIsConfirmingClear(false);
        }}
        title="ล้างเลขที่กรอกไว้?"
        variant="danger"
      /> : null}
      {isConfirming ? <ConfirmationDialog
        confirmDisabled={isSaving}
        confirmLabel={isSaving ? "กำลังบันทึก..." : `ยืนยันบันทึก ${touchedRows.length} ห้อง`}
        description={`ระบบจะบันทึกมิเตอร์${mode === "water" ? "น้ำ" : "ไฟ"}รอบ ${formatThaiMonth(billingMonth)} จำนวน ${touchedRows.length} ห้องในรายการเดียว หากห้องใดบันทึกไม่ได้ ระบบจะไม่บันทึกทุกห้อง${abnormalRooms.length ? ` · ห้อง ${abnormalRooms.join(", ")} ใช้สูงกว่ารอบก่อนผิดปกติ กรุณาตรวจเลขอีกครั้ง` : ""}`}
        onCancel={() => { if (!isSaving) setIsConfirming(false); }}
        onConfirm={() => void saveAll()}
        title="ยืนยันบันทึกมิเตอร์ทั้งชุด"
      /> : null}
    </section>
  );
}

// ตัวเลขที่ใช้แสดงในแถวหนึ่ง คำนวณจากเลขครั้งก่อนกับเลขล่าสุดที่กรอกไว้
function meterRowFigures(row: MeterWorksheetRow, currentDrafts: Record<string, string>, previousDrafts: Record<string, string>, editingDrafts: Record<string, string>) {
  const previousText = row.previousReading ?? previousDrafts[row.room.id] ?? "";
  // ห้ามใช้เลขครั้งก่อนเป็นค่าตั้งต้นของช่อง ไม่งั้นผู้ใช้พิมพ์ต่อท้ายเลขเดิม เช่น 153 กลายเป็น 153160
  // เลขครั้งก่อนจึงแสดงเป็น placeholder อย่างเดียว ช่องว่างก็นับเป็น 0 หน่วยอยู่แล้ว
  const latestText = editingDrafts[row.room.id] ?? currentDrafts[row.room.id] ?? row.currentReading ?? "";
  const previous = Number(previousText);
  const latest = Number(latestText);
  const validReadings = previousText !== "" && latestText !== "" && Number.isFinite(previous) && Number.isFinite(latest) && latest >= previous;
  const units = validReadings ? latest - previous : 0;
  const unitRate = Number(row.unitRate);
  // เตือนเมื่อใช้เกินสองเท่าของรอบก่อน หรือเกินรอบก่อน 10 หน่วย เอาเกณฑ์ที่สูงกว่า
  // เงื่อนไข +10 กันเตือนพร่ำเพรื่อกับห้องที่ใช้น้อยมาก เช่นจาก 1 เป็น 3 หน่วย
  const abnormal = validReadings && row.previousUsage !== null && row.previousUsage > 0
    && units > Math.max(row.previousUsage * 2, row.previousUsage + 10);
  const overLimit = validReadings && !isMeterUsageWithinLimit(previous, latest);
  return { abnormal, amount: units * unitRate, latestText, overLimit, previous, previousText, unitRate, units };
}

// ป้ายสถานะท้ายแถว บันทึกแล้ว ต้องตรวจสอบ หรือรอบันทึก
// สีชุดเดียวกับป้ายแจ้งเตือนทั้งระบบ แดงทึบคือผิดจนบันทึกไม่ได้ เหลืองคือควรตรวจอีกครั้ง เขียวคือเสร็จแล้ว
function MeterRowStatus({ abnormal, overLimit, saved }: Readonly<{ abnormal: boolean; overLimit: boolean; saved: boolean }>) {
  if (overLimit) return <span className="today-label meter-status" data-tone="urgent"><AlertTriangle size={13} /> เกินเพดาน</span>;
  if (saved) return <span className="today-label meter-status" data-tone="done"><Check size={13} /> บันทึกแล้ว</span>;
  if (abnormal) return <span className="today-label meter-status" data-tone="pending"><AlertTriangle size={13} /> โปรดตรวจสอบ</span>;
  return <span className="today-label meter-status" data-tone="neutral">รอบันทึก</span>;
}

// ความคืบหน้าของการจดรอบนี้ เห็นทันทีว่าเหลือกี่ห้อง ยอดรวมเท่าไร และมีห้องไหนต้องตรวจ
function MeterProgress({ amount, drafted, mode, saved, total, warnings }: Readonly<{ amount: number; drafted: number; mode: "water" | "electric"; saved: number; total: number; warnings: number }>) {
  const done = Math.min(total, saved + drafted);
  const share = total > 0 ? Math.round((done / total) * 100) : 0;
  return <SummaryCards label="ความคืบหน้าการจดมิเตอร์">
    <SummaryCard
      detail={drafted > 0 ? `ยังไม่บันทึก ${drafted} ห้อง` : "นับเฉพาะห้องที่มีผู้เช่า"}
      label="จดแล้ว"
      unit={`/ ${total} ห้อง`}
      value={done}
    >
      <span aria-hidden="true" className="overview-progress" data-tone="done"><span style={{ width: `${Math.max(2, share)}%` }} /></span>
    </SummaryCard>
    <SummaryCard label={`ค่า${mode === "water" ? "น้ำ" : "ไฟ"}รวมรอบนี้`} value={`฿${amount.toLocaleString("th-TH")}`} />
    <SummaryCard dot={warnings > 0 ? "pending" : undefined} label="ต้องตรวจอีกครั้ง" unit="ห้อง" value={warnings} />
  </SummaryCards>;
}

type MeterTableProps = Readonly<{
  currentDrafts: Record<string, string>;
  editingDrafts: Record<string, string>;
  onCancelEdit: (roomId: string) => void;
  onEditChange: (roomId: string, value: string) => void;
  onStartEdit: (row: MeterWorksheetRow) => void;
  onSubmitEdit: (row: MeterWorksheetRow) => void;
  savingEditRoomId: string | null;
  hasFilter: boolean;
  // ช่องที่ติดตอนกดบันทึก ขอบแดงให้เห็นว่าต้องแก้ตรงไหน
  invalidField: { field: MeterDraftField; roomId: string } | null;
  isLoading: boolean;
  pageItems: MeterWorksheetRow[];
  previousDrafts: Record<string, string>;
  readOnly: boolean;
  setCurrentDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPreviousDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  visibleCount: number;
}>;

// ตารางกรอกมิเตอร์ แยกกรณีกำลังโหลด กรองจนไม่เหลือ และยังไม่มีห้องเลย
function MeterWorksheetTable({ hasFilter, isLoading, visibleCount, ...rowProps }: MeterTableProps) {
  // เก็บ ref ของช่องกรอกไว้ที่นี่ เพราะใช้แค่ตอนกด Enter เพื่อกระโดดไปห้องถัดไป
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const registerInput = (roomId: string, element: HTMLInputElement | null) => {
    inputRefs.current[roomId] = element;
  };
  // คนจดมิเตอร์จะได้ไม่ต้องละมือไปจับเมาส์
  const focusRoom = (roomId: string) => inputRefs.current[roomId]?.focus();

  if (isLoading) return <LoadingSkeleton columns={8} count={6} label="กำลังโหลดข้อมูลมิเตอร์" variant="table" />;
  if (visibleCount === 0 && hasFilter) return <SearchEmptyState description="ลองเปลี่ยนคำค้นหา อาคาร หรือชั้น" title="ไม่พบห้องพักตามเงื่อนไข" />;
  if (visibleCount === 0) return <div className="dashboard-empty-state">ยังไม่มีห้องพักสำหรับบันทึกมิเตอร์</div>;

  return <div className="figma-table-wrap">
    <table className="figma-table meter-figma-table">
      <thead>
        <tr>
          <th scope="col">ห้อง</th>
          <th scope="col">ผู้เช่า</th>
          <th scope="col">เลขครั้งก่อน</th>
          <th scope="col">เลขล่าสุด</th>
          <th scope="col">หน่วยที่ใช้</th>
          <th scope="col">ราคา/หน่วย</th>
          <th scope="col">จำนวนเงิน</th>
          <th scope="col">สถานะ</th>
        </tr>
      </thead>
      <tbody>
        {rowProps.pageItems.map((row, index) => <MeterWorksheetRowView index={index} key={row.room.id} onFocusRoom={focusRoom} onRegisterInput={registerInput} row={row} {...rowProps} />)}
      </tbody>
    </table>
  </div>;
}

// ช่องกรอกเลขตั้งต้น มีเฉพาะห้องที่ยังไม่เคยมีเลขครั้งก่อนในระบบ
function PreviousReadingCell({ invalid, previousDrafts, readOnly, row, setPreviousDrafts, value }: Readonly<{
  invalid: boolean;
  previousDrafts: Record<string, string>;
  readOnly: boolean;
  row: MeterWorksheetRow;
  setPreviousDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  value: number;
}>) {
  if (row.previousReading !== null) return <>{value.toLocaleString("th-TH")}</>;
  if (readOnly) return <>-</>;
  return <input
    aria-invalid={invalid || undefined}
    aria-label={`เลขมิเตอร์ตั้งต้นห้อง ${row.room.number}`}
    data-meter-field="previous"
    // ล็อกแถวที่บันทึกไปแล้ว ต้องไปแก้ที่หน้าประวัติแทน
    disabled={Boolean(row.readingId)}
    min={0}
    onChange={(event) => setPreviousDrafts((current) => ({ ...current, [row.room.id]: event.target.value }))}
    inputMode="decimal"
    placeholder="เลขเริ่ม"
    type="number"
    value={previousDrafts[row.room.id] ?? ""}
  />;
}

function MeterWorksheetRowView({ currentDrafts, editingDrafts, index, invalidField, onCancelEdit, onEditChange, onFocusRoom, onRegisterInput, onStartEdit, onSubmitEdit, pageItems, previousDrafts, readOnly, row, savingEditRoomId, setCurrentDrafts, setPreviousDrafts }: Omit<MeterTableProps, "hasFilter" | "isLoading" | "visibleCount"> & Readonly<{
  index: number;
  onFocusRoom: (roomId: string) => void;
  onRegisterInput: (roomId: string, element: HTMLInputElement | null) => void;
  row: MeterWorksheetRow;
}>) {
  const { abnormal, amount, latestText, overLimit, previous, previousText, unitRate, units } = meterRowFigures(row, currentDrafts, previousDrafts, editingDrafts);
  const isEditing = Object.hasOwn(editingDrafts, row.room.id);

  // Enter กระโดดไปห้องถัดไป
  const focusNextRow = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = pageItems[index + 1];
    if (next) onFocusRoom(next.room.id);
  };

  return <tr data-room-id={row.room.id}>
    <td>
      <strong>{row.room.number}</strong>
      <small className="block">{row.room.building.code} · ชั้น {row.room.floor.number}</small>
    </td>
    {/* data-label ใช้ตอนจอเล็ก แถวกลายเป็นการ์ดทีละห้อง หัวตารางถูกซ่อน จึงต้องมีชื่อช่องติดไปกับค่า */}
    <td data-label="ผู้เช่า">{row.tenantName ?? "-"}</td>
    <td data-label="เลขครั้งก่อน">
      <PreviousReadingCell invalid={invalidField?.roomId === row.room.id && invalidField.field === "previous"} previousDrafts={previousDrafts} readOnly={readOnly} row={row} setPreviousDrafts={setPreviousDrafts} value={previous} />
    </td>
    <td data-label="เลขล่าสุด">
      {readOnly
        ? <>{row.currentReading === null ? "-" : Number(row.currentReading).toLocaleString("th-TH")}</>
        : <input
          aria-invalid={(invalidField?.roomId === row.room.id && invalidField.field === "latest") || undefined}
          aria-label={`เลขมิเตอร์ล่าสุดห้อง ${row.room.number}`}
          data-meter-field="latest"
          disabled={Boolean(row.readingId) && !isEditing}
          // มือถือเด้งแป้นตัวเลขขึ้นมาเลย เจ้าของหอมักเดินจดมิเตอร์หน้าห้องด้วยมือถือ
          inputMode="decimal"
          min={previousText || 0}
          onChange={(event) => isEditing
            ? onEditChange(row.room.id, event.target.value)
            : setCurrentDrafts((current) => ({ ...current, [row.room.id]: event.target.value }))}
          onKeyDown={focusNextRow}
          placeholder={previousText || "เลขใหม่"}
          ref={(element) => onRegisterInput(row.room.id, element)}
          type="number"
          value={latestText}
        />}
    </td>
    <td data-label="หน่วยที่ใช้">
      <span className={abnormal ? "font-black text-amber-600" : ""}>{units.toLocaleString("th-TH")}</span>
      {overLimit ? <small className="mt-1 flex items-center gap-1 text-[#b91c1c]"><AlertTriangle size={13} /> เกิน {MAX_MONTHLY_METER_USAGE.toLocaleString("th-TH")} หน่วย น่าจะพิมพ์ผิด</small> : null}
      {abnormal && !overLimit ? <small className="mt-1 flex items-center gap-1 text-amber-600"><AlertTriangle size={13} /> สูงกว่ารอบก่อนผิดปกติ (รอบก่อน {row.previousUsage?.toLocaleString("th-TH")} หน่วย)</small> : null}
    </td>
    <td data-label="ราคา/หน่วย">฿{unitRate.toLocaleString("th-TH")}</td>
    <td data-label="จำนวนเงิน"><strong>฿{amount.toLocaleString("th-TH")}</strong></td>
    <td data-label="สถานะ">
      <MeterRowStatus abnormal={abnormal} overLimit={overLimit} saved={Boolean(row.readingId) && !isEditing} />
      {row.readingId && !readOnly ? <MeterEditActions
        isEditing={isEditing}
        isSaving={savingEditRoomId === row.room.id}
        onCancel={() => onCancelEdit(row.room.id)}
        onStart={() => onStartEdit(row)}
        onSubmit={() => onSubmitEdit(row)}
        roomNumber={row.room.number}
      /> : null}
    </td>
  </tr>;
}

// ปุ่มแก้เลขของแถวที่บันทึกแล้ว เผื่อจดผิด เซิร์ฟเวอร์จะปฏิเสธเองถ้าเลขนี้ถูกออกบิลไปแล้ว
function MeterEditActions({ isEditing, isSaving, onCancel, onStart, onSubmit, roomNumber }: Readonly<{
  isEditing: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onStart: () => void;
  onSubmit: () => void;
  roomNumber: string;
}>) {
  if (!isEditing) return <button aria-label={`แก้เลขมิเตอร์ห้อง ${roomNumber}`} className="meter-edit-button" onClick={onStart} type="button"><Pencil size={13} /> แก้ไข</button>;
  return <span className="meter-edit-actions">
    <button aria-label={`บันทึกเลขที่แก้ของห้อง ${roomNumber}`} className="meter-edit-button primary" disabled={isSaving} onClick={onSubmit} type="button">
      {isSaving ? <LoaderCircle className="animate-spin" size={13} /> : <Check size={13} />} บันทึก
    </button>
    <button aria-label={`ยกเลิกการแก้ห้อง ${roomNumber}`} className="meter-edit-button" disabled={isSaving} onClick={onCancel} type="button"><X size={13} /> ยกเลิก</button>
  </span>;
}
