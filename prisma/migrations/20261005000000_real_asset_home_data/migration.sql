-- AlterTable
ALTER TABLE "RealAsset" ADD COLUMN "address" TEXT,
ADD COLUMN "propertyTaxAnnual" DOUBLE PRECISION,
ADD COLUMN "rentEstimate" DOUBLE PRECISION,
ADD COLUMN "homeDetails" JSONB,
ADD COLUMN "dataSource" TEXT,
ADD COLUMN "dataAsOf" TIMESTAMP(3);
