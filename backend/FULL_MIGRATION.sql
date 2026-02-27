-- ================================================================
-- CodeCoach - Complete Schema + 40 Problems
-- Paste this ENTIRE file into:
-- Supabase Dashboard → SQL Editor → New Query → Run
-- ================================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can insert their own profile') THEN
    CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can update their own profile') THEN
    CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can delete their own profile') THEN
    CREATE POLICY "Users can delete their own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. ROLE ENUM + USER_ROLES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('student', 'teacher', 'recruiter');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'student',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='Users can view their own roles') THEN
    CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 3. PROBLEMS TABLE
CREATE TABLE IF NOT EXISTS public.problems (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL UNIQUE,
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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='problems' AND policyname='Problems are publicly readable') THEN
    CREATE POLICY "Problems are publicly readable" ON public.problems FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='problems' AND policyname='Allow all inserts for problems') THEN
    CREATE POLICY "Allow all inserts for problems" ON public.problems FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- 4. SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.submissions (
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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='submissions' AND policyname='Users can view their own submissions') THEN
    CREATE POLICY "Users can view their own submissions" ON public.submissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='submissions' AND policyname='Users can create their own submissions') THEN
    CREATE POLICY "Users can create their own submissions" ON public.submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='submissions' AND policyname='Teachers can view all submissions') THEN
    CREATE POLICY "Teachers can view all submissions" ON public.submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'teacher'));
  END IF;
END $$;

