-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL,
    "intensity" TEXT NOT NULL DEFAULT 'MODERATE',
    "wakeUpTime" TEXT NOT NULL DEFAULT '09:00',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Interest" (
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,

    CONSTRAINT "Interest_pkey" PRIMARY KEY ("userId","category")
);
