"use client";
// โหลดข้อมูลทีละหน้าและเก็บตัวกรองไว้ฝั่งเบราว์เซอร์

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Inbox,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { AccountApprovalActions } from "@/components/admin/AccountApprovalActions";
import { DropdownField } from "@/components/dorm/DropdownField";
import { IconButton } from "@/components/ui/IconButton";
import { Dialog } from "@/components/ui/Dialog";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { formatAuditAction, formatAuditResult } from "@/lib/ui-labels";

type PageInfo = {
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  total?: number;
  totalPages?: number;
};
type Property = {
  id: string;
  name: string;
  shortName: string;
  isActive: boolean;
};
type Admin = {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvalRejectionReason: string | null;
  memberships: Array<{ property: { id: string; name: string } }>;
};
type Plan = {
  id: string;
  code: string;
  name: string;
  monthlyPrice: string;
  yearlyPrice: string | null;
  maxProperties: number;
  maxRooms: number;
  isActive: boolean;
  _count: { subscriptions: number };
};
type AuditLog = {
  id: string;
  action: string;
  result: string;
  createdAt: string;
  user: { email: string } | null;
  property: { name: string } | null;
};

// ตารางที่โหลดทีละหน้า ค้นหาได้ และกรองได้ ใช้ร่วมกันทั้งสี่ตารางในหน้าผู้ดูแลระบบ
// generic เพราะแต่ละตารางมีรูปแบบข้อมูลต่างกัน แต่วิธีโหลดกับแบ่งหน้าเหมือนกันหมด
// ชื่อพารามิเตอร์ของตัวกรองต่างกันตาม endpoint บัญชีกรองด้วยสถานะอนุมัติ ส่วน audit log กรองด้วยผลลัพธ์
function filterParamOf(endpoint: string) {
  return endpoint.endsWith("/users") ? "approvalStatus" : "result";
}

async function requestTablePage<T>({ debouncedQuery, endpoint, filter, page, signal }: {
  debouncedQuery: string;
  endpoint: string;
  filter: string;
  page: number;
  signal?: AbortSignal;
}) {
  const search = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (debouncedQuery) search.set("query", debouncedQuery);
  if (filter) search.set(filterParamOf(endpoint), filter);
  const response = await fetch(`${endpoint}?${search}`, { cache: "no-store", signal });
  const payload = await response.json() as { data?: T[]; pageInfo?: PageInfo; error?: string };
  if (!response.ok || !payload.data || !payload.pageInfo) throw new Error(payload.error || "โหลดข้อมูลไม่สำเร็จ");
  return { data: payload.data, pageInfo: payload.pageInfo };
}

// สองตารางนี้เท่านั้นที่มีช่องกรอง ดูจาก endpoint แทนการส่ง prop เพิ่ม
function TableFilterField({ endpoint, onChange, value }: Readonly<{ endpoint: string; onChange: (value: string) => void; value: string }>) {
  if (endpoint.endsWith("/users")) {
    return <div className="admin-table-filter">
      <DropdownField
        ariaLabel="กรองสถานะอนุมัติ"
        onChange={onChange}
        options={[
          { value: "", label: "ทุกสถานะ" },
          { value: "PENDING", label: "รออนุมัติ" },
          { value: "APPROVED", label: "อนุมัติแล้ว" },
          { value: "REJECTED", label: "ไม่อนุมัติ" },
        ]}
        value={value}
      />
    </div>;
  }
  if (endpoint.endsWith("/audit-logs")) {
    return <div className="admin-table-filter">
      <DropdownField
        ariaLabel="กรองผลลัพธ์ Audit Log"
        onChange={onChange}
        options={[
          { value: "", label: "ทุกผลลัพธ์" },
          { value: "SUCCESS", label: "สำเร็จ" },
          { value: "FAILURE", label: "ไม่สำเร็จ" },
        ]}
        value={value}
      />
    </div>;
  }
  return null;
}

