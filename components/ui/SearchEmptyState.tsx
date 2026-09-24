import { SearchX } from "lucide-react";

type SearchEmptyStateProps = {
  description?: string;
  title: string;
};

// ใช้ตอนค้นหาแล้วไม่เจอ ต่างจาก empty-state ทั่วไปที่แปลว่ายังไม่มีข้อมูลเลย
export function SearchEmptyState({ description, title }: Readonly<SearchEmptyStateProps>) {
  return (
    // role + aria-live ให้โปรแกรมอ่านหน้าจอประกาศว่าค้นแล้วไม่เจอ ไม่ใช่เงียบไปเฉย ๆ
    // ไม่ใช้ output เพราะข้างในมี div กับ p ซึ่ง output ไม่ให้ใส่ตามสเปก HTML
    <div aria-live="polite" className="search-empty-state" role="status">
      {/* ไอคอนเป็นของประดับ ข้อความข้าง ๆ บอกความหมายอยู่แล้ว */}
      <SearchX aria-hidden="true" size={30} strokeWidth={2} />
      <div>
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}
