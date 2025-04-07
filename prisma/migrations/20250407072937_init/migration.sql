-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkIn" DATETIME,
    "breakStart" DATETIME,
    "breakEnd" DATETIME,
    "checkOut" DATETIME,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AttendanceRecord" ("breakEnd", "breakStart", "checkIn", "checkOut", "createdAt", "date", "id", "isAbsent", "userId") SELECT "breakEnd", "breakStart", "checkIn", "checkOut", "createdAt", "date", "id", "isAbsent", "userId" FROM "AttendanceRecord";
DROP TABLE "AttendanceRecord";
ALTER TABLE "new_AttendanceRecord" RENAME TO "AttendanceRecord";
CREATE TABLE "new_UserState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "currentState" TEXT NOT NULL,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserState" ("currentState", "id", "lastUpdated", "userId") SELECT "currentState", "id", "lastUpdated", "userId" FROM "UserState";
DROP TABLE "UserState";
ALTER TABLE "new_UserState" RENAME TO "UserState";
CREATE UNIQUE INDEX "UserState_userId_key" ON "UserState"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
