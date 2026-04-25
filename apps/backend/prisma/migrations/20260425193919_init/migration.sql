-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "cabinClass" TEXT NOT NULL,
    "travelers" INTEGER NOT NULL,
    "cities" TEXT[],
    "flights" JSONB NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightPriceCache" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departDate" DATE NOT NULL,
    "cabinClass" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "stops" INTEGER NOT NULL,
    "carrier" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightPriceCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "iata" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("iata")
);

-- CreateIndex
CREATE INDEX "Trip_userId_createdAt_idx" ON "Trip"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FlightPriceCache_fetchedAt_idx" ON "FlightPriceCache"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FlightPriceCache_origin_destination_departDate_cabinClass_key" ON "FlightPriceCache"("origin", "destination", "departDate", "cabinClass");
