"use client";
// เก็บร่างที่ยังไม่บันทึกไว้ใน localStorage และจัดการโฟกัสของช่องกรอกเอง

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, LoaderCircle, Save, Search } from "lucide-react";
import { ConfirmationDialog } from "@/components/dorm/ConfirmationDialog";
import { DropdownField } from "@/components/dorm/DropdownField";
import { TablePagination, useTablePagination } from "@/components/dorm/TablePagination";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { useToast } from "@/components/ui/ToastProvider";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { PageHeaderActions } from "@/components/ui/PageHeaderSlot";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";

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

function meterTypeOf(mode: "water" | "electric") {
  return mode === "water" ? "WATER" : "ELECTRICITY";
}

// เลขที่กรอกต้องเป็นตัวเลขไม่ติดลบ และเลขล่าสุดต้องไม่น้อยกว่าเลขครั้งก่อน
// เพราะมิเตอร์เดินหน้าอย่างเดียว
function isValidPair(current: number, currentText: string, previous: number | undefined) {
  if (currentText === "" || !Number.isFinite(current) || current < 0) return false;
  if (previous === undefined) return true;
  return Number.isFinite(previous) && previous >= 0 && current >= previous;
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
  const previous = previousText === "" ? undefined : Number(previousText);
  const current = Number(currentText);
  if (!isValidPair(current, currentText, previous)) {
    throw new Error(`ห้อง ${row.room.number}: กรุณาระบุเลขมิเตอร์ให้ถูกต้อง และเลขล่าสุดต้องไม่น้อยกว่าเลขครั้งก่อน`);
  }
  return {
    roomId: row.room.id,
    type: meterTypeOf(mode),
    billingMonth,
    // ส่งเลขตั้งต้นไปเฉพาะห้องที่ยังไม่เคยมีในระบบ ห้องเดิมใช้เลขจากรอบก่อนที่เซิร์ฟเวอร์มีอยู่แล้ว
    ...(row.previousReading === null && previous !== undefined ? { previousReading: previous } : {}),
    currentReading: current,
  };
}

// แถบตัวกรองด้านบน เปลี่ยนอะไรก็กลับไปหน้าแรกของตารางเสมอ
function MeterFilterBar({ billingMonth, building, buildings, currentMonth, floor, floors, onBillingMonthChange, onBuildingChange, onFloorChange, onQueryChange, query }: Readonly<{
  billingMonth: string;
  building: string;
  buildings: Array<[string, string]>;
  currentMonth: string;
  floor: string;
  floors: number[];
  onBillingMonthChange: (value: string) => void;
  onBuildingChange: (value: string) => void;
  onFloorChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  query: string;
}>) {
  return <div className="meter-filter-bar">
    <DropdownField
      label="อาคาร"
      // เปลี่ยนอาคารแล้วรีเซ็ตชั้นด้วย ไม่งั้นจะค้างชั้นของอาคารเดิมแล้วผลลัพธ์ว่าง
      onChange={onBuildingChange}
      options={[{ value: "all", label: "ทุกอาคาร" }, ...buildings.map(([value, label]) => ({ value, label }))]}
      value={building}
    />
    <DropdownField
      label="ชั้น"
      onChange={onFloorChange}
      options={[{ value: "all", label: "ทุกชั้น" }, ...floors.map((item) => ({ value: String(item), label: `ชั้น ${item}` }))]}
      value={floor}
    />
    <label>
      รอบมิเตอร์
      {/* เพดานเป็นเดือนปัจจุบัน เพราะยังจดมิเตอร์ของเดือนที่ยังไม่ถึงไม่ได้ */}
      <input aria-label="รอบเดือนบันทึกมิเตอร์" max={currentMonth} onChange={(event) => onBillingMonthChange(event.target.value)} type="month" value={billingMonth} />
    </label>
    <label className="meter-search">
      <Search size={16} />
      <input onChange={(event) => onQueryChange(event.target.value)} placeholder="ค้นหาห้องหรือผู้เช่า..." value={query} />
    </label>
  </div>;
}

