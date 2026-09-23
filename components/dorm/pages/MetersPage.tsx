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
export function MetersPage({
  mode,
  onSaveMeters,
  propertyId,
  readOnly = false,
}: {
  mode: "water" | "electric";
  onSaveMeters: (readings: MeterReadingDraft[]) => Promise<void>;
  propertyId: string;
  readOnly?: boolean;
}) {
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
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
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
      const collected: MeterWorksheetRow[] = [];
      // วนขอทีละ 100 ห้องจนหมด เพราะ API จำกัดจำนวนต่อครั้ง
      let page = 1;
      let hasNextPage = true;
      while (hasNextPage) {
        const params = new URLSearchParams({
          billingMonth,
          type: mode === "water" ? "WATER" : "ELECTRICITY",
          page: String(page),
          pageSize: "100",
        });
        const response = await fetch(
          `/api/v1/admin/properties/${propertyId}/meter-readings/worksheet?${params}`,
          { cache: "no-store", credentials: "same-origin", signal },
        );
        const payload = await response.json() as {
          data?: MeterWorksheetRow[];
          error?: string;
          pageInfo?: PageInfo;
        };
        if (!response.ok || !payload.data) {
          throw new Error(payload.error || "โหลดข้อมูลมิเตอร์ไม่สำเร็จ");
        }
        collected.push(...payload.data);
        hasNextPage = payload.pageInfo?.hasNextPage ?? false;
        page += 1;
      }
      setRows(collected);
      // มีร่างค้างอยู่ก็เอากลับมาใส่ให้ เผื่อปิดหน้าไปตอนจดยังไม่เสร็จ
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        try {
          const draft = JSON.parse(saved) as { current?: Record<string, string>; previous?: Record<string, string> };
          setCurrentDrafts(draft.current ?? {});
          setPreviousDrafts(draft.previous ?? {});
        // ค่าที่เก็บไว้เสียก็ลบทิ้ง ดีกว่าปล่อยให้พังทุกครั้งที่เปิดหน้า
        } catch { localStorage.removeItem(draftKey); }
      } else {
        setCurrentDrafts({});
        setPreviousDrafts({});
      }
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
    const readings: MeterReadingDraft[] = [];
    for (const row of touchedRows) {
      const previousText = row.previousReading ?? previousDrafts[row.room.id] ?? "";
      const currentText = currentDrafts[row.room.id] ?? "";
      const previous = previousText === "" ? undefined : Number(previousText);
      const current = Number(currentText);
      if (
        currentText === ""
        || !Number.isFinite(current)
        || current < 0
        // เลขล่าสุดต้องไม่น้อยกว่าเลขครั้งก่อน เพราะมิเตอร์เดินหน้าอย่างเดียว
        || (previous !== undefined && (!Number.isFinite(previous) || previous < 0 || current < previous))
      ) {
        throw new Error(`ห้อง ${row.room.number}: กรุณาระบุเลขมิเตอร์ให้ถูกต้อง และเลขล่าสุดต้องไม่น้อยกว่าเลขครั้งก่อน`);
      }
      readings.push({
        roomId: row.room.id,
        type: mode === "water" ? "WATER" : "ELECTRICITY",
        billingMonth,
        // ส่งเลขตั้งต้นไปเฉพาะห้องที่ยังไม่เคยมีในระบบ ห้องเดิมใช้เลขจากรอบก่อนที่เซิร์ฟเวอร์มีอยู่แล้ว
        ...(row.previousReading === null && previous !== undefined ? { previousReading: previous } : {}),
        currentReading: current,
      });
    }
    return readings;
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
      <div className="meter-filter-bar">
        <DropdownField
          label="อาคาร"
          // เปลี่ยนอาคารแล้วรีเซ็ตชั้นกับหน้าด้วย ไม่งั้นจะค้างชั้นของอาคารเดิมแล้วผลลัพธ์ว่าง
          onChange={(value) => { setBuilding(value); setFloor("all"); setPage(1); }}
          options={[
            { value: "all", label: "ทุกอาคาร" },
            ...buildings.map(([value, label]) => ({ value, label })),
          ]}
          value={building}
        />
        <DropdownField
          label="ชั้น"
          onChange={(value) => { setFloor(value); setPage(1); }}
          options={[
            { value: "all", label: "ทุกชั้น" },
            ...floors.map((item) => ({ value: String(item), label: `ชั้น ${item}` })),
          ]}
          value={floor}
        />
        <label>
          รอบมิเตอร์
          <input
            aria-label="รอบเดือนบันทึกมิเตอร์"
            max={currentMonth}
            onChange={(event) => {
              setBillingMonth(event.target.value);
              setPage(1);
            }}
            type="month"
            value={billingMonth}
          />
        </label>
        <label className="meter-search">
          <Search size={16} />
          <input
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="ค้นหาห้องหรือผู้เช่า..."
            value={query}
          />
        </label>
      </div>

      <article className="meter-table-card">
        <div className="additional-card-head">
          <div><h2>{mode === "water" ? "รายการมิเตอร์น้ำ" : "รายการมิเตอร์ไฟ"}</h2><p>ระบบเก็บฉบับร่างในเครื่องอัตโนมัติ · กด Enter เพื่อไปห้องถัดไป</p></div>
          <PageHeaderActions>
          {!readOnly ? (
          <div className="disabled-action">
            <button aria-describedby={!isLoading && !isSaving && touchedRows.length === 0 ? "meter-save-disabled-reason" : undefined} className="primary-button" disabled={isLoading || isSaving || touchedRows.length === 0} onClick={requestConfirmation} type="button">
              {isSaving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
              {isSaving ? "กำลังบันทึกทั้งชุด..." : `ตรวจสอบและบันทึก ${touchedRows.length} ห้อง`}
            </button>
            {!isLoading && !isSaving && touchedRows.length === 0 ? <p className="disabled-reason" id="meter-save-disabled-reason">กรอกเลขมิเตอร์ล่าสุดอย่างน้อย 1 ห้องก่อนบันทึก</p> : null}
          </div>
          ) : <ReadOnlyNotice compact />}
          </PageHeaderActions>
        </div>
        {readOnly ? <ReadOnlyNotice className="m-4">ดู ค้นหา และกรองข้อมูลมิเตอร์ได้ แต่ไม่สามารถกรอกหรือบันทึกเลขมิเตอร์ใหม่ได้</ReadOnlyNotice> : null}
        {loadError ? <div className="dashboard-empty-state" role="alert">{loadError}</div> : null}
        {isLoading ? (
          <LoadingSkeleton columns={8} count={6} label="กำลังโหลดข้อมูลมิเตอร์" variant="table" />
        ) : visibleRows.length === 0 && (query.trim() || building !== "all" || floor !== "all") ? (
          <SearchEmptyState description="ลองเปลี่ยนคำค้นหา อาคาร หรือชั้น" title="ไม่พบห้องพักตามเงื่อนไข" />
        ) : visibleRows.length === 0 ? (
          <div className="dashboard-empty-state">ยังไม่มีห้องพักสำหรับบันทึกมิเตอร์</div>
        ) : (
          <div className="figma-table-wrap">
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
                {pageItems.map((row) => {
                  const previousText = row.previousReading ?? previousDrafts[row.room.id] ?? "";
                  const latestText = currentDrafts[row.room.id] ?? row.currentReading ?? previousText;
                  const previous = Number(previousText);
                  const latest = Number(latestText);
                  const validReadings = previousText !== "" && latestText !== ""
                    && Number.isFinite(previous) && Number.isFinite(latest) && latest >= previous;
                  const units = validReadings ? latest - previous : 0;
                  const unitRate = Number(row.unitRate);
                  const amount = units * unitRate;
                  // เตือนเมื่อใช้เกินสองเท่าของรอบก่อน หรือเกินรอบก่อน 10 หน่วย เอาเกณฑ์ที่สูงกว่า
                  // เงื่อนไข +10 กันเตือนพร่ำเพรื่อกับห้องที่ใช้น้อยมาก เช่นจาก 1 เป็น 3 หน่วย
                  const abnormal = validReadings && row.previousUsage !== null && row.previousUsage > 0
                    && units > Math.max(row.previousUsage * 2, row.previousUsage + 10);
                  // ใช้หาแถวถัดไป เพื่อให้กด Enter แล้วกระโดดไปกรอกห้องต่อไปได้เลย
                  const rowIndex = pageItems.findIndex((item) => item.room.id === row.room.id);
                  return (
                    <tr key={row.room.id}>
                      <td>
                        <strong>{row.room.number}</strong>
                        <small className="block">{row.room.building.code} · ชั้น {row.room.floor.number}</small>
                      </td>
                      <td>{row.tenantName ?? "-"}</td>
                      <td>
                        {row.previousReading !== null ? previous.toLocaleString("th-TH") : readOnly ? "-" : (
                          <input
                            aria-label={`เลขมิเตอร์ตั้งต้นห้อง ${row.room.number}`}
                            // ล็อกแถวที่บันทึกไปแล้ว ต้องไปแก้ที่หน้าประวัติแทน
                            disabled={Boolean(row.readingId)}
                            min={0}
                            onChange={(event) => setPreviousDrafts((current) => ({
                              ...current,
                              [row.room.id]: event.target.value,
                            }))}
                            placeholder="กรอกครั้งแรก"
                            type="number"
                            value={previousDrafts[row.room.id] ?? ""}
                          />
                        )}
                      </td>
                      <td>
                        {readOnly ? (row.currentReading === null ? "-" : Number(row.currentReading).toLocaleString("th-TH")) : <input
                          aria-label={`เลขมิเตอร์ล่าสุดห้อง ${row.room.number}`}
                          disabled={Boolean(row.readingId)}
                          min={previousText || 0}
                          onChange={(event) => setCurrentDrafts((current) => ({
                            ...current,
                            [row.room.id]: event.target.value,
                          }))}
                          // Enter กระโดดไปห้องถัดไป คนจดมิเตอร์จะได้ไม่ต้องละมือไปจับเมาส์
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            const next = pageItems[rowIndex + 1];
                            if (next) inputRefs.current[next.room.id]?.focus();
                          }}
                          placeholder={previousText || "เลขล่าสุด"}
                          ref={(element) => { inputRefs.current[row.room.id] = element; }}
                          type="number"
                          value={latestText}
                        />}
                      </td>
                      <td><span className={abnormal ? "font-black text-amber-600" : ""}>{units.toLocaleString("th-TH")}</span>{abnormal ? <small className="mt-1 flex items-center gap-1 text-amber-600"><AlertTriangle size={13} /> สูงกว่ารอบก่อนผิดปกติ ({row.previousUsage?.toLocaleString("th-TH")} หน่วย)</small> : null}</td>
                      <td>฿{unitRate.toLocaleString("th-TH")}</td>
                      <td><strong>฿{amount.toLocaleString("th-TH")}</strong></td>
                      <td>
                        <span className={row.readingId ? "badge badge-paid" : abnormal ? "badge bg-amber-100 text-amber-800" : "badge badge-pending"}>
                          {abnormal ? <AlertTriangle size={13} /> : <Check size={13} />} {row.readingId ? "บันทึกแล้ว" : abnormal ? "โปรดตรวจสอบ" : "รอบันทึก"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
