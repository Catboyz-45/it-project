/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React public-filter-feedback ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, Search, X } from "lucide-react";
import {
  createContext,
  FormEvent,
  useContext,
  useEffect,
  useState,
} from "react";

const FilterPendingContext = createContext(false);

/** สร้างส่วนหน้าจอ PublicFilterForm; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function PublicFilterForm({
  action,
  children,
}: {
  action: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setPending(false), 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const parameters = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget))
      parameters.append(key, String(value));
    setPending(true);
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => resolve()),
    );
    router.push(`${action}?${parameters.toString()}`, { scroll: false });
  };
  return (
    <FilterPendingContext.Provider value={pending}>
      <form
        className="filters"
        action={action}
        onSubmit={submit}
        aria-busy={pending}
      >
        {children}
      </form>
    </FilterPendingContext.Provider>
  );
}

/** สร้างส่วนหน้าจอ PublicFilterSubmit; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function PublicFilterSubmit() {
  const pending = useContext(FilterPendingContext);
  return (
    <button
      className="btn btn-dark filter-submit"
      type="submit"
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? (
        <LoaderCircle className="spin" size={17} aria-hidden="true" />
      ) : (
        <Search size={17} aria-hidden="true" />
      )}
      {pending ? "กำลังค้นหา…" : "ค้นหา"}
      <span className="sr-only" role="status" aria-live="polite">
        {pending ? "กำลังค้นหาและกรองข้อมูล กรุณารอสักครู่" : ""}
      </span>
    </button>
  );
}

/** สร้างส่วนหน้าจอ ClearPublicFilters; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function ClearPublicFilters({ href }: { href: string }) {
  return (
    <Link
      className="btn btn-ghost clear-filters"
      href={href}
      scroll={false}
      aria-label="ล้างคำค้นหาและตัวกรองทั้งหมด"
    >
      <X size={16} aria-hidden="true" /> ล้างตัวกรอง
    </Link>
  );
}

/** สร้างส่วนหน้าจอ PublicResultCount; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function PublicResultCount({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="muted filter-result-count"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {children}
    </p>
  );
}
