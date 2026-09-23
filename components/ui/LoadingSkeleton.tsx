import type { CSSProperties } from "react";

type LoadingSkeletonProps = {
  // จำนวนคอลัมน์ของตารางจริงที่กำลังจะมา ใส่ให้ตรงกันโครงหลอกจะได้ไม่ขยับตอนข้อมูลมาถึง
  columns?: number;
  // จำนวนแถวหลอกที่จะวาง ควรใกล้เคียงจำนวนจริงที่มักโหลดมา
  count?: number;
  label?: string;
  // ชื่อคลาสของตารางจริง เช่น tenant-table ใช้ความกว้างคอลัมน์ชุดเดียวกับของจริง
  // ไม่ส่งมาก็แบ่งคอลัมน์เท่า ๆ กันตามจำนวนที่บอก
  tableClassName?: string;
  // เลือกโครงให้ตรงกับของจริงที่กำลังจะมา หน้าจะได้ไม่กระตุกตอนข้อมูลมาถึง
  variant?: "cards" | "list" | "table";
};

// โครงร่างเทา ๆ ระหว่างรอข้อมูล แทนที่จะปล่อยหน้าว่างหรือขึ้นวงหมุน
export function LoadingSkeleton({
  columns = 5,
  count = 4,
  label = "กำลังโหลดข้อมูล",
  tableClassName,
  variant = "list",
}: LoadingSkeletonProps) {
  // สร้างแค่ลำดับตัวเลขไว้ใช้เป็น key ไม่ได้ใช้ค่าข้างในเลย
  const items = Array.from({ length: count }, (_, index) => index);
  const columnIndexes = Array.from({ length: columns }, (_, index) => index);
  // ตารางที่มีคลาสของตัวเองมีความกว้างคอลัมน์กำหนดไว้ใน CSS แล้ว ไม่ต้องทับ
  const gridStyle: CSSProperties | undefined = tableClassName
    ? undefined
    : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };

  return (
    // aria-busy บอกโปรแกรมอ่านหน้าจอว่ายังโหลดอยู่ อย่าเพิ่งอ่านเนื้อหาข้างใน
    <div aria-atomic="true" aria-busy="true" className={`loading-skeleton loading-skeleton-${variant}`} role="status">
      {/* ข้อความจริงสำหรับโปรแกรมอ่านหน้าจอ เพราะแท่งเทาไม่มีความหมายให้อ่าน */}
      <span className="sr-only">{label}</span>
      {variant === "table" ? (
        // ใช้โครงเดียวกับตารางจริงทั้งกล่องและคลาส ความสูงกับความกว้างจึงตรงกันตั้งแต่ยังไม่มีข้อมูล
        <div aria-hidden="true" className="figma-table-wrap">
          <table className={`figma-table ${tableClassName ?? ""}`.trim()}>
            <thead>
              <tr className="figma-table-head" style={gridStyle}>
                {columnIndexes.map((column) => <th key={column}><span /></th>)}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr className="figma-table-row" key={item} style={gridStyle}>
                  {columnIndexes.map((column) => <td key={column}><span /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : items.map((item) => (
        <div aria-hidden="true" className="loading-skeleton-item" key={item}>
          <span className="loading-skeleton-avatar" />
          <div>
            {/* สามแท่งยาวไม่เท่ากัน ให้ดูเหมือนข้อความจริงมากกว่าแท่งเท่ากันหมด */}
            <span />
            <span />
            <span />
          </div>
        </div>
      ))}
    </div>
  );
}
