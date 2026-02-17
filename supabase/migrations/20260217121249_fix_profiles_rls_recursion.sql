/*
  # Fix Profiles RLS Infinite Recursion

  1. Problem
    - The "Admins can read all profiles including inactive" policy contains a
      self-referencing subquery on the profiles table, causing infinite RLS recursion
      and 500 errors on every profiles request.
    - The "Authenticated users can read all profiles" policy with USING(true)
      defeats the purpose of the new active/inactive filtering.
    - The "Admins can update any profile" policy also self-references profiles.

  2. Fix
    - Drop all conflicting SELECT policies on profiles
    - Recreate using the existing `is_admin()` SECURITY DEFINER helper to avoid recursion
    - Users can read their own profile (even if deactivated)
    - Users can read all active profiles
    - Admins can read all profiles (including inactive) via is_admin()
    - Fix the admin update policy to use is_admin()

  3. Security
    - Non-admin users only see active profiles + their own
    - Admins see all profiles for user management
    - No self-referencing subqueries on profiles table
*/

-- Drop the problematic policies
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles including inactive" ON profiles;
DROP POLICY IF EXISTS "Users can read active profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- Users can always read their own profile (even if deactivated)
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Authenticated users can read all active profiles
CREATE POLICY "Users can read active profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can read all profiles including inactive (uses SECURITY DEFINER helper)
CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update any profile (uses SECURITY DEFINER helper)
CREATE POLICY "Admins can update any profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
