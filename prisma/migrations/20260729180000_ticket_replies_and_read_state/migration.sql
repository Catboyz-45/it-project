ALTER TYPE "TicketEventType" ADD VALUE IF NOT EXISTS 'REPLY_ADDED';

CREATE TABLE "TicketReply" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketReply_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketReadState" (
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,
    "lastReadReplyId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TicketReadState_pkey" PRIMARY KEY ("ticketId","userId")
);

ALTER TABLE "TicketEvent" ADD COLUMN "replyId" TEXT;

CREATE INDEX "TicketReply_ticketId_createdAt_id_idx" ON "TicketReply"("ticketId", "createdAt", "id");
CREATE INDEX "TicketReply_authorUserId_createdAt_idx" ON "TicketReply"("authorUserId", "createdAt");
CREATE INDEX "TicketReadState_userId_lastReadAt_idx" ON "TicketReadState"("userId", "lastReadAt");
CREATE INDEX "TicketEvent_replyId_idx" ON "TicketEvent"("replyId");

ALTER TABLE "TicketReply" ADD CONSTRAINT "TicketReply_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketReply" ADD CONSTRAINT "TicketReply_authorUserId_fkey"
    FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TicketReadState" ADD CONSTRAINT "TicketReadState_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketReadState" ADD CONSTRAINT "TicketReadState_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_replyId_fkey"
    FOREIGN KEY ("replyId") REFERENCES "TicketReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;
