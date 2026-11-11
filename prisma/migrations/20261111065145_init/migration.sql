-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'student',
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "isGuest" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "nexconnChannelId" TEXT,
    "hostLanguage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    CONSTRAINT "Room_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Participant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "askedByUserId" TEXT NOT NULL,
    "nexconnMessageId" TEXT,
    "clientNonce" TEXT,
    "originalText" TEXT NOT NULL,
    "sourceLanguage" TEXT NOT NULL,
    "hostTranslation" TEXT,
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

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vote_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "lecturerUserId" TEXT NOT NULL,
    "nexconnMessageId" TEXT,
    "answerText" TEXT NOT NULL,
    "answerLanguage" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Answer_lecturerUserId_fkey" FOREIGN KEY ("lecturerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "groupLabel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionGroup_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "sourceLanguage" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "translatedText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "processedAt" DATETIME,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Room_joinCode_key" ON "Room"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "Room_nexconnChannelId_key" ON "Room"("nexconnChannelId");

-- CreateIndex
CREATE INDEX "Room_hostUserId_idx" ON "Room"("hostUserId");

-- CreateIndex
CREATE INDEX "Room_status_idx" ON "Room"("status");

-- CreateIndex
CREATE INDEX "Room_createdAt_idx" ON "Room"("createdAt");

-- CreateIndex
CREATE INDEX "Participant_userId_idx" ON "Participant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_roomId_userId_key" ON "Participant"("roomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_nexconnMessageId_key" ON "Question"("nexconnMessageId");

-- CreateIndex
CREATE INDEX "Question_roomId_moderationStatus_createdAt_idx" ON "Question"("roomId", "moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Question_roomId_upvoteCount_idx" ON "Question"("roomId", "upvoteCount");

-- CreateIndex
CREATE INDEX "Question_askedByUserId_idx" ON "Question"("askedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_roomId_clientNonce_key" ON "Question"("roomId", "clientNonce");

-- CreateIndex
CREATE INDEX "Vote_userId_idx" ON "Vote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_questionId_userId_key" ON "Vote"("questionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_nexconnMessageId_key" ON "Answer"("nexconnMessageId");

-- CreateIndex
CREATE INDEX "Answer_questionId_createdAt_idx" ON "Answer"("questionId", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionGroup_roomId_idx" ON "QuestionGroup"("roomId");

-- CreateIndex
CREATE INDEX "MessageTranslation_status_idx" ON "MessageTranslation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTranslation_messageId_targetLanguage_key" ON "MessageTranslation"("messageId", "targetLanguage");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_externalId_key" ON "WebhookEvent"("externalId");

-- CreateIndex
CREATE INDEX "WebhookEvent_eventType_idx" ON "WebhookEvent"("eventType");
