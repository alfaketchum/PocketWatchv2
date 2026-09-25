-- WalletChartCache: separate total vs stablecoin-only series
ALTER TABLE "WalletChartCache" ADD COLUMN "series" TEXT NOT NULL DEFAULT 'total';
DROP INDEX "WalletChartCache_userId_address_timestamp_key";
CREATE UNIQUE INDEX "WalletChartCache_userId_address_series_timestamp_key" ON "WalletChartCache"("userId", "address", "series", "timestamp");

-- CreateTable
CREATE TABLE "StablecoinChartCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StablecoinChartCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StablecoinChartCache_userId_timestamp_key" ON "StablecoinChartCache"("userId", "timestamp");

-- AddForeignKey
ALTER TABLE "StablecoinChartCache" ADD CONSTRAINT "StablecoinChartCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
