import type { Metadata } from "next";

export const metadata: Metadata = { title: "เมนู", robots: { index: false, follow: false } };

export default function MenuLayout({ children }: { children: React.ReactNode }) { return children; }
