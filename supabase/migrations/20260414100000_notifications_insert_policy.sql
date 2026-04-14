-- Notifications are inter-user by design: one user inserts a row for another
-- user (poke, mention, assignment, bug status, project completion, etc.).
-- Without an INSERT policy, RLS silently blocks every insert, so notifications
-- never materialise for the recipient.
--
-- Allow any authenticated user to insert notification rows. Read/update/delete
-- remain restricted to the recipient (user_id = current_user_id()).

CREATE POLICY notifications_insert ON nexo.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);
