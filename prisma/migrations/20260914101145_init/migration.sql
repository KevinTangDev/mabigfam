-- CreateTable
CREATE TABLE "family_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameZh" TEXT,
    "birthday" DATETIME,
    "phone" TEXT,
    "address" TEXT,
    "note" TEXT,
    "photoPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "parent_child" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parent_child_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "family_members" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "parent_child_childId_fkey" FOREIGN KEY ("childId") REFERENCES "family_members" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "parent_child_parentId_childId_key" ON "parent_child"("parentId", "childId");
