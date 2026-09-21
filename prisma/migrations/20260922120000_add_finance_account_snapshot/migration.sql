-- CreateTable
CREATE TABLE "FinanceAccountSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceAccountSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceAccountSnapshot_userId_date_idx" ON "FinanceAccountSnapshot"("userId", "date");

-- CreateIndex
CREATE INDEX "FinanceAccountSnapshot_accountId_date_idx" ON "FinanceAccountSnapshot"("accountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceAccountSnapshot_accountId_date_key" ON "FinanceAccountSnapshot"("accountId", "date");

-- AddForeignKey
ALTER TABLE "FinanceAccountSnapshot" ADD CONSTRAINT "FinanceAccountSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
