function publicValue(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

export const companyPublicConfig = {
  name: "บริษัท อยู่เย็นเป็นสุข วิศวกรรม จำกัด",
  phoneDisplay: publicValue(process.env.NEXT_PUBLIC_COMPANY_PHONE_DISPLAY, "02-000-0000"),
  phoneHref: publicValue(process.env.NEXT_PUBLIC_COMPANY_PHONE_HREF, "+6620000000"),
  email: publicValue(process.env.NEXT_PUBLIC_COMPANY_EMAIL, "contact@example.co.th"),
  lineLabel: publicValue(process.env.NEXT_PUBLIC_COMPANY_LINE_LABEL, "@yuyenengineering"),
  lineUrl: process.env.NEXT_PUBLIC_COMPANY_LINE_URL?.trim() || null,
  facebookUrl: process.env.NEXT_PUBLIC_COMPANY_FACEBOOK_URL?.trim() || null,
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS?.trim() || null,
  mapsUrl: process.env.NEXT_PUBLIC_COMPANY_MAPS_URL?.trim() || null,
  mapsEmbedUrl: process.env.NEXT_PUBLIC_COMPANY_MAPS_EMBED_URL?.trim() || null,
  businessHours: "จันทร์–เสาร์ 08:00–17:00 น.",
  isPlaceholder: !process.env.NEXT_PUBLIC_COMPANY_ADDRESS,
} as const;
