import type { Metadata } from "next";

const siteName = "อยู่เย็นเป็นสุข วิศวกรรม";

export function createMetadata({
  title,
  description,
  path,
  type = "website",
  image,
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  image?: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      locale: "th_TH",
      siteName,
      title: `${title} | ${siteName}`,
      description,
      url: path,
      images: [{ url: image ?? "/opengraph-image", width: 1200, height: 630, alt: `${title} — ${siteName}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteName}`,
      description,
      images: [image ?? "/opengraph-image"],
    },
  };
}
