-- Migration: Interaction Logs and Gamification Leaderboard
-- Description: Creates tables required for Phase 1 gamification and tracking.

-- 1. Interaction Logs Table
CREATE TABLE IF NOT EXISTS interaction_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id TEXT NOT NULL,
    problem_id INT,
    action_type TEXT NOT NULL, -- 'keystrokes', 'copy_attempt', 'paste_attempt', 'tab_switch', etc.
    metadata JSONB DEFAULT '{}'::jsonb, -- Store raw lengths, blur counts, specific event data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional: Index for faster querying in teacher dashboards later
CREATE INDEX idx_interaction_logs_student_id ON interaction_logs(student_id);

-- 2. Leaderboard Table
CREATE TABLE IF NOT EXISTS leaderboard (
    user_id TEXT PRIMARY KEY,
    total_score INT DEFAULT 0,
    current_streak INT DEFAULT 0,
    last_activity_date DATE DEFAULT CURRENT_DATE,
    badges TEXT[] DEFAULT '{}'
);

-- 3. Row Level Security Setup (Optional depending on how the frontend queries)
-- We will rely on the backend (main.py) with the Service Role Key to insert logs 
-- and update the leaderboard securely.
-- However, we can allow read-only access to the leaderboard for authenticated clients.

ALTER TABLE interaction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Allow anyone (or securely authenticated users) to read the leaderboard
CREATE POLICY "Enable read access for all users on leaderboard" ON leaderboard
    FOR SELECT USING (true);

-- Backend inserts interaction logs using Service Role Key, so no insert policy is needed for anon/auth
-- If we want frontend to directly insert (not recommended for anti-cheat), we would add an INSERT policy.
-- Keeping it secure: only the backend inserts into interaction_logs.
