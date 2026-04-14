-- Add missing notification_type enum values
-- Existing: 'assignment', 'completed', 'declined', 'modified', 'accepted',
--           'poke', 'reminder', 'overdue', 'optimization', 'mention'
ALTER TYPE nexo.notification_type ADD VALUE IF NOT EXISTS 'bug_resolved';
ALTER TYPE nexo.notification_type ADD VALUE IF NOT EXISTS 'bug_reopened';
ALTER TYPE nexo.notification_type ADD VALUE IF NOT EXISTS 'bug_confirmed';
ALTER TYPE nexo.notification_type ADD VALUE IF NOT EXISTS 'project_created';
ALTER TYPE nexo.notification_type ADD VALUE IF NOT EXISTS 'subtask_added';
ALTER TYPE nexo.notification_type ADD VALUE IF NOT EXISTS 'subtask_deleted';
ALTER TYPE nexo.notification_type ADD VALUE IF NOT EXISTS 'subtask_completed';
ALTER TYPE nexo.notification_type ADD VALUE IF NOT EXISTS 'event_reminder';
