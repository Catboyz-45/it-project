import { describe, expect, it } from "vitest";
import { ticketAcceptsReplies } from "@/lib/ticket-inbox";

describe("ticketAcceptsReplies", () => {
  it("stops tenants replying once a ticket is finished, but lets the dorm follow up", () => {
    expect(ticketAcceptsReplies("IN_PROGRESS", "TENANT")).toBe(true);
    expect(ticketAcceptsReplies("RESOLVED", "TENANT")).toBe(false);
    expect(ticketAcceptsReplies("RESOLVED", "ADMIN")).toBe(true);
    expect(ticketAcceptsReplies("CANCELLED", "ADMIN")).toBe(false);
  });
});
