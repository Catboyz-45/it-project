import { ImageResponse } from "next/og";

export const alt = "อยู่เย็นเป็นสุข วิศวกรรม — ระบบปรับอากาศและงาน M&E";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", padding: 80, color: "white", background: "#072d1e", fontFamily: "sans-serif", position: "relative" }}>
      <div style={{ position: "absolute", right: -120, top: -100, width: 560, height: 560, borderRadius: 999, border: "100px solid rgba(134,214,62,.12)" }} />
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 850 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26, color: "#bde990" }}>อยู่เย็นเป็นสุข วิศวกรรม จำกัด</div>
        <div style={{ marginTop: 36, display: "flex", flexDirection: "column", fontSize: 72, fontWeight: 800, lineHeight: 1.08 }}><span>เย็นสบาย มั่นใจได้</span><span>ในทุกพื้นที่ของคุณ</span></div>
        <div style={{ marginTop: 28, fontSize: 28, color: "rgba(255,255,255,.72)" }}>ระบบปรับอากาศ · งาน M&E · บริการดูแลครบวงจร</div>
      </div>
    </div>,
    size,
  );
}
