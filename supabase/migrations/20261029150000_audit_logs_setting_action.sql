-- The two new Settings mutations (WhatsApp Numbers, Team & Permissions
-- grants) need to record real audit events through the existing
-- recordAuditEvent()/audit_logs path, same as every other admin-only
-- mutation in this app. audit_logs.action and audit_logs.target_type each
-- have a CHECK constraint enumerating every allowed value (see
-- 20260920060000_...sql and 20261025120000_call_logs.sql for the same
-- action-widening pattern) -- adding 'setting_changed' / 'setting'
-- requires widening both. A single 'setting' target_type covers both
-- WhatsApp Numbers and Team & Permissions (and any future Settings
-- section) -- metadata.field on each event says which setting changed,
-- rather than adding one new target_type per section. No other change to
-- this table.

alter table public.audit_logs drop constraint audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check
check (action = any (array['login','logout','lead_viewed','lead_created','lead_updated','lead_deleted','conversation_viewed','message_sent','audit_log_viewed','follow_up_created','follow_up_completed','lead_assigned','call_logged','setting_changed']));

alter table public.audit_logs drop constraint audit_logs_target_type_check;
alter table public.audit_logs add constraint audit_logs_target_type_check
check (target_type = any (array['lead','conversation','message','follow_up','setting']));
