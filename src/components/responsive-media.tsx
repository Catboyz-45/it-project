type MediaRef = { id: string; altText?: string | null; width?: number | null; height?: number | null };
export function ResponsiveMedia({ media, fallbackClass = "mint", className = "", priority = false }: { media?: MediaRef | null; fallbackClass?: string; className?: string; priority?: boolean }) {
  if (!media) return <div className={`media ${fallbackClass} ${className}`} role="img" aria-label="ยังไม่มีรูปภาพ" />;
  const alt = media.altText?.trim() ?? "";
  // These routes already serve generated WebP/AVIF derivatives at requested widths.
  return <picture className={`responsive-media ${className}`}><source type="image/avif" srcSet={[320, 640, 1280, 1920].map(width => `/api/media/${media.id}?format=avif&width=${width} ${width}w`).join(", ")} /><source type="image/webp" srcSet={[320, 640, 1280, 1920].map(width => `/api/media/${media.id}?format=webp&width=${width} ${width}w`).join(", ")} /><img src={`/api/media/${media.id}?format=webp&width=1280`} alt={alt} width={media.width ?? 1280} height={media.height ?? 720} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} /></picture>;
}
