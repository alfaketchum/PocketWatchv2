-- CreateTable
CREATE TABLE "AssetCandidate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "contract" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "fungibleId" TEXT,
    "status" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedAssetPair" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "fungibleId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedAssetPair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetCandidate_userId_chain_contract_key" ON "AssetCandidate"("userId", "chain", "contract");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedAssetPair_userId_walletAddress_fungibleId_key" ON "TrackedAssetPair"("userId", "walletAddress", "fungibleId");

-- CreateIndex
CREATE INDEX "TrackedAssetPair_userId_idx" ON "TrackedAssetPair"("userId");

-- AddForeignKey
ALTER TABLE "AssetCandidate" ADD CONSTRAINT "AssetCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedAssetPair" ADD CONSTRAINT "TrackedAssetPair_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
