/*
  # Add User Deactivation Support

  1. Modified Tables
    - `profiles`
      - Added `is_active` (boolean, default true) - controls whether user is active or deactivated
      - Added `deactivated_at` (timestamptz, nullable) - timestamp when user was deactivated

  2. New Tables
    - `reassignment_tasks`
      - `id` (uuid, primary key)
      - `ticket_id` (bigint, FK to tickets) - the ticket that needs reassignment
      - `project_owner_id` (uuid, FK to profiles) - the PO who needs to reassign
      - `deactivated_user_id` (uuid, FK to profiles) - the user who was deactivated
      - `is_completed` (boolean, default false) - whether the task has been completed
      - `created_at` (timestamptz)
      - `completed_at` (timestamptz, nullable)

  3. Security
    - Enable RLS on `reassignment_tasks`
    - Admins can read and manage all reassignment tasks
    - POs can read their own reassignment tasks and mark them complete

  4. Notes
    - When a user is deactivated, their active ticket assignments trigger reassignment tasks
    - Inactive users remain in historical data but are filtered from active lists
    - Only admins can deactivate/reactivate users
*/

-- Add is_active and deactivated_at to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'deactivated_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN deactivated_at timestamptz;
  END IF;
END $$;

-- Create reassignment_tasks table
CREATE TABLE IF NOT EXISTS reassignment_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id bigint NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  project_owner_id uuid NOT NULL REFERENCES profiles(id),
  deactivated_user_id uuid NOT NULL REFERENCES profiles(id),
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Enable RLS
ALTER TABLE reassignment_tasks ENABLE ROW LEVEL SECURITY;

-- Admins can see all reassignment tasks
CREATE POLICY "Admins can view all reassignment tasks"
  ON reassignment_tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- POs can see their own reassignment tasks
CREATE POLICY "POs can view own reassignment tasks"
  ON reassignment_tasks
  FOR SELECT
  TO authenticated
  USING (project_owner_id = auth.uid());

-- Admins can insert reassignment tasks (created during deactivation)
CREATE POLICY "Admins can create reassignment tasks"
  ON reassignment_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- POs can update (complete) their own reassignment tasks
CREATE POLICY "POs can complete own reassignment tasks"
  ON reassignment_tasks
  FOR UPDATE
  TO authenticated
  USING (project_owner_id = auth.uid())
  WITH CHECK (project_owner_id = auth.uid());

-- Admins can update any reassignment tasks
CREATE POLICY "Admins can update all reassignment tasks"
  ON reassignment_tasks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can delete reassignment tasks
CREATE POLICY "Admins can delete reassignment tasks"
  ON reassignment_tasks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reassignment_tasks_project_owner
  ON reassignment_tasks(project_owner_id)
  WHERE is_completed = false;

CREATE INDEX IF NOT EXISTS idx_reassignment_tasks_ticket
  ON reassignment_tasks(ticket_id);

CREATE INDEX IF NOT EXISTS idx_profiles_is_active
  ON profiles(is_active);

-- Allow admins to update profiles (for deactivation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'Admins can update any profile'
  ) THEN
    CREATE POLICY "Admins can update any profile"
      ON profiles
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role = 'admin'
        )
      );
  END IF;
END $$;
