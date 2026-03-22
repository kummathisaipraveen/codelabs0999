-- Phase 5: Ontology & Mastery Persistence

-- 1. Concepts Table
CREATE TABLE IF NOT EXISTS public.concepts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Prerequisites (Edges) Table
CREATE TABLE IF NOT EXISTS public.prerequisites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id TEXT REFERENCES public.concepts(id) ON DELETE CASCADE,
    prerequisite_id TEXT REFERENCES public.concepts(id) ON DELETE CASCADE,
    UNIQUE(concept_id, prerequisite_id)
);

-- 3. User Mastery Table
CREATE TABLE IF NOT EXISTS public.user_mastery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    concept_id TEXT REFERENCES public.concepts(id) ON DELETE CASCADE,
    mastered BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, concept_id)
);

-- Seed Initial Concepts
INSERT INTO public.concepts (id, name, description) VALUES
('Variables', 'Variables', 'Storing and naming data'),
('Data Types', 'Data Types', 'Strings, Integers, Booleans'),
('Conditionals', 'Conditionals', 'Logic with if/else'),
('Loops', 'Loops', 'For and while loops'),
('Functions', 'Functions', 'Reusable code blocks'),
('Recursion', 'Recursion', 'Functions that call themselves'),
('Lists', 'Lists', 'Ordered collections'),
('Dictionaries', 'Dictionaries', 'Key-value pairs'),
('Classes', 'Classes', 'Object-oriented programming')
ON CONFLICT (id) DO NOTHING;

-- Seed Initial Prerequisites
INSERT INTO public.prerequisites (concept_id, prerequisite_id) VALUES
('Data Types', 'Variables'),
('Conditionals', 'Data Types'),
('Loops', 'Conditionals'),
('Functions', 'Loops'),
('Recursion', 'Functions'),
('Lists', 'Data Types'),
('Dictionaries', 'Lists'),
('Classes', 'Functions'),
('Classes', 'Dictionaries')
ON CONFLICT DO NOTHING;
