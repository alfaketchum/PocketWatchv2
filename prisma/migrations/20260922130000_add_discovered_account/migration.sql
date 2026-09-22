-- CreateTable
CREATE TABLE "DiscoveredAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "serviceDomain" TEXT NOT NULL,
    "category" TEXT,
    "accountEmail" TEXT NOT NULL,
    "accountEmailHash" TEXT NOT NULL,
    "sourceService" TEXT NOT NULL,
    "signalTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidence" JSONB,
    "sourceRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extractedBy" TEXT NOT NULL DEFAULT 'heuristic',
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "userEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveredAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscoveredAccount_userId_status_idx" ON "DiscoveredAccount"("userId", "status");

-- CreateIndex
CREATE INDEX "DiscoveredAccount_userId_category_idx" ON "DiscoveredAccount"("userId", "category");

-- CreateIndex
CREATE INDEX "DiscoveredAccount_userId_serviceDomain_idx" ON "DiscoveredAccount"("userId", "serviceDomain");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveredAccount_userId_serviceDomain_accountEmailHash_key" ON "DiscoveredAccount"("userId", "serviceDomain", "accountEmailHash");

-- AddForeignKey
ALTER TABLE "DiscoveredAccount" ADD CONSTRAINT "DiscoveredAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
