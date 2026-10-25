-- Only administrative edits advance this version; login and preferences do not.
ALTER TABLE "User" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0);
