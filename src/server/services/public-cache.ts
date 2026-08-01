import "server-only";
import { revalidateTag } from "next/cache";
import type { ContentKind } from "@/server/cms/schemas";

export function invalidatePublicContent(kind?: ContentKind) {
  revalidateTag("public-content", "max");
  if (kind) revalidateTag(kind, "max");
}
