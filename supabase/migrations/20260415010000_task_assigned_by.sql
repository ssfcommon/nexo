-- Track who *created/assigned* a task so cross-assigned tasks can credit the
-- assigner. Mirrors `nexo.subtasks.assigned_by`. Only set when the task is
-- assigned to someone other than the creator; self-created tasks leave this
-- column NULL to keep the owner_id = assigned_by case visually quiet.

ALTER TABLE nexo.tasks
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES nexo.users(id);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by
  ON nexo.tasks(assigned_by)
  WHERE assigned_by IS NOT NULL;
