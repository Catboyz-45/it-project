"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="th"><body><main style={{ maxWidth: 640, margin: "15vh auto", padding: 24, fontFamily: "sans-serif" }}><h1>ระบบขัดข้องชั่วคราว</h1><p>กรุณาลองอีกครั้ง หากปัญหายังคงอยู่ให้แจ้งผู้ดูแลพร้อมเวลาที่เกิดเหตุ</p><button onClick={reset}>ลองอีกครั้ง</button></main></body></html>;
}
