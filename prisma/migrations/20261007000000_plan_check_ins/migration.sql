-- CreateTable
CREATE TABLE "PlanCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "planName" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "planHash" TEXT NOT NULL,
    "planUpdatedAt" TIMESTAMP(3) NOT NULL,
    "plannedSource" TEXT NOT NULL DEFAULT 'live',
    "plannedNetWorth" DOUBLE PRECISION,
    "plannedIncome" DOUBLE PRECISION NOT NULL,
    "plannedSpending" DOUBLE PRECISION NOT NULL,
    "plannedByCategory" JSONB NOT NULL,
    "plannedOneTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualNetWorth" DOUBLE PRECISION,
    "actualIncome" DOUBLE PRECISION NOT NULL,
    "actualSpending" DOUBLE PRECISION NOT NULL,
    "actualByCategory" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanCheckIn_userId_month_key" ON "PlanCheckIn"("userId", "month");

-- CreateIndex
CREATE INDEX "PlanCheckIn_userId_idx" ON "PlanCheckIn"("userId");

-- AddForeignKey
ALTER TABLE "PlanCheckIn" ADD CONSTRAINT "PlanCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCheckIn" ADD CONSTRAINT "PlanCheckIn_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
