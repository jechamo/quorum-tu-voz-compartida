CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_module; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_module AS ENUM (
    'politica',
    'futbol'
);


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: question_scope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.question_scope AS ENUM (
    'general',
    'specific'
);


--
-- Name: user_gender; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_gender AS ENUM (
    'masculino',
    'femenino',
    'otro'
);


--
-- Name: create_initial_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_initial_admin() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  admin_exists BOOLEAN;
BEGIN
  -- Check if admin creation marker exists
  SELECT EXISTS (
    SELECT 1 FROM public.system_config WHERE key = 'admin_created'
  ) INTO admin_exists;
  
  IF NOT admin_exists THEN
    -- Insert marker to prevent duplicate creation
    INSERT INTO public.system_config (key, value)
    VALUES ('admin_created', 'pending');
  END IF;
END;
$$;


--
-- Name: get_question_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_question_stats(question_uuid uuid) RETURNS TABLE(option_id uuid, option_text text, option_order integer, vote_count bigint, total_votes bigint, percentage integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH vote_counts AS (
    SELECT 
      ao.id,
      ao.text,
      ao.option_order,
      COUNT(ua.id) as votes
    FROM answer_options ao
    LEFT JOIN user_answers ua ON ua.answer_option_id = ao.id
    WHERE ao.question_id = question_uuid
    GROUP BY ao.id, ao.text, ao.option_order
  ),
  total AS (
    SELECT COALESCE(SUM(votes), 0) as total_votes FROM vote_counts
  )
  SELECT 
    vc.id as option_id,
    vc.text as option_text,
    vc.option_order,
    vc.votes as vote_count,
    t.total_votes,
    CASE 
      WHEN t.total_votes > 0 THEN ROUND((vc.votes::numeric / t.total_votes) * 100)::integer
      ELSE 0
    END as percentage
  FROM vote_counts vc, total t
  ORDER BY vc.option_order;
$$;


--
-- Name: get_question_stats_filtered(uuid, uuid, uuid, public.user_gender, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_question_stats_filtered(question_uuid uuid, filter_party_id uuid DEFAULT NULL::uuid, filter_team_id uuid DEFAULT NULL::uuid, filter_gender public.user_gender DEFAULT NULL::public.user_gender, filter_age_min integer DEFAULT NULL::integer, filter_age_max integer DEFAULT NULL::integer) RETURNS TABLE(option_id uuid, option_text text, option_order integer, vote_count bigint, total_votes bigint, percentage integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH filtered_answers AS (
    SELECT ua.id, ua.answer_option_id
    FROM user_answers ua
    INNER JOIN profiles p ON p.id = ua.user_id
    WHERE ua.question_id = question_uuid
      AND (filter_party_id IS NULL OR p.party_id = filter_party_id)
      AND (filter_team_id IS NULL OR p.team_id = filter_team_id)
      AND (filter_gender IS NULL OR p.gender = filter_gender)
      AND (filter_age_min IS NULL OR p.age >= filter_age_min)
      AND (filter_age_max IS NULL OR p.age <= filter_age_max)
  ),
  vote_counts AS (
    SELECT 
      ao.id,
      ao.text,
      ao.option_order,
      COUNT(fa.id) as votes
    FROM answer_options ao
    LEFT JOIN filtered_answers fa ON fa.answer_option_id = ao.id
    WHERE ao.question_id = question_uuid
    GROUP BY ao.id, ao.text, ao.option_order
  ),
  total AS (
    SELECT COALESCE(SUM(votes), 0) as total_votes FROM vote_counts
  )
  SELECT 
    vc.id as option_id,
    vc.text as option_text,
    vc.option_order,
    vc.votes as vote_count,
    t.total_votes,
    CASE 
      WHEN t.total_votes > 0 THEN ROUND((vc.votes::numeric / t.total_votes) * 100)::integer
      ELSE 0
    END as percentage
  FROM vote_counts vc, total t
  ORDER BY vc.option_order;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


SET default_table_access_method = heap;

--
-- Name: answer_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.answer_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_id uuid NOT NULL,
    text text NOT NULL,
    option_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: parties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    phone text NOT NULL,
    username text NOT NULL,
    gender public.user_gender NOT NULL,
    age integer NOT NULL,
    party_id uuid,
    team_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT profiles_age_check CHECK (((age >= 13) AND (age <= 120)))
);


--
-- Name: question_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_id uuid NOT NULL,
    user_id uuid NOT NULL,
    comment text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT comment_not_empty CHECK ((length(TRIM(BOTH FROM comment)) > 0))
);


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    text text NOT NULL,
    module public.app_module NOT NULL,
    scope public.question_scope NOT NULL,
    party_id uuid,
    team_id uuid,
    week_start_date date NOT NULL,
    is_mandatory boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT questions_check CHECK ((((scope = 'general'::public.question_scope) AND (party_id IS NULL) AND (team_id IS NULL)) OR ((scope = 'specific'::public.question_scope) AND ((party_id IS NOT NULL) OR (team_id IS NOT NULL)))))
);


