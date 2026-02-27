-- ================================================================
-- CodeCoach - Assignments Table Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ================================================================

CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  problem_ids INTEGER[] NOT NULL DEFAULT '{}',
  time_limit_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  created_at TEXT NOT NULL DEFAULT now()::TEXT
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Service role (backend) can do everything
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='assignments' AND policyname='Service role full access') THEN
    CREATE POLICY "Service role full access" ON public.assignments
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Verify
SELECT COUNT(*) FROM public.assignments;