-- 5. USER POINTS
CREATE TABLE IF NOT EXISTS public.user_points (
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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_points' AND policyname='Leaderboard is publicly readable') THEN
    CREATE POLICY "Leaderboard is publicly readable" ON public.user_points FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_points' AND policyname='Users can insert their own points') THEN
    CREATE POLICY "Users can insert their own points" ON public.user_points FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_points' AND policyname='Users can update their own points') THEN
    CREATE POLICY "Users can update their own points" ON public.user_points FOR UPDATE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_points (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_points ON auth.users;
CREATE TRIGGER on_auth_user_created_points AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_points();

-- 6. BADGES
CREATE TABLE IF NOT EXISTS public.badges (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏆',
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='badges' AND policyname='Badges are publicly readable') THEN
    CREATE POLICY "Badges are publicly readable" ON public.badges FOR SELECT USING (true);
  END IF;
END $$;

-- 7. USER BADGES
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_badges' AND policyname='User badges are publicly readable') THEN
    CREATE POLICY "User badges are publicly readable" ON public.user_badges FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_badges' AND policyname='Users can earn badges') THEN
    CREATE POLICY "Users can earn badges" ON public.user_badges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 8. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.check_user_exists(p_email TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = auth, public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM auth.users WHERE email = p_email);
END;
$$;

-- 9. STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Avatar images are publicly accessible') THEN
    CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Users can upload their own avatar') THEN
    CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- ================================================================
-- 10. SEED 40 PRACTICE PROBLEMS
-- ================================================================
INSERT INTO public.problems (title, difficulty, concepts, type, time_estimate, description, examples, constraints, hint, default_code, test_cases) VALUES
-- EASY (10)
('Two Sum', 'Easy', ARRAY['Arrays','Hash Table'], 'Algorithm', '10 min', 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers that add up to `target`.', '[{"input":"nums=[2,7,11,15],target=9","output":"[0,1]","explanation":"nums[0]+nums[1]=9"}]'::jsonb, ARRAY['2<=nums.length<=10^4','Exactly one solution exists'], 'Use a hashmap to store complements.', 'def twoSum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target-n], i]\n        seen[n] = i', '[{"input":"[2,7,11,15],9","output":"[0,1]"},{"input":"[3,2,4],6","output":"[1,2]"}]'::jsonb),

('Valid Parentheses', 'Easy', ARRAY['Stack','Strings'], 'Algorithm', '10 min', 'Given a string `s` containing ''('', '')'', ''{'', ''}'', ''['' and '']'', determine if the input string is valid.', '[{"input":"s=''()[]{}''","output":"true"}]'::jsonb, ARRAY['1<=s.length<=10^4'], 'Push opening brackets, pop and match for closing ones.', 'def isValid(s):\n    pass', '[{"input":"''()[]{}''","output":"true"},{"input":"''(]''","output":"false"}]'::jsonb),

('Reverse Linked List', 'Easy', ARRAY['Linked List'], 'Algorithm', '10 min', 'Given the head of a singly linked list, reverse the list and return the reversed list.', '[{"input":"head=[1,2,3,4,5]","output":"[5,4,3,2,1]"}]'::jsonb, ARRAY['0<=number of nodes<=5000'], 'Use three pointers: prev, curr, next.', 'def reverseList(head):\n    pass', '[{"input":"[1,2,3,4,5]","output":"[5,4,3,2,1]"}]'::jsonb),

('Best Time to Buy and Sell Stock', 'Easy', ARRAY['Arrays','Greedy'], 'Algorithm', '10 min', 'Given an array `prices`, find the maximum profit from one buy-sell transaction.', '[{"input":"[7,1,5,3,6,4]","output":"5"}]'::jsonb, ARRAY['1<=prices.length<=10^5'], 'Track the minimum price seen so far.', 'def maxProfit(prices):\n    pass', '[{"input":"[7,1,5,3,6,4]","output":"5"},{"input":"[7,6,4,3,1]","output":"0"}]'::jsonb),

('Climbing Stairs', 'Easy', ARRAY['DP','Math'], 'Algorithm', '10 min', 'You can climb 1 or 2 steps at a time. How many distinct ways can you reach the top of an n-step staircase?', '[{"input":"n=3","output":"3"}]'::jsonb, ARRAY['1<=n<=45'], 'This is Fibonacci! ways(n) = ways(n-1) + ways(n-2).', 'def climbStairs(n):\n    pass', '[{"input":"3","output":"3"},{"input":"2","output":"2"}]'::jsonb),

('Missing Number', 'Easy', ARRAY['Arrays','Math'], 'Algorithm', '10 min', 'Given array nums containing n distinct numbers in range [0,n], return the missing number.', '[{"input":"[3,0,1]","output":"2"}]'::jsonb, ARRAY['1<=n<=10^4'], 'Expected sum = n*(n+1)/2, subtract actual sum.', 'def missingNumber(nums):\n    pass', '[{"input":"[3,0,1]","output":"2"},{"input":"[9,6,4,2,3,5,7,0,1]","output":"8"}]'::jsonb),

('Merge Two Sorted Lists', 'Easy', ARRAY['Linked List','Recursion'], 'Algorithm', '15 min', 'Merge two sorted linked lists and return it as a sorted list.', '[{"input":"l1=[1,2,4],l2=[1,3,4]","output":"[1,1,2,3,4,4]"}]'::jsonb, ARRAY['0<=nodes<=50'], 'Compare heads at each step; recurse or iterate.', 'def mergeTwoLists(l1, l2):\n    pass', '[{"input":"[1,2,4],[1,3,4]","output":"[1,1,2,3,4,4]"}]'::jsonb),

('Maximum Subarray', 'Easy', ARRAY['Arrays','DP'], 'Algorithm', '15 min', 'Find the contiguous subarray with the largest sum and return its sum.', '[{"input":"[-2,1,-3,4,-1,2,1,-5,4]","output":"6","explanation":"[4,-1,2,1] has sum 6"}]'::jsonb, ARRAY['1<=nums.length<=10^5'], 'Kadane''s algorithm: track current and global max.', 'def maxSubArray(nums):\n    pass', '[{"input":"[-2,1,-3,4,-1,2,1,-5,4]","output":"6"}]'::jsonb),

('Contains Duplicate', 'Easy', ARRAY['Arrays','Hash Table'], 'Algorithm', '10 min', 'Return true if any value appears at least twice in the array.', '[{"input":"[1,2,3,1]","output":"true"}]'::jsonb, ARRAY['1<=nums.length<=10^5'], 'Add elements to a set; if element already in set, return true.', 'def containsDuplicate(nums):\n    pass', '[{"input":"[1,2,3,1]","output":"true"},{"input":"[1,2,3,4]","output":"false"}]'::jsonb),

('Move Zeroes', 'Easy', ARRAY['Arrays','Two Pointers'], 'Algorithm', '10 min', 'Move all 0s to the end while maintaining relative order of non-zero elements.', '[{"input":"[0,1,0,3,12]","output":"[1,3,12,0,0]"}]'::jsonb, ARRAY['1<=nums.length<=10^4'], 'Use a slow pointer for the next non-zero insertion position.', 'def moveZeroes(nums):\n    pass', '[{"input":"[0,1,0,3,12]","output":"[1,3,12,0,0]"}]'::jsonb),

-- MEDIUM (25)
('Longest Substring Without Repeating Characters', 'Medium', ARRAY['Strings','Sliding Window'], 'Algorithm', '20 min', 'Find the length of the longest substring without repeating characters.', '[{"input":"s=''abcabcbb''","output":"3"}]'::jsonb, ARRAY['0<=s.length<=5*10^4'], 'Sliding window + a set to track characters.', 'def lengthOfLongestSubstring(s):\n    pass', '[{"input":"''abcabcbb''","output":"3"},{"input":"''bbbbb''","output":"1"}]'::jsonb),

('3Sum', 'Medium', ARRAY['Arrays','Two Pointers'], 'Algorithm', '25 min', 'Return all triplets [a,b,c] in nums such that a + b + c == 0 (no duplicate triplets).', '[{"input":"[-1,0,1,2,-1,-4]","output":"[[-1,-1,2],[-1,0,1]]"}]'::jsonb, ARRAY['0<=nums.length<=3000'], 'Sort first, then use two-pointer for each element.', 'def threeSum(nums):\n    pass', '[{"input":"[-1,0,1,2,-1,-4]","output":"[[-1,-1,2],[-1,0,1]]"}]'::jsonb),

('Product of Array Except Self', 'Medium', ARRAY['Arrays','Prefix Product'], 'Algorithm', '25 min', 'Return array where each element is the product of all other elements. No division allowed.', '[{"input":"[1,2,3,4]","output":"[24,12,8,6]"}]'::jsonb, ARRAY['2<=nums.length<=10^5','No division'], 'Use prefix products for left side, suffix products for right side.', 'def productExceptSelf(nums):\n    pass', '[{"input":"[1,2,3,4]","output":"[24,12,8,6]"}]'::jsonb),

('Group Anagrams', 'Medium', ARRAY['Strings','Hash Table'], 'Algorithm', '20 min', 'Group the anagrams together from an array of strings.', '[{"input":"[''eat'',''tea'',''tan'',''ate'',''nat'',''bat'']","output":"[[''bat''],[''nat'',''tan''],[''ate'',''eat'',''tea'']]"}]'::jsonb, ARRAY['1<=strs.length<=10^4'], 'Use sorted string as hash key.', 'from collections import defaultdict\ndef groupAnagrams(strs):\n    pass', '[{"input":"[''eat'',''tea'',''tan'',''ate'',''nat'',''bat'']","output":"grouped"}]'::jsonb),

('House Robber', 'Medium', ARRAY['DP'], 'Algorithm', '20 min', 'Max money you can rob from houses without robbing two adjacent houses.', '[{"input":"[2,7,9,3,1]","output":"12"}]'::jsonb, ARRAY['1<=nums.length<=100'], 'dp[i] = max(dp[i-1], dp[i-2] + nums[i])', 'def rob(nums):\n    pass', '[{"input":"[1,2,3,1]","output":"4"},{"input":"[2,7,9,3,1]","output":"12"}]'::jsonb),

('Coin Change', 'Medium', ARRAY['DP'], 'Algorithm', '30 min', 'Fewest coins needed to make up amount. Return -1 if impossible.', '[{"input":"coins=[1,5,11],amount=15","output":"3"}]'::jsonb, ARRAY['1<=coins.length<=12'], 'Bottom-up DP. dp[0]=0, dp[i] = min(dp[i-c]+1) for each coin c.', 'def coinChange(coins, amount):\n    pass', '[{"input":"[1,5,11],15","output":"3"},{"input":"[2],3","output":"-1"}]'::jsonb),

('Unique Paths', 'Medium', ARRAY['DP','Math'], 'Algorithm', '20 min', 'Count unique paths from top-left to bottom-right of an m×n grid moving only right or down.', '[{"input":"m=3,n=7","output":"28"}]'::jsonb, ARRAY['1<=m,n<=100'], 'dp[i][j] = dp[i-1][j] + dp[i][j-1].', 'def uniquePaths(m, n):\n    pass', '[{"input":"3,7","output":"28"},{"input":"3,2","output":"3"}]'::jsonb),

('Longest Increasing Subsequence', 'Medium', ARRAY['DP','Binary Search'], 'Algorithm', '30 min', 'Find the length of the longest strictly increasing subsequence.', '[{"input":"[10,9,2,5,3,7,101,18]","output":"4"}]'::jsonb, ARRAY['1<=nums.length<=2500'], 'Patience sorting with binary search for O(n log n).', 'def lengthOfLIS(nums):\n    pass', '[{"input":"[10,9,2,5,3,7,101,18]","output":"4"}]'::jsonb),

('Course Schedule', 'Medium', ARRAY['Graphs','Topological Sort'], 'Algorithm', '30 min', 'Determine if you can finish all courses given a list of prerequisites.', '[{"input":"numCourses=2,prerequisites=[[1,0]]","output":"true"}]'::jsonb, ARRAY['1<=numCourses<=2000'], 'Check for a cycle using DFS or Kahn''s algorithm.', 'def canFinish(numCourses, prerequisites):\n    pass', '[{"input":"2,[[1,0]]","output":"true"},{"input":"2,[[1,0],[0,1]]","output":"false"}]'::jsonb),

('Binary Tree Level Order Traversal', 'Medium', ARRAY['Trees','BFS'], 'Algorithm', '20 min', 'Return the level order traversal of binary tree nodes'' values.', '[{"input":"root=[3,9,20,null,null,15,7]","output":"[[3],[9,20],[15,7]]"}]'::jsonb, ARRAY['0<=nodes<=2000'], 'Use a queue. Process all nodes at current level before moving to next.', 'from collections import deque\ndef levelOrder(root):\n    pass', '[{"input":"[3,9,20,null,null,15,7]","output":"[[3],[9,20],[15,7]]"}]'::jsonb),

('Search in Rotated Sorted Array', 'Medium', ARRAY['Binary Search','Arrays'], 'Algorithm', '25 min', 'Search for target in a rotated sorted array. Return index or -1.', '[{"input":"[4,5,6,7,0,1,2],target=0","output":"4"}]'::jsonb, ARRAY['All values unique'], 'Modified binary search: determine which half is sorted.', 'def search(nums, target):\n    pass', '[{"input":"[4,5,6,7,0,1,2],0","output":"4"},{"input":"[4,5,6,7,0,1,2],3","output":"-1"}]'::jsonb),

('Merge Intervals', 'Medium', ARRAY['Arrays','Sorting'], 'Algorithm', '25 min', 'Merge all overlapping intervals in the given list.', '[{"input":"[[1,3],[2,6],[8,10],[15,18]]","output":"[[1,6],[8,10],[15,18]]"}]'::jsonb, ARRAY['1<=intervals.length<=10^4'], 'Sort by start time, then greedily merge overlapping pairs.', 'def merge(intervals):\n    pass', '[{"input":"[[1,3],[2,6],[8,10],[15,18]]","output":"[[1,6],[8,10],[15,18]]"}]'::jsonb),

('Find Minimum in Rotated Sorted Array', 'Medium', ARRAY['Binary Search','Arrays'], 'Algorithm', '20 min', 'Return the minimum element of a rotated sorted array of unique elements.', '[{"input":"[3,4,5,1,2]","output":"1"}]'::jsonb, ARRAY['All values unique'], 'Binary search comparing mid with the right boundary.', 'def findMin(nums):\n    pass', '[{"input":"[3,4,5,1,2]","output":"1"},{"input":"[4,5,6,7,0,1,2]","output":"0"}]'::jsonb),

('Set Matrix Zeroes', 'Medium', ARRAY['Arrays','Matrix'], 'Algorithm', '25 min', 'If an element is 0, set its entire row and column to 0. Do it in-place.', '[{"input":"[[1,1,1],[1,0,1],[1,1,1]]","output":"[[1,0,1],[0,0,0],[1,0,1]]"}]'::jsonb, ARRAY['1<=m,n<=200'], 'Use first row and column as markers to avoid extra space.', 'def setZeroes(matrix):\n    pass', '[{"input":"[[1,1,1],[1,0,1],[1,1,1]]","output":"[[1,0,1],[0,0,0],[1,0,1]]"}]'::jsonb),

('Spiral Matrix', 'Medium', ARRAY['Arrays','Matrix'], 'Algorithm', '25 min', 'Given an m x n matrix, return all elements of the matrix in spiral order.', '[{"input":"[[1,2,3],[4,5,6],[7,8,9]]","output":"[1,2,3,6,9,8,7,4,5]"}]'::jsonb, ARRAY['1<=m,n<=10'], 'Maintain 4 boundaries: top, bottom, left, right.', 'def spiralOrder(matrix):\n    pass', '[{"input":"[[1,2,3],[4,5,6],[7,8,9]]","output":"[1,2,3,6,9,8,7,4,5]"}]'::jsonb),

('Rotate Image', 'Medium', ARRAY['Arrays','Matrix'], 'Algorithm', '20 min', 'Rotate an n×n matrix by 90 degrees clockwise in-place.', '[{"input":"[[1,2,3],[4,5,6],[7,8,9]]","output":"[[7,4,1],[8,5,2],[9,6,3]]"}]'::jsonb, ARRAY['n==matrix.length==matrix[i].length','1<=n<=20'], 'Transpose then reverse each row.', 'def rotate(matrix):\n    pass', '[{"input":"[[1,2,3],[4,5,6],[7,8,9]]","output":"[[7,4,1],[8,5,2],[9,6,3]]"}]'::jsonb),

('Subsets', 'Medium', ARRAY['Backtracking','Bit Manipulation'], 'Algorithm', '20 min', 'Return all possible subsets (power set) of a unique integer array.', '[{"input":"[1,2,3]","output":"[[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]]"}]'::jsonb, ARRAY['1<=nums.length<=10'], 'For each element: include it or skip it recursively.', 'def subsets(nums):\n    pass', '[{"input":"[1,2,3]","output":"[[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]]"}]'::jsonb),

('Permutations', 'Medium', ARRAY['Backtracking','Recursion'], 'Algorithm', '25 min', 'Return all possible permutations of an array of distinct integers.', '[{"input":"[1,2,3]","output":"[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]"}]'::jsonb, ARRAY['1<=nums.length<=6'], 'Backtracking: pick any unused number at each step.', 'def permute(nums):\n    pass', '[{"input":"[1,2,3]","output":"6 permutations"}]'::jsonb),

('Letter Combinations of a Phone Number', 'Medium', ARRAY['Backtracking','Strings'], 'Algorithm', '20 min', 'Return all possible letter combinations from a digit string using phone keypad mapping.', '[{"input":"digits=''23''","output":"[''ad'',''ae'',''af'',''bd'',''be'',''bf'',''cd'',''ce'',''cf'']"}]'::jsonb, ARRAY['0<=digits.length<=4'], 'Map digits to letters, then backtrack building combinations.', 'def letterCombinations(digits):\n    pass', '[{"input":"''23''","output":"9 combinations"}]'::jsonb),

('Min Stack', 'Medium', ARRAY['Stack','Design'], 'Design', '20 min', 'Design a stack supporting push, pop, top, and getMin - all in O(1).', '[{"input":"push(-2),push(0),push(-3),getMin()","output":"-3"}]'::jsonb, ARRAY['All ops O(1) time'], 'Maintain a parallel aux stack tracking minimum at each level.', 'class MinStack:\n    def __init__(self):\n        self.stack = []\n        self.min_stack = []\n    def push(self, val): pass\n    def pop(self): pass\n    def top(self): pass\n    def getMin(self): pass', '[{"input":"push(-2),push(0),push(-3),getMin()","output":"-3"}]'::jsonb),

('Evaluate Reverse Polish Notation', 'Medium', ARRAY['Stack'], 'Algorithm', '20 min', 'Evaluate an arithmetic expression in Reverse Polish Notation.', '[{"input":"[''2'',''1'',''+'',''3'',''*'']","output":"9"}]'::jsonb, ARRAY['Operators are +,-,*,/', 'Division truncates toward zero'], 'Push numbers; pop two for each operator and push result.', 'def evalRPN(tokens):\n    pass', '[{"input":"[''2'',''1'',''+'',''3'',''*'']","output":"9"}]'::jsonb),

('Find All Anagrams in a String', 'Medium', ARRAY['Strings','Sliding Window'], 'Algorithm', '25 min', 'Return all start indices of p''s anagrams in s.', '[{"input":"s=''cbaebabacd'',p=''abc''","output":"[0,6]"}]'::jsonb, ARRAY['1<=s.length,p.length<=3*10^4'], 'Sliding window with two frequency count dicts.', 'def findAnagrams(s, p):\n    pass', '[{"input":"''cbaebabacd'',''abc''","output":"[0,6]"}]'::jsonb),

('Kth Largest Element in an Array', 'Medium', ARRAY['Heap','Sorting'], 'Algorithm', '25 min', 'Find the kth largest element in an unsorted array (kth in sorted order, not distinct).', '[{"input":"[3,2,1,5,6,4],k=2","output":"5"}]'::jsonb, ARRAY['1<=k<=nums.length<=10^4'], 'Use a min-heap of size k, or QuickSelect algorithm.', 'import heapq\ndef findKthLargest(nums, k):\n    pass', '[{"input":"[3,2,1,5,6,4],2","output":"5"},{"input":"[3,2,3,1,2,4,5,5,6],4","output":"4"}]'::jsonb),

('Rotate Array', 'Medium', ARRAY['Arrays'], 'Algorithm', '20 min', 'Rotate array nums to the right by k steps.', '[{"input":"nums=[1,2,3,4,5,6,7],k=3","output":"[5,6,7,1,2,3,4]"}]'::jsonb, ARRAY['1<=nums.length<=10^5','0<=k<=10^5'], 'Reverse whole array, then first k elements, then remaining.', 'def rotate(nums, k):\n    pass', '[{"input":"[1,2,3,4,5,6,7],3","output":"[5,6,7,1,2,3,4]"}]'::jsonb),

-- HARD (5)
('Trapping Rain Water', 'Hard', ARRAY['Arrays','Two Pointers','Stack'], 'Algorithm', '35 min', 'Given an elevation map, compute how much water it can trap after raining.', '[{"input":"[0,1,0,2,1,0,1,3,2,1,2,1]","output":"6"}]'::jsonb, ARRAY['1<=height.length<=2*10^4'], 'Two pointers: track max from left and right simultaneously.', 'def trap(height):\n    pass', '[{"input":"[0,1,0,2,1,0,1,3,2,1,2,1]","output":"6"},{"input":"[4,2,0,3,2,5]","output":"9"}]'::jsonb),

('Median of Two Sorted Arrays', 'Hard', ARRAY['Arrays','Binary Search'], 'Algorithm', '40 min', 'Given two sorted arrays, return their median. Time complexity must be O(log(m+n)).', '[{"input":"nums1=[1,3],nums2=[2]","output":"2.0"}]'::jsonb, ARRAY['0<=m,n<=1000','O(log(m+n)) required'], 'Binary search on the smaller array to find the correct partition.', 'def findMedianSortedArrays(nums1, nums2):\n    pass', '[{"input":"[1,3],[2]","output":"2.0"},{"input":"[1,2],[3,4]","output":"2.5"}]'::jsonb),

('Merge K Sorted Lists', 'Hard', ARRAY['Linked List','Heap','Divide and Conquer'], 'Algorithm', '40 min', 'Merge k sorted linked lists and return it as one sorted list.', '[{"input":"lists=[[1,4,5],[1,3,4],[2,6]]","output":"[1,1,2,3,4,4,5,6]"}]'::jsonb, ARRAY['0<=k<=10^4'], 'Use a min-heap (priority queue) tracking the current head of each list.', 'import heapq\ndef mergeKLists(lists):\n    pass', '[{"input":"[[1,4,5],[1,3,4],[2,6]]","output":"[1,1,2,3,4,4,5,6]"}]'::jsonb),

('Word Ladder', 'Hard', ARRAY['BFS','Graphs','Strings'], 'Algorithm', '40 min', 'Find the length of the shortest transformation sequence from beginWord to endWord, changing one letter at a time.', '[{"input":"beginWord=''hit'',endWord=''cog'',wordList=[''hot'',''dot'',''dog'',''lot'',''log'',''cog'']","output":"5"}]'::jsonb, ARRAY['1<=beginWord.length<=10'], 'BFS level by level changing one character at a time.', 'from collections import deque\ndef ladderLength(beginWord, endWord, wordList):\n    pass', '[{"input":"''hit'',''cog'',[''hot'',''dot'',''dog'',''lot'',''log'',''cog'']","output":"5"}]'::jsonb),

('Longest Valid Parentheses', 'Hard', ARRAY['Stack','DP','Strings'], 'Algorithm', '40 min', 'Given a string containing ''('' and '')'', find the length of the longest valid parentheses substring.', '[{"input":"s='')()())''","output":"4"}]'::jsonb, ARRAY['0<=s.length<=3*10^4'], 'Use a stack storing indices, or DP array.', 'def longestValidParentheses(s):\n    pass', '[{"input":"'')()())''","output":"4"},{"input":"''(()''","output":"2"}]'::jsonb)

ON CONFLICT (title) DO NOTHING;

-- Verify the result
SELECT COUNT(*) AS total_problems FROM public.problems;
