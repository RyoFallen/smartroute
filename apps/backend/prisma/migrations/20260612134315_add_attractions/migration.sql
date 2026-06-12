-- AlterTable
ALTER TABLE "City" ADD COLUMN     "altCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Attraction" (
    "id" TEXT NOT NULL,
    "cityIata" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mustGo" BOOLEAN NOT NULL DEFAULT true,
    "rank" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "tags" TEXT[],

    CONSTRAINT "Attraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attraction_cityIata_mustGo_rank_idx" ON "Attraction"("cityIata", "mustGo", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "Attraction_cityIata_name_key" ON "Attraction"("cityIata", "name");

-- AddForeignKey
ALTER TABLE "Attraction" ADD CONSTRAINT "Attraction_cityIata_fkey" FOREIGN KEY ("cityIata") REFERENCES "City"("iata") ON DELETE RESTRICT ON UPDATE CASCADE;
