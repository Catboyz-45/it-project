import { Leaf } from "lucide-react";

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark"><Leaf size={18} aria-hidden="true" /></span>
      <span className="brand-copy">
        <strong style={{ color: inverse ? "white" : undefined }}>อยู่เย็นเป็นสุข</strong>
        <span style={{ color: inverse ? "rgba(255,255,255,.58)" : undefined }}>วิศวกรรม จำกัด</span>
      </span>
    </span>
  );
}
