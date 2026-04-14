-- Add remaining notification types for deadline alerts, project completion, and daily summaries
ALTER TYPE nexo.notification_type ADD VALUE IF NOT EXISTS 'deadline_soon';
ALTER TYPE nexo.notification_type ADD VALUE IF NOT EXISTS 'project_completed';
ALTER TYPE nexo.notification_type ADD VALUE IF NOT EXISTS 'daily_summary';