--
-- Name: system_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_config (
    key text NOT NULL,
    value text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    question_id uuid NOT NULL,
    answer_option_id uuid NOT NULL,
    answered_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL
);


--
-- Name: answer_options answer_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answer_options
    ADD CONSTRAINT answer_options_pkey PRIMARY KEY (id);


--
-- Name: parties parties_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parties
    ADD CONSTRAINT parties_name_key UNIQUE (name);


--
-- Name: parties parties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parties
    ADD CONSTRAINT parties_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_phone_key UNIQUE (phone);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: question_comments question_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_comments
    ADD CONSTRAINT question_comments_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: system_config system_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_pkey PRIMARY KEY (key);


--
-- Name: teams teams_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_name_key UNIQUE (name);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: user_answers user_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_answers
    ADD CONSTRAINT user_answers_pkey PRIMARY KEY (id);


--
-- Name: user_answers user_answers_user_id_question_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_answers
    ADD CONSTRAINT user_answers_user_id_question_id_key UNIQUE (user_id, question_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_profiles_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_phone ON public.profiles USING btree (phone);


--
-- Name: idx_profiles_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_username ON public.profiles USING btree (username);


--
-- Name: idx_question_comments_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_comments_created_at ON public.question_comments USING btree (created_at DESC);


--
-- Name: idx_question_comments_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_comments_question_id ON public.question_comments USING btree (question_id);


--
-- Name: idx_question_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_comments_user_id ON public.question_comments USING btree (user_id);


--
-- Name: idx_questions_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_module ON public.questions USING btree (module);


--
-- Name: idx_questions_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_week ON public.questions USING btree (week_start_date);


--
-- Name: idx_user_answers_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_answers_question_id ON public.user_answers USING btree (question_id);


--
-- Name: idx_user_answers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_answers_user_id ON public.user_answers USING btree (user_id);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: answer_options answer_options_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answer_options
    ADD CONSTRAINT answer_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id);


--
-- Name: profiles profiles_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: question_comments question_comments_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_comments
    ADD CONSTRAINT question_comments_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- Name: question_comments question_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_comments
    ADD CONSTRAINT question_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: questions questions_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id);


--
-- Name: questions questions_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: user_answers user_answers_answer_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_answers
    ADD CONSTRAINT user_answers_answer_option_id_fkey FOREIGN KEY (answer_option_id) REFERENCES public.answer_options(id) ON DELETE CASCADE;


--
-- Name: user_answers user_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_answers
    ADD CONSTRAINT user_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- Name: user_answers user_answers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_answers
    ADD CONSTRAINT user_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_profiles_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: answer_options Admins can delete answer options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete answer options" ON public.answer_options FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: question_comments Admins can delete any comment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete any comment" ON public.question_comments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: parties Admins can delete parties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete parties" ON public.parties FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: questions Admins can delete questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete questions" ON public.questions FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: teams Admins can delete teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete teams" ON public.teams FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: answer_options Admins can insert answer options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert answer options" ON public.answer_options FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: parties Admins can insert parties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert parties" ON public.parties FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: questions Admins can insert questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert questions" ON public.questions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: teams Admins can insert teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert teams" ON public.teams FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: answer_options Admins can update answer options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update answer options" ON public.answer_options FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: parties Admins can update parties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update parties" ON public.parties FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: questions Admins can update questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update questions" ON public.questions FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: teams Admins can update teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update teams" ON public.teams FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_answers Admins can view all answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all answers" ON public.user_answers FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: answer_options Everyone can view answer options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view answer options" ON public.answer_options FOR SELECT USING (true);


--
-- Name: parties Everyone can view parties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view parties" ON public.parties FOR SELECT USING (true);


--
-- Name: questions Everyone can view questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view questions" ON public.questions FOR SELECT USING (true);


--
-- Name: teams Everyone can view teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view teams" ON public.teams FOR SELECT USING (true);


--
-- Name: system_config Only admins can insert system config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can insert system config" ON public.system_config FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: system_config Only admins can view system config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can view system config" ON public.system_config FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_answers Users can delete own answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own answers" ON public.user_answers FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: question_comments Users can delete own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own comments" ON public.question_comments FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_answers Users can insert own answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own answers" ON public.user_answers FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: question_comments Users can insert own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own comments" ON public.question_comments FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: user_roles Users can insert own user role during signup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own user role during signup" ON public.user_roles FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (role = 'user'::public.app_role)));


--
-- Name: user_answers Users can update own answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own answers" ON public.user_answers FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: question_comments Users can update own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own comments" ON public.question_comments FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: question_comments Users can view all comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all comments" ON public.question_comments FOR SELECT TO authenticated USING (true);


--
-- Name: profiles Users can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);


--
-- Name: user_answers Users can view own answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own answers" ON public.user_answers FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: answer_options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.answer_options ENABLE ROW LEVEL SECURITY;

--
-- Name: parties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: question_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.question_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

--
-- Name: system_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: user_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


