-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('ANTHROPIC', 'OLLAMA', 'LMSTUDIO', 'OPENAI_COMPAT');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "remoteId" TEXT,
ADD COLUMN     "remoteUrl" TEXT;

-- CreateTable
CREATE TABLE "AiSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL DEFAULT 'ANTHROPIC',
    "anthropicKeyEnc" TEXT,
    "anthropicKeyLast4" TEXT,
    "baseUrl" TEXT,
    "model" TEXT,
    "apiKeyEnc" TEXT,
    "publishUrl" TEXT,
    "publishKeyEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiSettings_userId_key" ON "AiSettings"("userId");

-- AddForeignKey
ALTER TABLE "AiSettings" ADD CONSTRAINT "AiSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

