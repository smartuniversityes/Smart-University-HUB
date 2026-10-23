-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "pageLabel" TEXT,
    "content" TEXT NOT NULL,
    "embedding" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentChunk_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "previewStatus" TEXT NOT NULL DEFAULT 'NONE',
    "previewPath" TEXT,
    "previewEngine" TEXT,
    "previewError" TEXT,
    "indexStatus" TEXT NOT NULL DEFAULT 'NONE',
    "indexError" TEXT,
    "indexedAt" DATETIME,
    "subjectId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Material_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Material_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Material" ("createdAt", "description", "downloadCount", "extension", "id", "mimeType", "originalName", "previewEngine", "previewError", "previewPath", "previewStatus", "professorId", "sizeBytes", "storedName", "subjectId", "title", "updatedAt") SELECT "createdAt", "description", "downloadCount", "extension", "id", "mimeType", "originalName", "previewEngine", "previewError", "previewPath", "previewStatus", "professorId", "sizeBytes", "storedName", "subjectId", "title", "updatedAt" FROM "Material";
DROP TABLE "Material";
ALTER TABLE "new_Material" RENAME TO "Material";
CREATE INDEX "Material_subjectId_idx" ON "Material"("subjectId");
CREATE INDEX "Material_professorId_idx" ON "Material"("professorId");
CREATE INDEX "Material_createdAt_idx" ON "Material"("createdAt");
CREATE INDEX "Material_previewStatus_idx" ON "Material"("previewStatus");
CREATE INDEX "Material_indexStatus_idx" ON "Material"("indexStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DocumentChunk_materialId_idx" ON "DocumentChunk"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentChunk_materialId_chunkIndex_key" ON "DocumentChunk"("materialId", "chunkIndex");

-- CreateIndex
CREATE INDEX "ChatSession_userId_updatedAt_idx" ON "ChatSession"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");
