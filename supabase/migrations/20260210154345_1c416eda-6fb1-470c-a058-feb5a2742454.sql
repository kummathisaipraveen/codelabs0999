
-- Problems table
CREATE TABLE public.problems (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  concepts TEXT[] NOT NULL DEFAULT '{}',
  type TEXT NOT NULL DEFAULT 'Implementation',
  time_estimate TEXT NOT NULL DEFAULT '15 min',
  description TEXT NOT NULL DEFAULT '',
  examples JSONB NOT NULL DEFAULT '[]',
  constraints TEXT[] NOT NULL DEFAULT '{}',
  hint TEXT,
  default_code TEXT NOT NULL DEFAULT '',
  test_cases JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;

-- Problems readable by everyone (public content)
CREATE POLICY "Problems are publicly readable"
  ON public.problems FOR SELECT
  USING (true);

-- Submissions table
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id INTEGER NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  tests_passed INTEGER NOT NULL DEFAULT 0,
  tests_total INTEGER NOT NULL DEFAULT 0,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own submissions"
  ON public.submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own submissions"
  ON public.submissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- User points table for leaderboard
CREATE TABLE public.user_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  problems_solved INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_solved_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

-- Leaderboard is public (anyone can see rankings)
CREATE POLICY "Leaderboard is publicly readable"
  ON public.user_points FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own points"
  ON public.user_points FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own points"
  ON public.user_points FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Badges table
CREATE TABLE public.badges (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏆',
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges are publicly readable"
  ON public.badges FOR SELECT
  USING (true);

-- User badges (earned achievements)
CREATE TABLE public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User badges are publicly readable"
  ON public.user_badges FOR SELECT
  USING (true);

CREATE POLICY "Users can earn badges"
  ON public.user_badges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Auto-create user_points row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_points (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_points
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_points();

-- Function to record submission and update points
CREATE OR REPLACE FUNCTION public.submit_solution(
  p_problem_id INTEGER,
  p_code TEXT,
  p_tests_passed INTEGER,
  p_tests_total INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_submission_id UUID;
  v_difficulty TEXT;
  v_points INTEGER;
  v_already_solved BOOLEAN;
  v_streak INTEGER;
  v_last_solved TIMESTAMP WITH TIME ZONE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get problem difficulty
  SELECT difficulty INTO v_difficulty FROM public.problems WHERE id = p_problem_id;

  -- Calculate score
  v_points := CASE v_difficulty
    WHEN 'Easy' THEN 10
    WHEN 'Medium' THEN 20
    WHEN 'Hard' THEN 30
    ELSE 10
  END;

  -- Only award full points if all tests passed
  IF p_tests_passed < p_tests_total THEN
    v_points := (v_points * p_tests_passed) / GREATEST(p_tests_total, 1);
  END IF;

  -- Insert submission
  INSERT INTO public.submissions (user_id, problem_id, code, score, tests_passed, tests_total)
  VALUES (v_user_id, p_problem_id, p_code, v_points, p_tests_passed, p_tests_total)
  RETURNING id INTO v_submission_id;

  -- Check if already solved this problem with full score
  SELECT EXISTS (
    SELECT 1 FROM public.submissions
    WHERE user_id = v_user_id AND problem_id = p_problem_id
      AND tests_passed = tests_total AND id != v_submission_id
  ) INTO v_already_solved;

  -- Update points only for new solves
  IF p_tests_passed = p_tests_total AND NOT v_already_solved THEN
    -- Get current streak info
    SELECT current_streak, last_solved_at INTO v_streak, v_last_solved
    FROM public.user_points WHERE user_id = v_user_id;

    -- Update streak (reset if more than 48h gap)
    IF v_last_solved IS NOT NULL AND (now() - v_last_solved) < interval '48 hours' THEN
      v_streak := COALESCE(v_streak, 0) + 1;
    ELSE
      v_streak := 1;
    END IF;

    UPDATE public.user_points
    SET total_points = total_points + v_points,
        problems_solved = problems_solved + 1,
        current_streak = v_streak,
        longest_streak = GREATEST(longest_streak, v_streak),
        last_solved_at = now(),
        updated_at = now()
    WHERE user_id = v_user_id;
  END IF;

  RETURN v_submission_id;
END;
$$;
