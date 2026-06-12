-- DropForeignKey
ALTER TABLE "Attraction" DROP CONSTRAINT "Attraction_cityIata_fkey";

-- AddForeignKey
ALTER TABLE "Attraction" ADD CONSTRAINT "Attraction_cityIata_fkey" FOREIGN KEY ("cityIata") REFERENCES "City"("iata") ON DELETE CASCADE ON UPDATE CASCADE;
