import { ContentStatus } from "@prisma/client";
const allowed: Record<ContentStatus, ContentStatus[]> = { DRAFT: [ContentStatus.PUBLISHED, ContentStatus.ARCHIVED], PUBLISHED: [ContentStatus.DRAFT, ContentStatus.ARCHIVED], ARCHIVED: [ContentStatus.DRAFT] };
export function retentionDate(now = new Date()) { return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); }
export function canTransition(from: ContentStatus, to: ContentStatus) { return from === to || allowed[from].includes(to); }
