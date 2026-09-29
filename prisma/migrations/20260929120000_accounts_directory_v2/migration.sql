-- AlterTable
ALTER TABLE "DiscoveredAccount" ADD COLUMN "paymentBrand" TEXT,
ADD COLUMN "paymentLast4" TEXT,
ADD COLUMN "paymentAccountId" TEXT;

-- CreateTable
CREATE TABLE "GmailScanState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "backfillPageToken" TEXT,
    "backfillDone" BOOLEAN NOT NULL DEFAULT false,
    "lastIncrementalAt" TIMESTAMP(3),
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailScanState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailScanState_userId_service_key" ON "GmailScanState"("userId", "service");

-- AddForeignKey
ALTER TABLE "GmailScanState" ADD CONSTRAINT "GmailScanState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
