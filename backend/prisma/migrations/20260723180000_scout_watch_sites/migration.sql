-- Sites AO internationaux à surveiller (UNDP, UNIDO, UNGM…)
ALTER TABLE "scout_profiles" ADD COLUMN IF NOT EXISTS "watchSites" JSONB NOT NULL DEFAULT '[]';
