-- Create enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.user_gender AS ENUM ('masculino', 'femenino', 'otro');
CREATE TYPE public.app_module AS ENUM ('politica', 'futbol');
CREATE TYPE public.question_scope AS ENUM ('general', 'specific');

-- Create parties table
CREATE TABLE public.parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert initial Spanish political parties
INSERT INTO public.parties (name) VALUES
  ('PSOE'),
  ('Partido Popular'),
  ('VOX'),
  ('Sumar'),
  ('ERC'),
  ('Junts'),
  ('PNV'),
  ('Bildu'),
  ('BNG'),
  ('Podemos'),
  ('Compromís'),
  ('Ciudadanos'),
  ('Ninguno/Apolítico');

-- Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert initial La Liga teams
INSERT INTO public.teams (name) VALUES
  ('Real Madrid'),
  ('FC Barcelona'),
  ('Atlético de Madrid'),
  ('Athletic Club'),
  ('Real Sociedad'),
  ('Real Betis'),
  ('Villarreal CF'),
  ('Sevilla FC'),
  ('Valencia CF'),
  ('Girona FC'),
  ('Getafe CF'),
  ('RCD Espanyol'),
  ('Rayo Vallecano'),
  ('Celta de Vigo'),
  ('CA Osasuna'),
  ('RCD Mallorca'),
  ('UD Las Palmas'),
  ('Deportivo Alavés'),
  ('CD Leganés'),
  ('Real Valladolid'),
  ('Libre/Sin equipo');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  phone TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  gender user_gender NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 13 AND age <= 120),
  party_id UUID REFERENCES public.parties(id),
  team_id UUID REFERENCES public.teams(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

-- Create questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  module app_module NOT NULL,
  scope question_scope NOT NULL,
  party_id UUID REFERENCES public.parties(id),
  team_id UUID REFERENCES public.teams(id),
  week_start_date DATE NOT NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CHECK (
    (scope = 'general' AND party_id IS NULL AND team_id IS NULL) OR
    (scope = 'specific' AND (party_id IS NOT NULL OR team_id IS NOT NULL))
  )
);

-- Create answer_options table
CREATE TABLE public.answer_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  option_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_answers table
CREATE TABLE public.user_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  answer_option_id UUID REFERENCES public.answer_options(id) ON DELETE CASCADE NOT NULL,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, question_id)
);

-- Enable RLS
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for parties
CREATE POLICY "Everyone can view parties" ON public.parties FOR SELECT USING (true);
CREATE POLICY "Admins can insert parties" ON public.parties FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update parties" ON public.parties FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete parties" ON public.parties FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for teams
CREATE POLICY "Everyone can view teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Admins can insert teams" ON public.teams FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update teams" ON public.teams FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete teams" ON public.teams FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for questions
CREATE POLICY "Everyone can view questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Admins can insert questions" ON public.questions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update questions" ON public.questions FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete questions" ON public.questions FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for answer_options
CREATE POLICY "Everyone can view answer options" ON public.answer_options FOR SELECT USING (true);
CREATE POLICY "Admins can insert answer options" ON public.answer_options FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update answer options" ON public.answer_options FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete answer options" ON public.answer_options FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_answers
CREATE POLICY "Users can view own answers" ON public.user_answers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all answers" ON public.user_answers FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own answers" ON public.user_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own answers" ON public.user_answers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own answers" ON public.user_answers FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_profiles_phone ON public.profiles(phone);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_questions_module ON public.questions(module);
CREATE INDEX idx_questions_week ON public.questions(week_start_date);
CREATE INDEX idx_user_answers_user_id ON public.user_answers(user_id);
CREATE INDEX idx_user_answers_question_id ON public.user_answers(question_id);