// ปุ่มบันทึกทั้งชุด กดไม่ได้จนกว่าจะกรอกอย่างน้อยหนึ่งห้อง และต้องบอกเหตุผลด้วย
function MeterSaveAction({ isLoading, isSaving, onSave, readOnly, touchedCount }: Readonly<{
  isLoading: boolean;
  isSaving: boolean;
  onSave: () => void;
  readOnly: boolean;
  touchedCount: number;
}>) {
  if (readOnly) return <ReadOnlyNotice compact />;
  const nothingToSave = !isLoading && !isSaving && touchedCount === 0;
  return <div className="disabled-action">
    <button aria-describedby={nothingToSave ? "meter-save-disabled-reason" : undefined} className="primary-button" disabled={isLoading || isSaving || touchedCount === 0} onClick={onSave} type="button">
      {isSaving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
      {isSaving ? "กำลังบันทึกทั้งชุด..." : `ตรวจสอบและบันทึก ${touchedCount} ห้อง`}
    </button>
    {nothingToSave ? <p className="disabled-reason" id="meter-save-disabled-reason">กรอกเลขมิเตอร์ล่าสุดอย่างน้อย 1 ห้องก่อนบันทึก</p> : null}
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
  const currentMonth = new Date().toISOString().slice(0, 7);
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
  // แยก key ตามหอ ชนิดมิเตอร์ และเดือน ร่างของแต่ละรอบจะได้ไม่ปนกัน
  const draftKey = `meter-draft:${propertyId}:${mode}:${billingMonth}`;
  const hasUnsavedDrafts = Object.keys(currentDrafts).length > 0 || Object.keys(previousDrafts).length > 0;
  useUnsavedChanges(
    !readOnly && hasUnsavedDrafts,
    "มีเลขมิเตอร์ฉบับร่างที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?",
  );

  // โหลดทุกห้องมาให้ครบ ไม่แบ่งหน้าจากเซิร์ฟเวอร์ เพราะคนจดต้องกรอกทั้งหอในรอบเดียว
  // แล้วค่อยมาแบ่งหน้าแสดงผลในเครื่องแทน
  const loadWorksheet = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError("");
    try {
      setRows(await requestWorksheet({ billingMonth, mode, propertyId, signal }));
      // มีร่างค้างอยู่ก็เอากลับมาใส่ให้ เผื่อปิดหน้าไปตอนจดยังไม่เสร็จ
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
  const { page, pageItems, setPage, totalPages } = useTablePagination(visibleRows);

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
  function requestConfirmation() {
    setLoadError("");
    if (touchedRows.length === 0) {
      setLoadError("กรุณากรอกเลขมิเตอร์ล่าสุดอย่างน้อย 1 ห้อง");
      return;
    }
    try {
      collectReadings();
      setIsConfirming(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "ข้อมูลมิเตอร์ไม่ถูกต้อง");
    }
  }

  async function saveAll() {
    setIsSaving(true);
    setLoadError("");
    try {
      await onSaveMeters(collectReadings());
      // บันทึกขึ้นเซิร์ฟเวอร์แล้วจึงลบร่างทิ้ง ถ้าพลาดร่างจะยังอยู่ให้กดบันทึกใหม่ได้
      localStorage.removeItem(draftKey);
      setIsConfirming(false);
      await loadWorksheet();
      notify({ message: `บันทึกมิเตอร์${mode === "water" ? "น้ำ" : "ไฟ"} ${touchedRows.length} ห้องแล้ว` });
    } catch (error) {
      setIsConfirming(false);
      setLoadError(error instanceof Error ? error.message : "บันทึกมิเตอร์ไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="meter-figma-page">
      <MeterFilterBar
        billingMonth={billingMonth}
        building={building}
        buildings={buildings}
        currentMonth={currentMonth}
        floor={floor}
        floors={floors}
        onBillingMonthChange={(value) => { setBillingMonth(value); setPage(1); }}
        onBuildingChange={(value) => { setBuilding(value); setFloor("all"); setPage(1); }}
        onFloorChange={(value) => { setFloor(value); setPage(1); }}
        onQueryChange={(value) => { setQuery(value); setPage(1); }}
        query={query}
      />

      <article className="meter-table-card">
        <div className="additional-card-head">
          <div><h2>{mode === "water" ? "รายการมิเตอร์น้ำ" : "รายการมิเตอร์ไฟ"}</h2><p>ระบบเก็บฉบับร่างในเครื่องอัตโนมัติ · กด Enter เพื่อไปห้องถัดไป</p></div>
          <PageHeaderActions>
            <MeterSaveAction
              isLoading={isLoading}
              isSaving={isSaving}
              onSave={requestConfirmation}
              readOnly={readOnly}
              touchedCount={touchedRows.length}
            />
          </PageHeaderActions>
        </div>
        {readOnly ? <ReadOnlyNotice className="m-4">ดู ค้นหา และกรองข้อมูลมิเตอร์ได้ แต่ไม่สามารถกรอกหรือบันทึกเลขมิเตอร์ใหม่ได้</ReadOnlyNotice> : null}
        {loadError ? <div className="dashboard-empty-state" role="alert">{loadError}</div> : null}
        <MeterWorksheetTable
          currentDrafts={currentDrafts}
          hasFilter={Boolean(query.trim()) || building !== "all" || floor !== "all"}
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
      {isConfirming ? <ConfirmationDialog
        confirmDisabled={isSaving}
        confirmLabel={isSaving ? "กำลังบันทึก..." : `ยืนยันบันทึก ${touchedRows.length} ห้อง`}
        description={`ระบบจะบันทึกมิเตอร์${mode === "water" ? "น้ำ" : "ไฟ"}รอบ ${billingMonth} จำนวน ${touchedRows.length} ห้องในรายการเดียว หากห้องใดบันทึกไม่ได้ ระบบจะไม่บันทึกทุกห้อง`}
        onCancel={() => { if (!isSaving) setIsConfirming(false); }}
        onConfirm={() => void saveAll()}
        title="ยืนยันบันทึกมิเตอร์ทั้งชุด"
      /> : null}
    </section>
  );
}

// ตัวเลขที่ใช้แสดงในแถวหนึ่ง คำนวณจากเลขครั้งก่อนกับเลขล่าสุดที่กรอกไว้
function meterRowFigures(row: MeterWorksheetRow, currentDrafts: Record<string, string>, previousDrafts: Record<string, string>) {
  const previousText = row.previousReading ?? previousDrafts[row.room.id] ?? "";
  const latestText = currentDrafts[row.room.id] ?? row.currentReading ?? previousText;
  const previous = Number(previousText);
  const latest = Number(latestText);
  const validReadings = previousText !== "" && latestText !== "" && Number.isFinite(previous) && Number.isFinite(latest) && latest >= previous;
  const units = validReadings ? latest - previous : 0;
  const unitRate = Number(row.unitRate);
  // เตือนเมื่อใช้เกินสองเท่าของรอบก่อน หรือเกินรอบก่อน 10 หน่วย เอาเกณฑ์ที่สูงกว่า
  // เงื่อนไข +10 กันเตือนพร่ำเพรื่อกับห้องที่ใช้น้อยมาก เช่นจาก 1 เป็น 3 หน่วย
  const abnormal = validReadings && row.previousUsage !== null && row.previousUsage > 0
    && units > Math.max(row.previousUsage * 2, row.previousUsage + 10);
  return { abnormal, amount: units * unitRate, latestText, previous, previousText, unitRate, units };
}

// ป้ายสถานะท้ายแถว บันทึกแล้ว ต้องตรวจสอบ หรือรอบันทึก
function MeterRowStatus({ abnormal, saved }: Readonly<{ abnormal: boolean; saved: boolean }>) {
  if (saved) return <span className="badge badge-paid"><Check size={13} /> บันทึกแล้ว</span>;
  if (abnormal) return <span className="badge bg-amber-100 text-amber-800"><AlertTriangle size={13} /> โปรดตรวจสอบ</span>;
  return <span className="badge badge-pending"><Check size={13} /> รอบันทึก</span>;
}

type MeterTableProps = Readonly<{
  currentDrafts: Record<string, string>;
  hasFilter: boolean;
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
function PreviousReadingCell({ previousDrafts, readOnly, row, setPreviousDrafts, value }: Readonly<{
  previousDrafts: Record<string, string>;
  readOnly: boolean;
  row: MeterWorksheetRow;
  setPreviousDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  value: number;
}>) {
  if (row.previousReading !== null) return <>{value.toLocaleString("th-TH")}</>;
  if (readOnly) return <>-</>;
  return <input
    aria-label={`เลขมิเตอร์ตั้งต้นห้อง ${row.room.number}`}
    // ล็อกแถวที่บันทึกไปแล้ว ต้องไปแก้ที่หน้าประวัติแทน
    disabled={Boolean(row.readingId)}
    min={0}
    onChange={(event) => setPreviousDrafts((current) => ({ ...current, [row.room.id]: event.target.value }))}
    placeholder="กรอกครั้งแรก"
    type="number"
    value={previousDrafts[row.room.id] ?? ""}
  />;
}

function MeterWorksheetRowView({ currentDrafts, index, onFocusRoom, onRegisterInput, pageItems, previousDrafts, readOnly, row, setCurrentDrafts, setPreviousDrafts }: Omit<MeterTableProps, "hasFilter" | "isLoading" | "visibleCount"> & Readonly<{
  index: number;
  onFocusRoom: (roomId: string) => void;
  onRegisterInput: (roomId: string, element: HTMLInputElement | null) => void;
  row: MeterWorksheetRow;
}>) {
  const { abnormal, amount, latestText, previous, previousText, unitRate, units } = meterRowFigures(row, currentDrafts, previousDrafts);

  // Enter กระโดดไปห้องถัดไป
  const focusNextRow = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = pageItems[index + 1];
    if (next) onFocusRoom(next.room.id);
  };

  return <tr>
    <td>
      <strong>{row.room.number}</strong>
      <small className="block">{row.room.building.code} · ชั้น {row.room.floor.number}</small>
    </td>
    <td>{row.tenantName ?? "-"}</td>
    <td>
      <PreviousReadingCell previousDrafts={previousDrafts} readOnly={readOnly} row={row} setPreviousDrafts={setPreviousDrafts} value={previous} />
    </td>
    <td>
      {readOnly
        ? <>{row.currentReading === null ? "-" : Number(row.currentReading).toLocaleString("th-TH")}</>
        : <input
          aria-label={`เลขมิเตอร์ล่าสุดห้อง ${row.room.number}`}
          disabled={Boolean(row.readingId)}
          min={previousText || 0}
          onChange={(event) => setCurrentDrafts((current) => ({ ...current, [row.room.id]: event.target.value }))}
          onKeyDown={focusNextRow}
          placeholder={previousText || "เลขล่าสุด"}
          ref={(element) => onRegisterInput(row.room.id, element)}
          type="number"
          value={latestText}
        />}
    </td>
    <td>
      <span className={abnormal ? "font-black text-amber-600" : ""}>{units.toLocaleString("th-TH")}</span>
      {abnormal ? <small className="mt-1 flex items-center gap-1 text-amber-600"><AlertTriangle size={13} /> สูงกว่ารอบก่อนผิดปกติ ({row.previousUsage?.toLocaleString("th-TH")} หน่วย)</small> : null}
    </td>
    <td>฿{unitRate.toLocaleString("th-TH")}</td>
    <td><strong>฿{amount.toLocaleString("th-TH")}</strong></td>
    <td><MeterRowStatus abnormal={abnormal} saved={Boolean(row.readingId)} /></td>
  </tr>;
}
