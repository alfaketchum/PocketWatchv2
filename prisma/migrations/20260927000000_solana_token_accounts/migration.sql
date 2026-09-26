-- CreateTable
CREATE TABLE "SolanaTokenAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolanaTokenAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolanaTokenAccount_userId_walletAddress_idx" ON "SolanaTokenAccount"("userId", "walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "SolanaTokenAccount_userId_walletAddress_address_key" ON "SolanaTokenAccount"("userId", "walletAddress", "address");

-- AddForeignKey
ALTER TABLE "SolanaTokenAccount" ADD CONSTRAINT "SolanaTokenAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
