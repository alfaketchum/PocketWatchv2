-- CreateTable
CREATE TABLE "RealAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "valueAsOf" TIMESTAMP(3) NOT NULL,
    "appreciation" DOUBLE PRECISION NOT NULL,
    "purchasePrice" DOUBLE PRECISION,
    "purchaseDate" TIMESTAMP(3),
    "loanAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RealAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealAssetValue" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RealAssetValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RealAsset_userId_idx" ON "RealAsset"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RealAssetValue_assetId_date_key" ON "RealAssetValue"("assetId", "date");

-- AddForeignKey
ALTER TABLE "RealAsset" ADD CONSTRAINT "RealAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealAssetValue" ADD CONSTRAINT "RealAssetValue_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "RealAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

