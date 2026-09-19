type LoadingSkeletonProps = {
  // จำนวนแถวหลอกที่จะวาง ควรใกล้เคียงจำนวนจริงที่มักโหลดมา
  count?: number;
  label?: string;
  // เลือกโครงให้ตรงกับของจริงที่กำลังจะมา หน้าจะได้ไม่กระตุกตอนข้อมูลมาถึง
  variant?: "cards" | "list" | "table";
};

// โครงร่างเทา ๆ ระหว่างรอข้อมูล แทนที่จะปล่อยหน้าว่างหรือขึ้นวงหมุน
export function LoadingSkeleton({
  count = 4,
  label = "กำลังโหลดข้อมูล",
  variant = "list",
}: LoadingSkeletonProps) {
  // สร้างแค่ลำดับตัวเลขไว้ใช้เป็น key ไม่ได้ใช้ค่าข้างในเลย
  const items = Array.from({ length: count }, (_, index) => index);

  return (
    // aria-busy บอกโปรแกรมอ่านหน้าจอว่ายังโหลดอยู่ อย่าเพิ่งอ่านเนื้อหาข้างใน
    <div aria-atomic="true" aria-busy="true" className={`loading-skeleton loading-skeleton-${variant}`} role="status">
      {/* ข้อความจริงสำหรับโปรแกรมอ่านหน้าจอ เพราะแท่งเทาไม่มีความหมายให้อ่าน */}
      <span className="sr-only">{label}</span>
      {variant === "table" ? (
        <>
          {/* แถวหัวตารางหลอก ตรึงไว้ 5 ช่องเพราะเป็นแค่โครง ไม่ต้องตรงกับจำนวนคอลัมน์จริง */}
          <div aria-hidden="true" className="loading-skeleton-table-head">
            {Array.from({ length: 5 }, (_, index) => <span key={index} />)}
          </div>
          {items.map((item) => (
            // aria-hidden ทุกแถว เพราะเป็นของประดับล้วน ๆ ให้อ่านแค่ label ข้างบนพอ
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
