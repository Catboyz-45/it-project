export class CmsError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID_TRANSITION" | "INVALID_MEDIA" | "IN_USE" | "FORBIDDEN", message: string) { super(message); }
}
