-- CreateTable
CREATE TABLE "TokenPnl" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "fungibleId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "iconUrl" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "averageBuyPrice" DOUBLE PRECISION NOT NULL,
    "totalInvested" DOUBLE PRECISION NOT NULL,
    "netInvested" DOUBLE PRECISION NOT NULL,
    "realizedGain" DOUBLE PRECISION NOT NULL,
    "unrealizedGain" DOUBLE PRECISION NOT NULL,
    "totalGain" DOUBLE PRECISION NOT NULL,
    "totalFee" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenPnl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenPnl_userId_walletAddress_fungibleId_key" ON "TokenPnl"("userId", "walletAddress", "fungibleId");

-- CreateIndex
CREATE INDEX "TokenPnl_userId_idx" ON "TokenPnl"("userId");

-- AddForeignKey
ALTER TABLE "TokenPnl" ADD CONSTRAINT "TokenPnl_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