// มีรายการก็ให้ผู้เรียกวาดเอง ไม่มีก็แยกว่าค้นไม่เจอหรือยังไม่มีข้อมูลเลย
function TableRows<T>({ children, empty, emptyDescription, hasCriteria, rows }: Readonly<{
  children: (rows: T[]) => React.ReactNode;
  empty: string;
  emptyDescription?: string;
  hasCriteria: boolean;
  rows: T[];
}>) {
  if (rows.length) return <>{children(rows)}</>;
  if (hasCriteria) return <SearchEmptyState description="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" title="ไม่พบรายการตามเงื่อนไข" />;
  return <div className="empty-state m-6">
    <Inbox aria-hidden={true} size={20} />
    <strong>{empty}</strong>
    {emptyDescription ? <p>{emptyDescription}</p> : null}
  </div>;
}

function PaginatedTable<T>({
  action,
  children,
  columns,
  empty,
  emptyDescription,
  endpoint,
  initialPageInfo = null,
  initialRows = null,
}: Readonly<{
  action?: React.ReactNode;
  // รับเป็นฟังก์ชัน เพื่อให้ผู้เรียกเป็นคนตัดสินใจว่าจะวาดแต่ละแถวยังไง
  children: (rows: T[]) => React.ReactNode;
  // จำนวนคอลัมน์ของตารางที่กำลังจะมา ใช้วาดโครงหลอกให้ตรงกับของจริง
  columns: number;
  empty: string;
  emptyDescription?: string;
  endpoint: string;
  // ส่งมาจาก Server Component ของหน้านั้น มีแล้วก็ไม่ต้องยิงซ้ำตอนเปิดหน้า
  // ค้นหา กรอง และเปลี่ยนหน้ายังโหลดเองเหมือนเดิม
  initialPageInfo?: PageInfo | null;
  initialRows?: T[] | null;
}>) {
  const [rows, setRows] = useState<T[]>(initialRows ?? []);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(initialPageInfo ?? null);
  const [isLoading, setIsLoading] = useState(initialRows === null);
  const skipInitialLoadRef = useRef(initialRows !== null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filter, setFilter] = useState("");
  // สองตารางนี้เท่านั้นที่มีช่องกรอง ดูจาก endpoint แทนการส่ง prop เพิ่ม
  const hasFilter = endpoint.endsWith("/users") || endpoint.endsWith("/audit-logs");

  const load = useCallback(
    async (page: number, append: boolean, signal?: AbortSignal) => {
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setError("");
      try {
        const result = await requestTablePage<T>({ debouncedQuery, endpoint, filter, page, signal });
        setRows(result.data);
        setPageInfo(result.pageInfo);
      } catch (cause) {
        // ยกเลิกเองตอนผู้ใช้พิมพ์ต่อ ไม่ใช่ข้อผิดพลาดจริง ไม่ต้องขึ้นเตือนให้ตกใจ
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [debouncedQuery, endpoint, filter],
  );

  // หน่วง 300 มิลลิวินาทีหลังหยุดพิมพ์ แยกค่าที่หน่วงแล้วออกจากค่าที่พิมพ์อยู่
  // จะได้ช่องกรอกตอบสนองทันทีโดยที่ยังไม่ยิงคำขอ
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  // เปลี่ยนคำค้นหรือตัวกรองก็กลับไปหน้า 1 เสมอ พร้อมยกเลิกคำขอเก่าที่ยังค้าง
  useEffect(() => {
    // เซิร์ฟเวอร์ส่งหน้าแรกมาแล้ว รอบแรกจึงข้ามไป
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      return;
    }
    const controller = new AbortController();
    void load(1, false, controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <>
      <div className={`admin-table-toolbar ${hasFilter ? "has-filter" : ""}`}>
        <label className="admin-table-search">
          <span className="sr-only">ค้นหา</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#62646c]"
            size={17}
          />
          <input
            className="w-full pl-10"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหารายการ..."
            value={query}
          />
        </label>
        <TableFilterField endpoint={endpoint} onChange={setFilter} value={filter} />
        <div className="admin-table-actions">
        <a
          className="secondary-button admin-table-export"
          download
          href={`${endpoint}/export?query=${encodeURIComponent(debouncedQuery)}`}
        >
          <Download size={16} /> CSV
        </a>
          {/* ห่อไว้หนึ่งชั้นเพราะ action ถูกสร้างจาก Server Component แล้วส่งข้ามมาเป็น prop
              React ฝั่งเบราว์เซอร์จึงไม่รู้ว่ามันเป็นลูกที่อยู่ตำแหน่งตายตัวและเตือนเรื่อง key
              display: contents ทำให้กล่องนี้ไม่มีผลต่อการจัดวาง */}
          {action ? <span className="contents">{action}</span> : null}
        </div>
      </div>
      {/* โครงหลอกรูปตาราง ไม่ใช่วงหมุน คอลัมน์จะได้ไม่ขยับตอนข้อมูลมาถึง */}
      {isLoading ? <LoadingSkeleton columns={columns} count={5} label="กำลังโหลดข้อมูล" variant="table" /> : null}
      {error ? (
        <p className="form-alert error" role="alert">
          {error}
        </p>
      ) : null}
      {isLoading ? null : <TableRows
        empty={empty}
        emptyDescription={emptyDescription}
        hasCriteria={Boolean(debouncedQuery || filter)}
        rows={rows}
      >{children}</TableRows>}
      {pageInfo ? (
        <>
        <LiveAnnouncement message={tableAnnouncement({
          isLoading,
          page: pageInfo.page,
          total: pageInfo.total ?? rows.length,
          totalPages: pageInfo.totalPages ?? (pageInfo.hasNextPage ? pageInfo.page + 1 : pageInfo.page),
        })} />
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-[#62646c]">
          <span>
            ทั้งหมด {(pageInfo.total ?? rows.length).toLocaleString("th-TH")}{" "}
            รายการ
          </span>
          <div className="flex items-center gap-2">
            <button
              className="secondary-button"
              disabled={pageInfo.page <= 1 || isLoadingMore}
              onClick={() => void load(pageInfo.page - 1, false)}
              type="button"
            >
              ก่อนหน้า
            </button>
            <span>
              หน้า {pageInfo.page} /{" "}
              {pageInfo.totalPages ??
                (pageInfo.hasNextPage ? pageInfo.page + 1 : pageInfo.page)}
            </span>
            <button
              className="secondary-button"
              disabled={!pageInfo.hasNextPage || isLoadingMore}
              onClick={() => void load(pageInfo.page + 1, false)}
              type="button"
            >
              ถัดไป
            </button>
          </div>
        </div>
        </>
      ) : null}
    </>
  );
}

// as const ทำให้ TypeScript รู้ว่ามีแค่สามค่านี้ ไม่ใช่ string อะไรก็ได้
const approvalLabels = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
} as const;

export type SuperAdminResource =
  "plans" | "properties" | "accounts" | "audit-logs";

// ตารางข้อมูลหลักของผู้ดูแลระบบ แพ็กเกจ หอพัก บัญชี และ audit log
// แต่ละหน้าเลือกเอาเฉพาะตารางที่ต้องการผ่าน resources
// ข้อมูลตั้งต้นของแต่ละตาราง ส่งมาเฉพาะตารางที่หน้านั้นแสดงจริง
export type SuperAdminInitialTable = { pageInfo: PageInfo; rows: unknown[] };

export function SuperAdminResourceTables({
  accountAction,
  initialTables,
  propertyAction,
  resources = ["plans", "properties", "accounts", "audit-logs"],
}: Readonly<{
  accountAction?: React.ReactNode;
  initialTables?: Partial<Record<SuperAdminResource, SuperAdminInitialTable>> | null;
  propertyAction?: React.ReactNode;
  resources?: SuperAdminResource[];
}>) {
  const [editingPlan, setEditingPlan] = useState<Plan | "new" | null>(null);
  return (
    <>
      {resources.includes("plans") ? (
        <ResourceSection>
          <PaginatedTable<Plan>
            columns={7}
            initialPageInfo={initialTables?.["plans"]?.pageInfo ?? null}
            initialRows={(initialTables?.["plans"]?.rows as Plan[] | undefined) ?? null}
            action={
              <button
                className="primary-button"
                onClick={() => setEditingPlan("new")}
                type="button"
              >
                <Plus size={16} /> สร้างแพ็กเกจ
              </button>
            }
            empty="ยังไม่มีแพ็กเกจ" emptyDescription="สร้างแพ็กเกจแรกเพื่อเปิดให้หอพักสมัครใช้งาน"
            endpoint="/api/v1/super-admin/plans"
          >
            {(plans) => (
              <div className="figma-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">แพ็กเกจ</th>
                      <th scope="col">รายเดือน</th>
                      <th scope="col">รายปี</th>
                      <th scope="col">ห้องสูงสุด</th>
                      <th scope="col">สมาชิก</th>
                      <th scope="col">สถานะ</th>
                      <th scope="col">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => (
                      <tr key={plan.id}>
                        <td>
                          <strong>{plan.name}</strong>
                          <small className="block">{plan.code}</small>
                        </td>
                        <td>
                          ฿{Number(plan.monthlyPrice).toLocaleString("th-TH")}
                        </td>
                        <td>
                          {plan.yearlyPrice
                            ? `฿${Number(plan.yearlyPrice).toLocaleString("th-TH")}`
                            : "-"}
                        </td>
                        <td>{plan.maxRooms.toLocaleString("th-TH")}</td>
                        <td>{plan._count.subscriptions}</td>
                        <td>
                          <span
                            className={`badge ${plan.isActive ? "badge-paid" : ""}`}
                          >
                            {plan.isActive ? "เปิดขาย" : "ปิดขาย"}
                          </span>
                        </td>
                        <td>
                          <IconButton
                            label={`แก้ไข ${plan.name}`}
                            onClick={() => setEditingPlan(plan)}
                          >
                            <Pencil size={16} />
                          </IconButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PaginatedTable>
        </ResourceSection>
      ) : null}
      {resources.includes("properties") ? (
        <ResourceSection>
          <PaginatedTable<Property>
            columns={4}
            initialPageInfo={initialTables?.["properties"]?.pageInfo ?? null}
            initialRows={(initialTables?.["properties"]?.rows as Property[] | undefined) ?? null}
            action={propertyAction}
            empty="ยังไม่มีหอพัก" emptyDescription="หอพักที่เพิ่มเข้าระบบแล้วจะแสดงที่นี่"
            endpoint="/api/v1/super-admin/properties"
          >
            {(properties) => (
              <div className="figma-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">ชื่อ</th>
                      <th scope="col">ชื่อย่อ</th>
                      <th scope="col">สถานะ</th>
                      <th scope="col">รายละเอียด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {properties.map((item) => (
                      <tr key={item.id}>
                        <td className="font-bold">{item.name}</td>
                        <td>{item.shortName}</td>
                        <td>
                          <span
                            className={`badge ${item.isActive ? "badge-paid" : ""}`}
                          >
                            {item.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                          </span>
                        </td>
                        <td>
                          <Link
                            className="secondary-button"
                            href={`/super-admin/properties/${item.id}`}
                          >
                            เปิดดู
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PaginatedTable>
        </ResourceSection>
      ) : null}
      {resources.includes("accounts") ? (
        <ResourceSection>
          <PaginatedTable<Admin>
            columns={6}
            initialPageInfo={initialTables?.["accounts"]?.pageInfo ?? null}
            initialRows={(initialTables?.["accounts"]?.rows as Admin[] | undefined) ?? null}
            action={accountAction}
            empty="ยังไม่มีบัญชี" emptyDescription="บัญชีเจ้าของหอที่สร้างไว้จะแสดงที่นี่"
            endpoint="/api/v1/super-admin/users"
          >
            {(admins) => (
              <div className="figma-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">ชื่อ</th>
                      <th scope="col">อีเมล</th>
                      <th scope="col">หอที่ดูแล</th>
                      <th scope="col">การอนุมัติ</th>
                      <th scope="col">การใช้งาน</th>
                      <th scope="col">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin) => (
                      <tr key={admin.id}>
                        <td className="font-bold">{admin.displayName}</td>
                        <td>{admin.email}</td>
                        <td>
                          {admin.memberships
                            .map(({ property }) => property.name)
                            .join(", ")}
                        </td>
                        <td>
                          <span
                            className={`badge ${admin.approvalStatus === "APPROVED" ? "badge-paid" : ""}`}
                          >
                            {approvalLabels[admin.approvalStatus]}
                          </span>
                          {admin.approvalRejectionReason ? (
                            <small className="block">
                              {admin.approvalRejectionReason}
                            </small>
                          ) : null}
                        </td>
                        <td>
                          <span
                            className={`badge ${admin.isActive ? "badge-paid" : ""}`}
                          >
                            {admin.isActive ? "เปิดใช้งาน" : "ระงับ"}
                          </span>
                        </td>
                        <td>
                          <AccountApprovalActions
                            displayName={admin.displayName}
                            memberships={admin.memberships.map(({ property }) => property)}
                            status={admin.approvalStatus}
                            userId={admin.id}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PaginatedTable>
        </ResourceSection>
      ) : null}
      {resources.includes("audit-logs") ? (
        <ResourceSection>
          <PaginatedTable<AuditLog>
            columns={5}
            initialPageInfo={initialTables?.["audit-logs"]?.pageInfo ?? null}
            initialRows={(initialTables?.["audit-logs"]?.rows as AuditLog[] | undefined) ?? null}
            empty="ยังไม่มีรายการ" emptyDescription="เหตุการณ์สำคัญในระบบจะถูกบันทึกมาที่นี่"
            endpoint="/api/v1/super-admin/audit-logs"
          >
            {(logs) => (
              <div className="figma-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">เวลา</th>
                      <th scope="col">ผู้ใช้</th>
                      <th scope="col">หอพัก</th>
                      <th scope="col">เหตุการณ์</th>
                      <th scope="col">ผลลัพธ์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("th-TH")}
                        </td>
                        <td>{log.user?.email ?? "-"}</td>
                        <td>{log.property?.name ?? "-"}</td>
                        <td title={log.action}>
                          {formatAuditAction(log.action)}
                        </td>
                        <td>
                          <span
                            className={`badge ${log.result === "SUCCESS" ? "badge-paid" : ""}`}
                          >
                            {formatAuditResult(log.result)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PaginatedTable>
        </ResourceSection>
      ) : null}
      {editingPlan ? (
        <PlanEditor plan={editingPlan} onClose={() => setEditingPlan(null)} />
      ) : null}
    </>
  );
}

// กล่องสร้างและแก้ไขแพ็กเกจ ใช้ตัวเดียวกันทั้งสองงาน "new" แปลว่าสร้างใหม่
function PlanEditor({
  plan,
  onClose,
}: Readonly<{
  plan: Plan | "new";
  onClose: () => void;
}>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    // สร้างใหม่ต้องส่ง code กับค่าเริ่มต้นไปด้วย ส่วนแก้ไขส่ง isActive แทน เพราะ code เปลี่ยนไม่ได้
    const body = {
      ...(plan === "new"
        ? {
            code: formText(form, "code"),
            allowPromptPay: true,
            allowFileUploads: true,
            allowPrioritySupport: false,
            sortOrder: 0,
          }
        : {}),
      name: formText(form, "name"),
      monthlyPrice: Number(form.get("monthlyPrice")),
      // ปล่อยว่างได้ หมายถึงไม่เปิดขายรายปี ระบบจะคิดจากรายเดือนคูณ 12 ให้เอง
      yearlyPrice: form.get("yearlyPrice")
        ? Number(form.get("yearlyPrice"))
        : null,
      maxProperties: Number(form.get("maxProperties")),
      maxRooms: Number(form.get("maxRooms")),
      ...(plan === "new" ? {} : { isActive: form.get("isActive") === "on" }),
    };
    try {
      const response = await fetch(
        plan === "new"
          ? "/api/v1/super-admin/plans"
          : `/api/v1/super-admin/plans/${plan.id}`,
        {
          method: plan === "new" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "บันทึกไม่สำเร็จ");
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ");
      setPending(false);
    }
  }
  return (
    <Dialog ariaDescribedBy="plan-editor-description" ariaLabelledBy="plan-editor-title" className="modal-md" onClose={onClose}>
        <header className="modal-header">
          <div><h2 id="plan-editor-title">{plan === "new" ? "สร้างแพ็กเกจ" : "แก้ไขแพ็กเกจ"}</h2><p id="plan-editor-description">กำหนดราคาและขีดจำกัดการใช้งานของแพ็กเกจ</p></div>
          <IconButton label="ปิด" onClick={onClose} tooltip="ปิดหน้าต่างแพ็กเกจ"><X /></IconButton>
        </header>
        <form className="modal-form" onSubmit={submit}>
          <label>
            <span>รหัส</span>
            <input
              defaultValue={plan === "new" ? "" : plan.code}
              disabled={plan !== "new"}
              name="code"
              required
            />
          </label>
          <label>
            <span>ชื่อ</span>
            <input
              defaultValue={plan === "new" ? "" : plan.name}
              name="name"
              required
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span>ราคารายเดือน</span>
              <input
                defaultValue={plan === "new" ? "" : plan.monthlyPrice}
                min="0"
                name="monthlyPrice"
                required
                type="number"
              />
            </label>
            <label>
              <span>ราคารายปี</span>
              <input
                defaultValue={plan === "new" ? "" : (plan.yearlyPrice ?? "")}
                min="0"
                name="yearlyPrice"
                type="number"
              />
            </label>
            <label>
              <span>จำนวนหอสูงสุด</span>
              <input
              defaultValue={plan === "new" ? 1 : plan.maxProperties}
                min="1"
                name="maxProperties"
                required
                type="number"
              />
            </label>
            <label>
              <span>จำนวนห้องสูงสุด</span>
              <input
                defaultValue={plan === "new" ? "" : plan.maxRooms}
                min="1"
                name="maxRooms"
                required
                type="number"
              />
            </label>
          </div>
          {plan !== "new" ? (
            <label className="flex items-center gap-2">
              <input
                className="size-4 min-h-0"
                defaultChecked={plan.isActive}
                name="isActive"
                type="checkbox"
              />{" "}
              เปิดขายแพ็กเกจ
            </label>
          ) : null}
          {error ? <p className="form-alert error">{error}</p> : null}
          <footer className="modal-actions">
            <button onClick={onClose} type="button">
              ยกเลิก
            </button>
            <button className="primary-button" disabled={pending} type="submit">
              {pending ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </footer>
        </form>
    </Dialog>
  );
}

// กรอบของแต่ละตาราง แยกออกมาเพื่อให้ระยะห่างเท่ากันทุกตาราง
function ResourceSection({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <section className="panel overflow-hidden p-0">{children}</section>
  );
}

// ข้อความที่อ่านให้ผู้ใช้โปรแกรมอ่านหน้าจอฟัง บอกว่ากำลังโหลดหรือกำลังแสดงหน้าไหน
function tableAnnouncement({ isLoading, page, total, totalPages }: {
  isLoading: boolean;
  page: number;
  total: number;
  totalPages: number;
}) {
  const current = page.toLocaleString("th-TH");
  if (isLoading) return `กำลังโหลดหน้า ${current}`;
  return `พบ ${total.toLocaleString("th-TH")} รายการ กำลังแสดงหน้า ${current} จาก ${totalPages.toLocaleString("th-TH")} หน้า`;
}

// form.get คืนได้ทั้งสตริงและ File การ String() ตรง ๆ จะได้ "[object File]" ส่งขึ้นเซิร์ฟเวอร์
// ช่องพวกนี้เป็นช่องข้อความล้วน ค่าที่ไม่ใช่สตริงจึงถือว่าไม่ได้กรอก
function formText(form: FormData, field: string) {
  const value = form.get(field);
  return typeof value === "string" ? value : "";
}
