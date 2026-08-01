"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const data = { title, text: title, url: window.location.href };
    if (navigator.share) { await navigator.share(data).catch(() => undefined); return; }
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };
  return <button className="btn btn-outline" type="button" onClick={share}>{copied ? <Check size={17} /> : <Share2 size={17} />}{copied ? "คัดลอกลิงก์แล้ว" : "แชร์บทความ"}</button>;
}
