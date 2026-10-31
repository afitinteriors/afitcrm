--
-- PostgreSQL database dump
--

\restrict 4YbCo3nCXyIHan03C3NfXKQ7AzYUjWIZ4koJonR3fQOvARD6upILPePBQQaQol2

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

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
-- Name: private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA private;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: is_admin(); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    );
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new is distinct from old then
    new.updated_at := now();
  end if;
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid NOT NULL,
    action text NOT NULL,
    target_type text,
    target_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_logs_action_check CHECK ((action = ANY (ARRAY['login'::text, 'logout'::text, 'lead_viewed'::text, 'lead_created'::text, 'lead_updated'::text, 'lead_deleted'::text, 'conversation_viewed'::text, 'message_sent'::text, 'audit_log_viewed'::text, 'follow_up_created'::text, 'follow_up_completed'::text, 'lead_assigned'::text]))),
    CONSTRAINT audit_logs_target_type_check CHECK ((target_type = ANY (ARRAY['lead'::text, 'conversation'::text, 'message'::text, 'follow_up'::text])))
);


--
-- Name: automation_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    media_type text NOT NULL,
    mime_type text NOT NULL,
    storage_path text NOT NULL,
    file_size_bytes bigint NOT NULL,
    meta_media_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT automation_media_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text, 'document'::text])))
);


--
-- Name: automation_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    automation_id uuid,
    matched_keyword text,
    matched_service_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    session_id uuid,
    CONSTRAINT automation_runs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'matched'::text, 'no_match'::text, 'failed'::text])))
);


--
-- Name: automation_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    automation_id uuid,
    current_node_id text NOT NULL,
    collected_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    last_message_id uuid,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT automation_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'failed'::text, 'handed_off'::text])))
);


--
-- Name: automations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    actions jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT automations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text])))
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid,
    wa_id text NOT NULL,
    phone_number_id text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);


--
-- Name: follow_ups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follow_ups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    type text DEFAULT 'follow_up'::text NOT NULL,
    due_date date NOT NULL,
    due_time time without time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    assigned_to_id uuid,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT follow_ups_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text]))),
    CONSTRAINT follow_ups_type_check CHECK ((type = ANY (ARRAY['call'::text, 'whatsapp_message'::text, 'site_visit'::text, 'quotation'::text, 'meeting'::text, 'follow_up'::text])))
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    customer_name text,
    phone text NOT NULL,
    whatsapp_message text,
    source text DEFAULT 'whatsapp'::text,
    campaign_name text,
    campaign_id text,
    adset_name text,
    adset_id text,
    ad_name text,
    ad_id text,
    location text,
    project_type text,
    service_required text,
    estimated_sqft numeric,
    expected_start_date date,
    status text DEFAULT 'new'::text,
    qualification_score integer,
    qualification_notes text,
    site_visit_date timestamp with time zone,
    quotation_amount numeric,
    job_value numeric,
    lost_reason text,
    assigned_to text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    wa_message_id text,
    wa_phone_number_id text,
    wa_message_timestamp timestamp with time zone,
    assigned_to_id uuid,
    merged_into_id uuid,
    CONSTRAINT leads_not_merged_into_self CHECK ((merged_into_id IS DISTINCT FROM id)),
    CONSTRAINT leads_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'qualified'::text, 'site_visit'::text, 'quotation'::text, 'negotiation'::text, 'won'::text, 'lost'::text, 'invalid'::text])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    wa_message_id text,
    direction text NOT NULL,
    message_type text NOT NULL,
    body text,
    media_id text,
    media_storage_path text,
    status text,
    raw_payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    entity_type text,
    entity_id uuid,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    route text,
    scheduled_for timestamp with time zone,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    read_at timestamp with time zone,
    dedupe_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    role text NOT NULL,
    display_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'staff'::text])))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_success_at timestamp with time zone,
    revoked_at timestamp with time zone
);


