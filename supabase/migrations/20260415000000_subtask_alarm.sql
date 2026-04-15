-- Allow users to set a personal alarm/reminder on any subtask, the same way
-- they can on a Quick Task. Mirrors the `alarm_at` column on `nexo.tasks`.

ALTER TABLE nexo.subtasks
  ADD COLUMN IF NOT EXISTS alarm_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subtasks_alarm
  ON nexo.subtasks(alarm_at)
  WHERE alarm_at IS NOT NULL;
