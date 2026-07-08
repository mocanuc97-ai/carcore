-- CarCore Seed Data for local development
-- This creates a demo tenant and sample data.
-- After seeding, create a user in Studio or via sign-up and link the profile manually or via app.

-- Demo tenant (Service Auto Demo)
insert into public.tenants (id, name, slug, phone, email, address)
values (
  '11111111-1111-1111-1111-111111111111',
  'Service Auto Demo SRL',
  'demo-service',
  '0722123456',
  'contact@demo-service.ro',
  'Str. Garajului 15, București'
) on conflict (id) do nothing;

-- Demo ANAF connection (simulated as connected for testing e-Factura)
insert into public.tenant_anaf_connections (tenant_id, cui, status, connection_type, access_token, token_expires_at)
values (
  '11111111-1111-1111-1111-111111111111',
  'RO12345678',
  'connected',
  'oauth',
  'SIMULATED_DEMO_TOKEN',
  (now() + interval '2 hours')::timestamptz
) on conflict (tenant_id) do nothing;

-- Demo services (predefined prices)
insert into public.services (tenant_id, name, price, duration_minutes, description) values
('11111111-1111-1111-1111-111111111111', 'Schimb ulei + filtru', 250.00, 45, 'Ulei motor + filtru ulei + filtru aer'),
('11111111-1111-1111-1111-111111111111', 'Revizie completa', 650.00, 120, 'Ulei, filtre, bujii, lichid frana'),
('11111111-1111-1111-1111-111111111111', 'Schimb placute frana fata', 380.00, 60, 'Placuta fata + discuri daca e nevoie'),
('11111111-1111-1111-1111-111111111111', 'Diagnostic computerizat', 120.00, 30, 'Citire erori + diagnostic'),
('11111111-1111-1111-1111-111111111111', 'Schimb distributie', 1450.00, 240, 'Kit distributie complet'),
('11111111-1111-1111-1111-111111111111', 'Vulcanizare roata', 80.00, 20, 'Montare + echilibrare');

-- Sample client
insert into public.clients (id, tenant_id, name, phone, email, address) values
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Ion Popescu', '0744556677', 'ion.popescu@email.com', 'Str. Florilor 22, București')
on conflict (id) do nothing;

-- Sample vehicle
insert into public.vehicles (id, tenant_id, client_id, make, model, year, vin, license_plate, mileage) values
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Volkswagen', 'Golf 7', 2018, 'WVWZZZ1KZJW123456', 'B-123-ABC', 87500)
on conflict (id) do nothing;

-- Sample interventions
insert into public.interventions (tenant_id, vehicle_id, description, performed_at, photos, total_price) values
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Schimb ulei + filtru ulei + filtru polen', now() - interval '3 months', '{}', 250.00),
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Revizie periodica completa + diagnostic', now() - interval '1 month', '{}', 650.00);

-- Sample appointment
insert into public.appointments (tenant_id, client_id, vehicle_id, scheduled_at, status, notes) values
('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', now() + interval '2 days', 'confirmed', 'Clientul a cerut verificare suspensie');

-- Sample parts purchased from distributors for the vehicle
insert into public.parts (tenant_id, vehicle_id, name, distributor, quantity, purchase_price, selling_price) values
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Plăcuțe frână față', 'București Parts', 1, 180, 320),
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Filtru ulei', 'Autovit Distribution', 2, 45, 95);

-- Note: To create the admin user:
-- 1. Go to Studio (http://127.0.0.1:54323)
-- 2. Authentication > Users > Add user (email: admin@demo.ro , password: parola123)
-- 3. Then run this in SQL editor to link:
-- INSERT INTO public.profiles (id, tenant_id, full_name, role, email)
-- VALUES ('<user-uuid-from-auth>', '11111111-1111-1111-1111-111111111111', 'Admin Demo', 'admin', 'admin@demo.ro');

-- Reception user can be added similarly with role 'reception'