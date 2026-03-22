
-- Security & Anti-Cheating Logs
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id INTEGER REFERENCES public.problems(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'PASTE_ATTEMPT', 'SPEED_BURST', 'INCONSISTENCY'
    wpm INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for security_logs
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own security logs" 
    ON public.security_logs FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teachers can view all security logs" 
    ON public.security_logs FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE user_id = auth.uid() AND role = 'teacher'
        )
    );

CREATE INDEX IF NOT EXISTS idx_security_logs_user ON public.security_logs(user_id);
