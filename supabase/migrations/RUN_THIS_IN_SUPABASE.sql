-- =============================================================
-- COMBINED MIGRATION: All Missing Tables for CodeCoach
-- Run this ENTIRE script in Supabase SQL Editor at once.
-- Link: https://supabase.com/dashboard/project/eeyvtnprdyzcbfqusewa/sql/new
-- =============================================================

-- ─────────────────────────────────────────────
-- 1. teacher_students (Teacher Roster)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_students (
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_id, student_id)
);

ALTER TABLE public.teacher_students ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_students' AND policyname='Teachers can add students to their roster') THEN
    CREATE POLICY "Teachers can add students to their roster" ON public.teacher_students
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_students' AND policyname='Teachers can view their roster') THEN
    CREATE POLICY "Teachers can view their roster" ON public.teacher_students
    FOR SELECT TO authenticated USING (auth.uid() = teacher_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_students' AND policyname='Students can view their teachers') THEN
    CREATE POLICY "Students can view their teachers" ON public.teacher_students
    FOR SELECT TO authenticated USING (auth.uid() = student_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 2. ai_insights (AI Evaluation Storage)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id INTEGER NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  user_level TEXT NOT NULL,
  lacking_areas TEXT,
  teacher_suggestions TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, problem_id)
);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_insights' AND policyname='Users can insert their own insights') THEN
    CREATE POLICY "Users can insert their own insights" ON public.ai_insights
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_insights' AND policyname='Users can update their own insights') THEN
    CREATE POLICY "Users can update their own insights" ON public.ai_insights
    FOR UPDATE TO authenticated USING (auth.uid() = student_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_insights' AND policyname='Teachers can read insights of their roster') THEN
    CREATE POLICY "Teachers can read insights of their roster" ON public.ai_insights
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.teacher_students
        WHERE teacher_id = auth.uid() AND student_id = ai_insights.student_id
      )
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 3. concepts, prerequisites, user_mastery (Ontology Graph)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.concepts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.prerequisites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id TEXT REFERENCES public.concepts(id) ON DELETE CASCADE,
    prerequisite_id TEXT REFERENCES public.concepts(id) ON DELETE CASCADE,
    UNIQUE(concept_id, prerequisite_id)
);

CREATE TABLE IF NOT EXISTS public.user_mastery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    concept_id TEXT REFERENCES public.concepts(id) ON DELETE CASCADE,
    mastered BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, concept_id)
);

-- ─────────────────────────────────────────────
-- 4. security_logs (Anti-Cheat Monitoring)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id INTEGER REFERENCES public.problems(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    wpm INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='security_logs' AND policyname='Users can insert their own security logs') THEN
    CREATE POLICY "Users can insert their own security logs" ON public.security_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Done!
SELECT 'All missing tables created successfully!' AS status;
