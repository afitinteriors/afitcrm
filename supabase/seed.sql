-- Local-dev-only seed data. Runs only against the LOCAL Supabase stack
-- (`supabase start` / `supabase db reset`) -- never against production,
-- which has no seed mechanism wired to it. Fake data only, no real
-- customer data, per CLAUDE.md's Live Data Safety rules.

-- Two test auth users (admin + staff), created the same way GoTrue
-- expects locally: a row in auth.users plus a matching auth.identities
-- row, per Supabase's own documented local-seeding pattern (pgcrypto
-- crypt() for the password hash). Passwords are throwaway/local-only.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'test-admin@afit.local',
   crypt('TestAdmin123!', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false, ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'test-staff@afit.local',
   crypt('TestStaff123!', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false, '')
on conflict (id) do nothing;

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"test-admin@afit.local"}', 'email', now(), now(), now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"test-staff@afit.local"}', 'email', now(), now(), now())
on conflict do nothing;

-- Matching profiles (this project creates profiles manually, not via an
-- auth trigger -- confirmed by inspecting the live schema dump).
insert into public.profiles (id, role, display_name) values
  ('11111111-1111-1111-1111-111111111111', 'admin', 'Test Admin'),
  ('22222222-2222-2222-2222-222222222222', 'staff', 'Test Staff')
on conflict (id) do nothing;

-- 10 fake test leads, obviously-fake data, spread across a few real
-- pipeline stages, all assigned to the fake staff test user.
insert into public.leads (
  customer_name, phone, source, campaign_name, location, project_type,
  service_required, estimated_sqft, status, assigned_to_id
) values
  ('Test Lead 01', '+910000000001', 'WhatsApp', 'Test Campaign A', 'Kollam', 'Residential', 'Gypsum Plastering', 1200, 'new', '22222222-2222-2222-2222-222222222222'),
  ('Test Lead 02', '+910000000002', 'WhatsApp', 'Test Campaign A', 'Kollam', 'Residential', 'Gypsum Plastering', 900,  'contacted', '22222222-2222-2222-2222-222222222222'),
  ('Test Lead 03', '+910000000003', 'Meta Ads', 'Test Campaign B', 'Kochi', 'Commercial', 'False Ceiling', 2000, 'qualified', '22222222-2222-2222-2222-222222222222'),
  ('Test Lead 04', '+910000000004', 'Meta Ads', 'Test Campaign B', 'Kochi', 'Residential', 'Interior', 1500, 'site_visit', '22222222-2222-2222-2222-222222222222'),
  ('Test Lead 05', '+910000000005', 'Referral', NULL, 'Trivandrum', 'Residential', 'Gypsum Plastering', 1100, 'quotation', '22222222-2222-2222-2222-222222222222'),
  ('Test Lead 06', '+910000000006', 'Phone', NULL, 'Trivandrum', 'Residential', 'Interior', 1800, 'negotiation', '22222222-2222-2222-2222-222222222222'),
  ('Test Lead 07', '+910000000007', 'Walk-in', NULL, 'Kollam', 'Residential', 'Gypsum Plastering', 1000, 'won', '22222222-2222-2222-2222-222222222222'),
  ('Test Lead 08', '+910000000008', 'WhatsApp', 'Test Campaign A', 'Kochi', 'Residential', 'Gypsum Plastering', 950,  'lost', '22222222-2222-2222-2222-222222222222'),
  ('Test Lead 09', '+910000000009', 'Website', NULL, 'Kollam', 'Commercial', 'False Ceiling', 2500, 'new', '22222222-2222-2222-2222-222222222222'),
  ('Test Lead 10', '+910000000010', 'Other', NULL, 'Trivandrum', 'Residential', 'Interior', 1300, 'contacted', '22222222-2222-2222-2222-222222222222')
on conflict do nothing;
