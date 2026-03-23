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
