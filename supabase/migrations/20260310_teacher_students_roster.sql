-- Create the teacher_students junction table
CREATE TABLE IF NOT EXISTS public.teacher_students (
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_id, student_id)
);

-- Enable RLS
ALTER TABLE public.teacher_students ENABLE ROW LEVEL SECURITY;

-- Policy: Teachers can insert students into their own roster
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_students' AND policyname='Teachers can add students to their roster') THEN
    CREATE POLICY "Teachers can add students to their roster" 
    ON public.teacher_students 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = teacher_id AND public.has_role(auth.uid(), 'teacher'));
  END IF;
END $$;

-- Policy: Teachers can view their own roster
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_students' AND policyname='Teachers can view their roster') THEN
    CREATE POLICY "Teachers can view their roster" 
    ON public.teacher_students 
    FOR SELECT 
    TO authenticated 
    USING (auth.uid() = teacher_id);
  END IF;
END $$;

-- Policy: Students can view teachers they are assigned to
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_students' AND policyname='Students can view their teachers') THEN
    CREATE POLICY "Students can view their teachers" 
    ON public.teacher_students 
    FOR SELECT 
    TO authenticated 
    USING (auth.uid() = student_id);
  END IF;
END $$;

-- Allow teachers to read profiles of students in their roster
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Teachers can view profiles of their students') THEN
    CREATE POLICY "Teachers can view profiles of their students" 
    ON public.profiles 
    FOR SELECT 
    TO authenticated 
    USING (
      EXISTS (
        SELECT 1 FROM public.teacher_students 
        WHERE teacher_id = auth.uid() AND student_id = profiles.user_id
      )
      OR auth.uid() = user_id -- preserve existing access
    );
  END IF;
END $$;

-- Allow teachers to read user_roles of students in their roster
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='Teachers can view roles of their students') THEN
    CREATE POLICY "Teachers can view roles of their students" 
    ON public.user_roles 
    FOR SELECT 
    TO authenticated 
    USING (
      EXISTS (
        SELECT 1 FROM public.teacher_students 
        WHERE teacher_id = auth.uid() AND student_id = user_roles.user_id
      )
      OR auth.uid() = user_id -- preserve existing access
    );
  END IF;
END $$;

-- Allow teachers to read assignments of students in their roster
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='assignments' AND policyname='Teachers can view assignments of their students') THEN
    CREATE POLICY "Teachers can view assignments of their students" 
    ON public.assignments 
    FOR SELECT 
    TO authenticated 
    USING (
      EXISTS (
        SELECT 1 FROM public.teacher_students 
        WHERE teacher_id = auth.uid() AND student_id = assignments.student_id
      )
    );
  END IF;
END $$;
