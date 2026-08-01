import { PublicShell } from "@/components/site-shell";
import { LocalBusinessStructuredData } from "@/components/structured-data";
import { PublicContentService } from "@/server/services/public-content.service";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const company = await new PublicContentService().getCompany();
  return <><LocalBusinessStructuredData company={company} /><PublicShell company={company}>{children}</PublicShell></>;
}