--
-- Name: service_keywords; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_keywords (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    keyword text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: automation_media automation_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_media
    ADD CONSTRAINT automation_media_pkey PRIMARY KEY (id);


--
-- Name: automation_runs automation_runs_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_message_id_key UNIQUE (message_id);


--
-- Name: automation_runs automation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_pkey PRIMARY KEY (id);


--
-- Name: automation_sessions automation_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_sessions
    ADD CONSTRAINT automation_sessions_pkey PRIMARY KEY (id);


--
-- Name: automations automations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: follow_ups follow_ups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: leads leads_wa_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_wa_message_id_key UNIQUE (wa_message_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: messages messages_wa_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_wa_message_id_key UNIQUE (wa_message_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_user_dedupe_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_dedupe_key UNIQUE (user_id, dedupe_key);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: service_keywords service_keywords_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_keywords
    ADD CONSTRAINT service_keywords_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action);


--
-- Name: audit_logs_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_actor_id_idx ON public.audit_logs USING btree (actor_id);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at DESC);


--
-- Name: audit_logs_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_target_idx ON public.audit_logs USING btree (target_type, target_id);


--
-- Name: automation_runs_automation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_runs_automation_id_idx ON public.automation_runs USING btree (automation_id);


--
-- Name: automation_runs_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_runs_conversation_id_idx ON public.automation_runs USING btree (conversation_id);


--
-- Name: automation_runs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_runs_status_idx ON public.automation_runs USING btree (status);


--
-- Name: automation_sessions_one_engaged_per_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX automation_sessions_one_engaged_per_conversation ON public.automation_sessions USING btree (conversation_id) WHERE (status = ANY (ARRAY['active'::text, 'handed_off'::text]));


--
-- Name: automations_one_active_per_service_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX automations_one_active_per_service_idx ON public.automations USING btree (service_id) WHERE (status = 'active'::text);


--
-- Name: conversations_lead_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_lead_id_idx ON public.conversations USING btree (lead_id);


--
-- Name: conversations_wa_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_wa_id_idx ON public.conversations USING btree (wa_id);


--
-- Name: conversations_wa_phone_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX conversations_wa_phone_unique_idx ON public.conversations USING btree (wa_id, phone_number_id) WHERE (created_at > '2026-10-07 13:38:03.537608+00'::timestamp with time zone);


--
-- Name: follow_ups_assigned_to_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX follow_ups_assigned_to_id_idx ON public.follow_ups USING btree (assigned_to_id);


--
-- Name: follow_ups_lead_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX follow_ups_lead_id_idx ON public.follow_ups USING btree (lead_id);


--
-- Name: leads_active_phone_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX leads_active_phone_unique_idx ON public.leads USING btree (phone) WHERE ((merged_into_id IS NULL) AND (created_at > '2026-09-20 10:32:47.325634+00'::timestamp with time zone));


--
-- Name: leads_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_campaign_idx ON public.leads USING btree (campaign_id);


--
-- Name: leads_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_created_at_idx ON public.leads USING btree (created_at);


--
-- Name: leads_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_phone_idx ON public.leads USING btree (phone);


--
-- Name: leads_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_status_idx ON public.leads USING btree (status);


--
-- Name: messages_conversation_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_conversation_id_created_at_idx ON public.messages USING btree (conversation_id, created_at);


--
-- Name: notifications_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: push_subscriptions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions USING btree (user_id);


--
-- Name: service_keywords_active_priority_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_keywords_active_priority_idx ON public.service_keywords USING btree (priority) WHERE is_active;


--
-- Name: service_keywords_active_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX service_keywords_active_unique_idx ON public.service_keywords USING btree (service_id, lower(keyword)) WHERE is_active;


--
-- Name: leads leads_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER leads_set_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id);


--
-- Name: automation_runs automation_runs_automation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE SET NULL;


--
-- Name: automation_runs automation_runs_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: automation_runs automation_runs_matched_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_matched_service_id_fkey FOREIGN KEY (matched_service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: automation_runs automation_runs_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: automation_runs automation_runs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.automation_sessions(id) ON DELETE SET NULL;


--
-- Name: automation_sessions automation_sessions_automation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_sessions
    ADD CONSTRAINT automation_sessions_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE SET NULL;


--
-- Name: automation_sessions automation_sessions_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_sessions
    ADD CONSTRAINT automation_sessions_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: automation_sessions automation_sessions_last_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_sessions
    ADD CONSTRAINT automation_sessions_last_message_id_fkey FOREIGN KEY (last_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: automations automations_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: follow_ups follow_ups_assigned_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.profiles(id);


--
-- Name: follow_ups follow_ups_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: leads leads_assigned_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;


--
-- Name: leads leads_merged_into_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_merged_into_id_fkey FOREIGN KEY (merged_into_id) REFERENCES public.leads(id) ON DELETE RESTRICT;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: service_keywords service_keywords_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_keywords
    ADD CONSTRAINT service_keywords_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_insert_self ON public.audit_logs FOR INSERT WITH CHECK ((actor_id = ( SELECT auth.uid() AS uid)));


--
-- Name: audit_logs audit_logs_select_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_select_admin_only ON public.audit_logs FOR SELECT USING (( SELECT private.is_admin() AS is_admin));


--
-- Name: automation_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_media ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_media automation_media_insert_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_media_insert_admin_only ON public.automation_media FOR INSERT WITH CHECK (private.is_admin());


--
-- Name: automation_media automation_media_select_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_media_select_admin_only ON public.automation_media FOR SELECT USING (private.is_admin());


--
-- Name: automation_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_runs automation_runs_select_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_runs_select_admin_only ON public.automation_runs FOR SELECT USING (private.is_admin());


--
-- Name: automation_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_sessions automation_sessions_handoff_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_sessions_handoff_admin_or_owner ON public.automation_sessions FOR UPDATE TO authenticated USING (((status = 'active'::text) AND (( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM (public.conversations c
     JOIN public.leads l ON ((l.id = c.lead_id)))
  WHERE ((c.id = automation_sessions.conversation_id) AND (l.assigned_to_id = ( SELECT auth.uid() AS uid)))))))) WITH CHECK (((status = 'handed_off'::text) AND (( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM (public.conversations c
     JOIN public.leads l ON ((l.id = c.lead_id)))
  WHERE ((c.id = automation_sessions.conversation_id) AND (l.assigned_to_id = ( SELECT auth.uid() AS uid))))))));


