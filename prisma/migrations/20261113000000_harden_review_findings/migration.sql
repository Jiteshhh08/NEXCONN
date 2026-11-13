-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN "nonce" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "askedByUserId" TEXT NOT NULL,
    "nexconnMessageId" TEXT,
    "clientNonce" TEXT,
    "originalText" TEXT NOT NULL,
    "sourceLanguage" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "moderationStatus" TEXT NOT NULL DEFAULT 'pending',
    "upvoteCount" INTEGER NOT NULL DEFAULT 0,
    "groupId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Question_askedByUserId_fkey" FOREIGN KEY ("askedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Question_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "QuestionGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("askedByUserId", "clientNonce", "createdAt", "groupId", "id", "isAnonymous", "moderationStatus", "nexconnMessageId", "originalText", "roomId", "sourceLanguage", "updatedAt", "upvoteCount") SELECT "askedByUserId", "clientNonce", "createdAt", "groupId", "id", "isAnonymous", "moderationStatus", "nexconnMessageId", "originalText", "roomId", "sourceLanguage", "updatedAt", "upvoteCount" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE UNIQUE INDEX "Question_nexconnMessageId_key" ON "Question"("nexconnMessageId");
CREATE INDEX "Question_roomId_moderationStatus_createdAt_idx" ON "Question"("roomId", "moderationStatus", "createdAt");
CREATE INDEX "Question_roomId_upvoteCount_idx" ON "Question"("roomId", "upvoteCount");
CREATE INDEX "Question_askedByUserId_idx" ON "Question"("askedByUserId");
CREATE UNIQUE INDEX "Question_roomId_clientNonce_key" ON "Question"("roomId", "clientNonce");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_nonce_key" ON "WebhookEvent"("nonce");