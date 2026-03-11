-- ================================================================
-- Fix: Add RLS policies for authenticated users on assignments table
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ================================================================

-- Allow authenticated users (teachers) to INSERT assignments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='assignments' AND policyname='Authenticated users can insert assignments') THEN
    CREATE POLICY "Authenticated users can insert assignments"
      ON public.assignments
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Allow students to SELECT their own assignments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='assignments' AND policyname='Students can view own assignments') THEN
    CREATE POLICY "Students can view own assignments"
      ON public.assignments
      FOR SELECT
      TO authenticated
      USING (student_id = auth.uid());
  END IF;
END $$;

-- Verify policies
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'assignments';