--
-- Name: automation_sessions automation_sessions_select_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_sessions_select_admin_or_owner ON public.automation_sessions FOR SELECT TO authenticated USING ((( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM (public.conversations c
     JOIN public.leads l ON ((l.id = c.lead_id)))
  WHERE ((c.id = automation_sessions.conversation_id) AND (l.assigned_to_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: automations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

--
-- Name: automations automations_delete_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automations_delete_admin_only ON public.automations FOR DELETE USING (private.is_admin());


--
-- Name: automations automations_insert_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automations_insert_admin_only ON public.automations FOR INSERT WITH CHECK (private.is_admin());


--
-- Name: automations automations_select_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automations_select_admin_only ON public.automations FOR SELECT USING (private.is_admin());


--
-- Name: automations automations_update_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automations_update_admin_only ON public.automations FOR UPDATE USING (private.is_admin()) WITH CHECK (private.is_admin());


--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations_insert_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_insert_admin_or_owner ON public.conversations FOR INSERT TO authenticated WITH CHECK ((( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM public.leads l
  WHERE ((l.id = conversations.lead_id) AND (l.assigned_to_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: conversations conversations_select_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_select_admin_or_owner ON public.conversations FOR SELECT TO authenticated USING ((( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM public.leads l
  WHERE ((l.id = conversations.lead_id) AND (l.assigned_to_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: conversations conversations_update_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_update_admin_or_owner ON public.conversations FOR UPDATE TO authenticated USING ((( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM public.leads l
  WHERE ((l.id = conversations.lead_id) AND (l.assigned_to_id = ( SELECT auth.uid() AS uid))))))) WITH CHECK ((( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM public.leads l
  WHERE ((l.id = conversations.lead_id) AND (l.assigned_to_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: follow_ups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

--
-- Name: follow_ups follow_ups_insert_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY follow_ups_insert_admin_or_owner ON public.follow_ups FOR INSERT WITH CHECK ((( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM public.leads l
  WHERE ((l.id = follow_ups.lead_id) AND (l.assigned_to_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: follow_ups follow_ups_select_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY follow_ups_select_admin_or_owner ON public.follow_ups FOR SELECT USING ((( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM public.leads l
  WHERE ((l.id = follow_ups.lead_id) AND (l.assigned_to_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: follow_ups follow_ups_update_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY follow_ups_update_admin_or_owner ON public.follow_ups FOR UPDATE USING ((( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM public.leads l
  WHERE ((l.id = follow_ups.lead_id) AND (l.assigned_to_id = ( SELECT auth.uid() AS uid))))))) WITH CHECK ((( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM public.leads l
  WHERE ((l.id = follow_ups.lead_id) AND (l.assigned_to_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: leads leads_delete_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leads_delete_admin_only ON public.leads FOR DELETE TO authenticated USING (( SELECT private.is_admin() AS is_admin));


--
-- Name: leads leads_insert_admin_or_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leads_insert_admin_or_self ON public.leads FOR INSERT TO authenticated WITH CHECK ((( SELECT private.is_admin() AS is_admin) OR (assigned_to_id = ( SELECT auth.uid() AS uid))));


--
-- Name: leads leads_select_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leads_select_admin_or_owner ON public.leads FOR SELECT TO authenticated USING ((( SELECT private.is_admin() AS is_admin) OR (assigned_to_id = ( SELECT auth.uid() AS uid))));


--
-- Name: leads leads_update_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leads_update_admin_or_owner ON public.leads FOR UPDATE TO authenticated USING ((( SELECT private.is_admin() AS is_admin) OR (assigned_to_id = ( SELECT auth.uid() AS uid)))) WITH CHECK ((( SELECT private.is_admin() AS is_admin) OR (assigned_to_id = ( SELECT auth.uid() AS uid))));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_insert_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_insert_admin_or_owner ON public.messages FOR INSERT TO authenticated WITH CHECK ((( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM (public.conversations c
     JOIN public.leads l ON ((l.id = c.lead_id)))
  WHERE ((c.id = messages.conversation_id) AND (l.assigned_to_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: messages messages_select_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_select_admin_or_owner ON public.messages FOR SELECT TO authenticated USING ((( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM (public.conversations c
     JOIN public.leads l ON ((l.id = c.lead_id)))
  WHERE ((c.id = messages.conversation_id) AND (l.assigned_to_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: messages messages_update_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_update_admin_or_owner ON public.messages FOR UPDATE TO authenticated USING ((( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM (public.conversations c
     JOIN public.leads l ON ((l.id = c.lead_id)))
  WHERE ((c.id = messages.conversation_id) AND (l.assigned_to_id = ( SELECT auth.uid() AS uid))))))) WITH CHECK ((( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM (public.conversations c
     JOIN public.leads l ON ((l.id = c.lead_id)))
  WHERE ((c.id = messages.conversation_id) AND (l.assigned_to_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: notifications notifications_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select_self_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_self_or_admin ON public.profiles FOR SELECT TO authenticated USING (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_admin() AS is_admin)));


--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions push_subscriptions_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: push_subscriptions push_subscriptions_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: push_subscriptions push_subscriptions_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: push_subscriptions push_subscriptions_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subscriptions_update_own ON public.push_subscriptions FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: service_keywords; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_keywords ENABLE ROW LEVEL SECURITY;

--
-- Name: service_keywords service_keywords_delete_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_keywords_delete_admin_only ON public.service_keywords FOR DELETE USING (private.is_admin());


--
-- Name: service_keywords service_keywords_insert_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_keywords_insert_admin_only ON public.service_keywords FOR INSERT WITH CHECK (private.is_admin());


--
-- Name: service_keywords service_keywords_select_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_keywords_select_admin_only ON public.service_keywords FOR SELECT USING (private.is_admin());


--
-- Name: service_keywords service_keywords_update_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_keywords_update_admin_only ON public.service_keywords FOR UPDATE USING (private.is_admin()) WITH CHECK (private.is_admin());


--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: services services_delete_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_delete_admin_only ON public.services FOR DELETE USING (private.is_admin());


--
-- Name: services services_insert_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_insert_admin_only ON public.services FOR INSERT WITH CHECK (private.is_admin());


--
-- Name: services services_select_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_select_admin_only ON public.services FOR SELECT USING (private.is_admin());


--
-- Name: services services_update_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_update_admin_only ON public.services FOR UPDATE USING (private.is_admin()) WITH CHECK (private.is_admin());


--
-- Name: SCHEMA private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA private TO authenticated;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION private.is_admin() TO authenticated;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.set_updated_at() FROM PUBLIC;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;


--
-- Name: TABLE automation_media; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.automation_media TO anon;
GRANT ALL ON TABLE public.automation_media TO authenticated;
GRANT ALL ON TABLE public.automation_media TO service_role;


--
-- Name: TABLE automation_runs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.automation_runs TO anon;
GRANT ALL ON TABLE public.automation_runs TO authenticated;
GRANT ALL ON TABLE public.automation_runs TO service_role;


--
-- Name: TABLE automation_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.automation_sessions TO anon;
GRANT ALL ON TABLE public.automation_sessions TO authenticated;
GRANT ALL ON TABLE public.automation_sessions TO service_role;


--
-- Name: TABLE automations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.automations TO anon;
GRANT ALL ON TABLE public.automations TO authenticated;
GRANT ALL ON TABLE public.automations TO service_role;


--
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversations TO anon;
GRANT ALL ON TABLE public.conversations TO authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;


--
-- Name: TABLE follow_ups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.follow_ups TO anon;
GRANT ALL ON TABLE public.follow_ups TO authenticated;
GRANT ALL ON TABLE public.follow_ups TO service_role;


--
-- Name: TABLE leads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.leads TO anon;
GRANT ALL ON TABLE public.leads TO authenticated;
GRANT ALL ON TABLE public.leads TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: COLUMN notifications.read_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(read_at) ON TABLE public.notifications TO authenticated;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE push_subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;


--
-- Name: TABLE service_keywords; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.service_keywords TO anon;
GRANT ALL ON TABLE public.service_keywords TO authenticated;
GRANT ALL ON TABLE public.service_keywords TO service_role;


--
-- Name: TABLE services; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.services TO anon;
GRANT ALL ON TABLE public.services TO authenticated;
GRANT ALL ON TABLE public.services TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict 4YbCo3nCXyIHan03C3NfXKQ7AzYUjWIZ4koJonR3fQOvARD6upILPePBQQaQol2

