-- CreateTable
CREATE TABLE "WalletChartCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "WalletChartCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletChartCache_userId_address_timestamp_key" ON "WalletChartCache"("userId", "address", "timestamp");

-- CreateIndex
CREATE INDEX "WalletChartCache_userId_address_idx" ON "WalletChartCache"("userId", "address");

-- AddForeignKey
ALTER TABLE "WalletChartCache" ADD CONSTRAINT "WalletChartCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
