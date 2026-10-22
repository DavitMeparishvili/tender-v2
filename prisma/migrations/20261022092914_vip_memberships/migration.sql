-- CreateTable
CREATE TABLE "VipMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "logoPath" TEXT,
    "serviceLabel" JSONB,
    "description" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VipMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VipMembership_userId_key" ON "VipMembership"("userId");

-- CreateIndex
CREATE INDEX "VipMembership_active_idx" ON "VipMembership"("active");

-- AddForeignKey
ALTER TABLE "VipMembership" ADD CONSTRAINT "VipMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
