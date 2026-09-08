"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Super Admin Resource Tables” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Building2,
  Crown,
  Download,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { AccountApprovalActions } from "@/components/admin/AccountApprovalActions";
import { DropdownField } from "@/components/dorm/DropdownField";
import { IconButton } from "@/components/ui/IconButton";
import { Dialog } from "@/components/ui/Dialog";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { formatAuditAction, formatAuditResult } from "@/lib/ui-labels";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Page Info” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type PageInfo = {
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  total?: number;
  totalPages?: number;
};
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Property” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Property = {
  id: string;
  name: string;
  shortName: string;
  isActive: boolean;
};
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Admin” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Admin = {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvalRejectionReason: string | null;
  memberships: Array<{ property: { id: string; name: string } }>;
};
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Plan” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
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
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Audit Log” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type AuditLog = {
  id: string;
  action: string;
  result: string;
  createdAt: string;
  user: { email: string } | null;
  property: { name: string } | null;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Paginated Table” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { children, empty, endpoint, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function PaginatedTable<T>({
  children,
  empty,
  endpoint,
}: {
  children: (rows: T[]) => React.ReactNode;
  empty: string;
  endpoint: string;
}) {
  const [rows, setRows] = useState<T[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filter, setFilter] = useState("");
  const hasFilter = endpoint.endsWith("/users") || endpoint.endsWith("/audit-logs");

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - append: ค่า “append” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - signal: ค่า “signal” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const load = useCallback(
    async (page: number, append: boolean, signal?: AbortSignal) => {
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setError("");
      try {
        const search = new URLSearchParams({
          page: String(page),
          pageSize: "20",
        });
        if (debouncedQuery) search.set("query", debouncedQuery);
        if (filter) search.set(endpoint.endsWith("/users") ? "approvalStatus" : "result", filter);
        const response = await fetch(`${endpoint}?${search}`, {
          cache: "no-store",
          signal,
        });
        const payload = (await response.json()) as {
          data?: T[];
          pageInfo?: PageInfo;
          error?: string;
        };
        if (!response.ok || !payload.data || !payload.pageInfo)
          throw new Error(payload.error || "โหลดข้อมูลไม่สำเร็จ");
        setRows(payload.data!);
        setPageInfo(payload.pageInfo);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        setError(
          cause instanceof Error ? cause.message : "โหลดข้อมูลไม่สำเร็จ",
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [debouncedQuery, endpoint, filter],
  );

  useEffect(() => {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “timer” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
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
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#73757d]"
            size={17}
          />
          <input
            className="w-full pl-10"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหารายการ..."
            value={query}
          />
        </label>
        {endpoint.endsWith("/users") ? (
          <div className="admin-table-filter">
            <DropdownField
              ariaLabel="กรองสถานะอนุมัติ"
              onChange={setFilter}
              options={[
                { value: "", label: "ทุกสถานะ" },
                { value: "PENDING", label: "รออนุมัติ" },
                { value: "APPROVED", label: "อนุมัติแล้ว" },
                { value: "REJECTED", label: "ไม่อนุมัติ" },
              ]}
              value={filter}
            />
          </div>
        ) : null}
        {endpoint.endsWith("/audit-logs") ? (
          <div className="admin-table-filter">
            <DropdownField
              ariaLabel="กรองผลลัพธ์ Audit Log"
              onChange={setFilter}
              options={[
                { value: "", label: "ทุกผลลัพธ์" },
                { value: "SUCCESS", label: "สำเร็จ" },
                { value: "FAILURE", label: "ไม่สำเร็จ" },
              ]}
              value={filter}
            />
          </div>
        ) : null}
        <a
          className="secondary-button admin-table-export"
          download
          href={`${endpoint}/export?query=${encodeURIComponent(debouncedQuery)}`}
        >
          <Download size={16} /> CSV
        </a>
      </div>
      {isLoading ? (
        <div className="document-editor-state">
          <LoaderCircle className="animate-spin" /> กำลังโหลด...
        </div>
      ) : null}
      {error ? (
        <p className="form-alert error" role="alert">
          {error}
        </p>
      ) : null}
      {!isLoading &&
        (rows.length ? (
          children(rows)
        ) : debouncedQuery || filter ? (
          <SearchEmptyState description="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" title="ไม่พบรายการตามเงื่อนไข" />
        ) : (
          <p className="p-8 text-center text-[#62646c]">{empty}</p>
        ))}
      {pageInfo ? (
        <>
        <LiveAnnouncement message={isLoading
          ? `กำลังโหลดหน้า ${pageInfo.page.toLocaleString("th-TH")}`
          : `พบ ${(pageInfo.total ?? rows.length).toLocaleString("th-TH")} รายการ กำลังแสดงหน้า ${pageInfo.page.toLocaleString("th-TH")} จาก ${(pageInfo.totalPages ?? (pageInfo.hasNextPage ? pageInfo.page + 1 : pageInfo.page)).toLocaleString("th-TH")} หน้า`} />
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

const approvalLabels = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
} as const;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Super Admin Resource” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type SuperAdminResource =
  "plans" | "properties" | "accounts" | "audit-logs";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Super Admin Resource Tables” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { accountAction, propertyAction, resources = ["plans", "prop: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function SuperAdminResourceTables({
  accountAction,
  propertyAction,
  resources = ["plans", "properties", "accounts", "audit-logs"],
}: {
  accountAction?: React.ReactNode;
  propertyAction?: React.ReactNode;
  resources?: SuperAdminResource[];
}) {
  const [editingPlan, setEditingPlan] = useState<Plan | "new" | null>(null);
  return (
    <>
      {resources.includes("plans") ? (
        <ResourceSection
          action={
            <button
              className="primary-button"
              onClick={() => setEditingPlan("new")}
              type="button"
            >
              <Plus size={16} /> สร้างแพ็กเกจ
            </button>
          }
          icon={<Crown className="text-brand-green" />}
          subtitle="ราคา ขีดจำกัด และจำนวนสมาชิก"
          title="แพ็กเกจ SaaS"
        >
          <PaginatedTable<Plan>
            empty="ยังไม่มีแพ็กเกจ"
            endpoint="/api/v1/super-admin/plans"
          >
            {(plans) => (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>แพ็กเกจ</th>
                      <th>รายเดือน</th>
                      <th>รายปี</th>
                      <th>ห้องสูงสุด</th>
                      <th>สมาชิก</th>
                      <th>สถานะ</th>
                      <th>จัดการ</th>
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
        <ResourceSection
          action={propertyAction}
          icon={<Building2 className="text-brand-green" />}
          subtitle="พื้นที่ในแพลตฟอร์ม"
          title="หอพักทั้งหมด"
        >
          <PaginatedTable<Property>
            empty="ยังไม่มีหอพัก"
            endpoint="/api/v1/super-admin/properties"
          >
            {(properties) => (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>ชื่อ</th>
                      <th>ชื่อย่อ</th>
                      <th>สถานะ</th>
                      <th>รายละเอียด</th>
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
        <ResourceSection
          action={accountAction}
          icon={<UsersRound className="text-brand-cyan" />}
          subtitle="บัญชีและขอบเขตที่รับผิดชอบ"
          title="แอดมินประจำหอ"
        >
          <PaginatedTable<Admin>
            empty="ยังไม่มีบัญชี"
            endpoint="/api/v1/super-admin/users"
          >
            {(admins) => (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>ชื่อ</th>
                      <th>อีเมล</th>
                      <th>หอที่ดูแล</th>
                      <th>การอนุมัติ</th>
                      <th>การใช้งาน</th>
                      <th>จัดการ</th>
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
        <ResourceSection
          icon={<Activity className="text-brand-magenta" />}
          subtitle="ติดตามเหตุการณ์สำคัญทั้งหมด"
          title="Audit Log"
        >
          <PaginatedTable<AuditLog>
            empty="ยังไม่มีรายการ"
            endpoint="/api/v1/super-admin/audit-logs"
          >
            {(logs) => (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>เวลา</th>
                      <th>ผู้ใช้</th>
                      <th>หอพัก</th>
                      <th>เหตุการณ์</th>
                      <th>ผลลัพธ์</th>
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Plan Editor” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { plan, onClose, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function PlanEditor({
  plan,
  onClose,
}: {
  plan: Plan | "new";
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “submit” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = {
      ...(plan === "new"
        ? {
            code: String(form.get("code")),
            allowPromptPay: true,
            allowFileUploads: true,
            allowPrioritySupport: false,
            sortOrder: 0,
          }
        : {}),
      name: String(form.get("name")),
      monthlyPrice: Number(form.get("monthlyPrice")),
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
    <Dialog ariaDescribedBy="plan-editor-description" ariaLabelledBy="plan-editor-title" onClose={onClose}>
        <header className="modal-header">
          <div><h2 id="plan-editor-title">{plan === "new" ? "สร้างแพ็กเกจ" : "แก้ไขแพ็กเกจ"}</h2><p id="plan-editor-description">กำหนดราคาและขีดจำกัดการใช้งานของแพ็กเกจ</p></div>
          <IconButton label="ปิด" onClick={onClose} tooltip="ปิดหน้าต่างแพ็กเกจ"><X /></IconButton>
        </header>
        <form className="modal-form" onSubmit={submit}>
          <label>
            รหัส
            <input
              defaultValue={plan === "new" ? "" : plan.code}
              disabled={plan !== "new"}
              name="code"
              required
            />
          </label>
          <label>
            ชื่อ
            <input
              defaultValue={plan === "new" ? "" : plan.name}
              name="name"
              required
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              ราคารายเดือน
              <input
                defaultValue={plan === "new" ? "" : plan.monthlyPrice}
                min="0"
                name="monthlyPrice"
                required
                type="number"
              />
            </label>
            <label>
              ราคารายปี
              <input
                defaultValue={plan === "new" ? "" : (plan.yearlyPrice ?? "")}
                min="0"
                name="yearlyPrice"
                type="number"
              />
            </label>
            <label>
              จำนวนหอสูงสุด
              <input
              defaultValue={plan === "new" ? 1 : plan.maxProperties}
                min="1"
                name="maxProperties"
                required
                type="number"
              />
            </label>
            <label>
              จำนวนห้องสูงสุด
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Resource Section” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { action, children, icon, subtitle, title, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function ResourceSection({
  action,
  children,
  icon,
  subtitle,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  icon: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="panel overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-[#e3e4e8] p-5">
        {icon}
        <div className="flex-1">
          <h2 className="text-xl font-black">{title}</h2>
          <p className="text-sm text-[#62646c]">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
