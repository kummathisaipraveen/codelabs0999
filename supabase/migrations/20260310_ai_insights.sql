-- Create the ai_insights table to store AI evaluations for teachers
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

-- Active RLS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Students and Backend can insert/update insights
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_insights' AND policyname='Users can insert their own insights') THEN
    CREATE POLICY "Users can insert their own insights" 
    ON public.ai_insights 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = student_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_insights' AND policyname='Users can update their own insights') THEN
    CREATE POLICY "Users can update their own insights" 
    ON public.ai_insights 
    FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = student_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_insights' AND policyname='Teachers can read insights of their roster') THEN
    CREATE POLICY "Teachers can read insights of their roster" 
    ON public.ai_insights 
    FOR SELECT 
    TO authenticated 
    USING (
      EXISTS (
        SELECT 1 FROM public.teacher_students 
        WHERE teacher_id = auth.uid() AND public.teacher_students.student_id = ai_insights.student_id
      )
    );
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_ai_insights_updated_at ON public.ai_insights;
CREATE TRIGGER update_ai_insights_updated_at BEFORE UPDATE ON public.ai_insights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
