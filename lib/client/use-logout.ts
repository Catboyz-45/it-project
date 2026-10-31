"use client";
// ออกจากระบบจากฝั่งเบราว์เซอร์ ใช้ร่วมกันทั้งเมนูบัญชีท้ายแถบข้าง และเมนู "เพิ่มเติม" บนมือถือของผู้เช่า

import { useCallback, useState } from "react";

export function useLogout() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = useCallback(async () => {
    // กันกดซ้ำระหว่างรอเซิร์ฟเวอร์ตอบ จะได้ไม่ยิงลบ session สองรอบ
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      // ต้องเป็น POST เพราะเป็นการเปลี่ยนสถานะ เซิร์ฟเวอร์จะได้ลบ session และล้างคุกกี้
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      // ให้เซิร์ฟเวอร์เป็นคนบอกปลายทาง เพราะแต่ละบทบาทกลับไปคนละหน้า
      const result = await response.json() as { redirectTo?: string };
      // assign ไม่ใช่ router.push เพื่อให้โหลดหน้าใหม่ทั้งหมด ข้อมูลของผู้ใช้เดิมจะได้ไม่ค้างในหน่วยความจำ
      window.location.assign(result.redirectTo || "/login");
    } catch {
      // ต่อเน็ตไม่ติดก็ปลดล็อกปุ่มให้กดใหม่ได้ ไม่ปล่อยค้างว่ากำลังออกจากระบบ
      setIsLoggingOut(false);
    }
  }, [isLoggingOut]);

  return { isLoggingOut, logout };
}
