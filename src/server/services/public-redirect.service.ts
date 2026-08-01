import "server-only";
import { permanentRedirect } from "next/navigation";
import { RedirectRepository } from "@/server/repositories/redirect.repository";

const allowed = /^\/(services|products|projects|news)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
export async function redirectOldSlug(fromPath: string, targetIsPublic: (slug: string) => Promise<unknown>) {
  if (!allowed.test(fromPath)) return;
  const repository = new RedirectRepository(); const record = await repository.findActive(fromPath);
  if (!record || !allowed.test(record.toPath) || record.toPath.split("/")[1] !== fromPath.split("/")[1]) return;
  const targetSlug = record.toPath.split("/").at(-1); if (!targetSlug || !(await targetIsPublic(targetSlug))) return;
  await repository.recordHit(record.id).catch(() => undefined); permanentRedirect(record.toPath);
}
