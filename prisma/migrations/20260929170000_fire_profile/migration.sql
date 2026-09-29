-- CreateTable
CREATE TABLE "FireProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FireProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FireProfile_userId_key" ON "FireProfile"("userId");

-- AddForeignKey
ALTER TABLE "FireProfile" ADD CONSTRAINT "FireProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
