/*
  # Add reassignment_needed notification type

  1. Changes
    - Update the `notifications` table type check constraint to include 'reassignment_needed'

  2. Notes
    - This is needed for the user deactivation workflow where POs are notified about tickets needing reassignment
*/

DO $$
BEGIN
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type = ANY (ARRAY[
      'assigned'::text,
      'unassigned'::text,
      'status_changed'::text,
      'commented'::text,
      'cancellation_requested'::text,
      'mentioned'::text,
      'user_deactivation_requested'::text,
      'reassignment_needed'::text
    ]));
END $$;
