-- CreateTable
CREATE TABLE "RoadmapItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT,
    "tier" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "demand" TEXT NOT NULL,
    "plStatus" TEXT NOT NULL,
    "ourStatus" TEXT NOT NULL,
    "effort" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'backlog',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoadmapItem_userId_idx" ON "RoadmapItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapItem_userId_key_key" ON "RoadmapItem"("userId", "key");

-- AddForeignKey
ALTER TABLE "RoadmapItem" ADD CONSTRAINT "RoadmapItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
