-- CreateTable
CREATE TABLE "family_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "family_events_startsAt_idx" ON "family_events"("startsAt");
