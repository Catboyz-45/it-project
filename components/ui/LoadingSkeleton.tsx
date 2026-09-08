/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Loading Skeleton” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Loading Skeleton Props” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type LoadingSkeletonProps = {
  count?: number;
  label?: string;
  variant?: "cards" | "list" | "table";
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Loading Skeleton” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { count = 4, label = "กำลังโหลดข้อมูล", variant = "list", }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function LoadingSkeleton({
  count = 4,
  label = "กำลังโหลดข้อมูล",
  variant = "list",
}: LoadingSkeletonProps) {
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “items” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - _: ค่า “” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - index: ค่า “index” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const items = Array.from({ length: count }, (_, index) => index);

  return (
    <div aria-atomic="true" aria-busy="true" className={`loading-skeleton loading-skeleton-${variant}`} role="status">
      <span className="sr-only">{label}</span>
      {variant === "table" ? (
        <>
          <div aria-hidden="true" className="loading-skeleton-table-head">
            {Array.from({ length: 5 }, (_, index) => <span key={index} />)}
          </div>
          {items.map((item) => (
            <div aria-hidden="true" className="loading-skeleton-table-row" key={item}>
              <span className="loading-skeleton-avatar" />
              <span />
              <span />
              <span />
              <span className="loading-skeleton-pill" />
            </div>
          ))}
        </>
      ) : items.map((item) => (
        <div aria-hidden="true" className="loading-skeleton-item" key={item}>
          <span className="loading-skeleton-avatar" />
          <div>
            <span />
            <span />
            <span />
          </div>
        </div>
      ))}
    </div>
  );
}
