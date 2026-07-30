-- Scribe continu : tâche d'enrichissement périodique des dossiers
ALTER TYPE "AgentTaskKind" ADD VALUE IF NOT EXISTS 'SCRIBE_ENRICH';
