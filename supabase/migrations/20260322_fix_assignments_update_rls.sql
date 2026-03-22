-- ================================================================
-- Fix: Allow students to update their own assignments (status only)
-- ================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='assignments' AND policyname='Students can update own assignments') THEN
    CREATE POLICY "Students can update own assignments"
      ON public.assignments
      FOR UPDATE
      TO authenticated
      USING (student_id = auth.uid())
      WITH CHECK (student_id = auth.uid());
  END IF;
END $$;
