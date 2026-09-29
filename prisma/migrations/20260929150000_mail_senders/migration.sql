-- AlterTable
ALTER TABLE "GmailScanState" ADD COLUMN "senderScanAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MailSender" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "senderDomain" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "unsubscribeUrl" TEXT,
    "unsubscribeMailto" TEXT,
    "oneClick" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "unsubscribedAt" TIMESTAMP(3),
    "unsubscribeMethod" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailSender_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailSender_userId_status_idx" ON "MailSender"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MailSender_userId_service_senderEmail_key" ON "MailSender"("userId", "service", "senderEmail");

-- AddForeignKey
ALTER TABLE "MailSender" ADD CONSTRAINT "MailSender_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
