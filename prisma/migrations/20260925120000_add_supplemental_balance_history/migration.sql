-- CreateTable
CREATE TABLE "SupplementalBalanceHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SupplementalBalanceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplementalBalanceHistory_userId_source_date_key" ON "SupplementalBalanceHistory"("userId", "source", "date");

-- CreateIndex
CREATE INDEX "SupplementalBalanceHistory_userId_date_idx" ON "SupplementalBalanceHistory"("userId", "date");

-- AddForeignKey
ALTER TABLE "SupplementalBalanceHistory" ADD CONSTRAINT "SupplementalBalanceHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
