-- Event lifecycle: status, completion, and follow-up chaining
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    CREATE TYPE nexo.event_status AS ENUM ('scheduled', 'completed', 'partial', 'rescheduled', 'cancelled');
  END IF;
END$$;

ALTER TABLE nexo.events
  ADD COLUMN IF NOT EXISTS status nexo.event_status NOT NULL DEFAULT 'scheduled';

ALTER TABLE nexo.events
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE nexo.events
  ADD COLUMN IF NOT EXISTS parent_event_id UUID REFERENCES nexo.events(id) ON DELETE SET NULL;

ALTER TABLE nexo.events
  ADD COLUMN IF NOT EXISTS linked_subtask_id UUID REFERENCES nexo.subtasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_parent ON nexo.events(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_events_linked_subtask ON nexo.events(linked_subtask_id);
