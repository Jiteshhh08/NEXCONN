-- Persist room-specific participant preferences so refreshes restore the same
-- anonymity and language settings.
ALTER TABLE "Participant" ADD COLUMN "preferredLanguage" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "Participant" ADD COLUMN "isAnonymous" BOOLEAN NOT NULL DEFAULT false;
