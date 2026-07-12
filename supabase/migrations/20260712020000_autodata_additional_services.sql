-- Additional Autodata-sourced labor times for a Volkswagen Golf IV 1.6 16V,
-- gathered across every "Calculator estimativ" category at the user's
-- request (Service, Frâne, Ambreiaj, Sistem de răcire, Sisteme electrice).
--
-- New services entirely missing from the earlier seed (added now that real
-- labor times are known):
--   Unitate ambreiaj (disc, capac, rulment) — demontare/montare .. 3.30 h
--   Disc + plăcuțe frână spate (0.90 h + 0.60 h) ................ 1.50 h
--
-- Already-seeded figures cross-checked and left as-is (within a few minutes
-- of the official time, not worth churning):
--   Schimb baterie auto: seeded 20 min vs Autodata 0.30 h (18 min)
--   Pompă de apă (2.50 h) folds into the existing "kit complet" distribuție
--   entry, whose 240 min estimate already covers a belt+pump job in that range.
insert into public.services (tenant_id, name, price, duration_minutes, description)
select t.id, v.name, v.price, v.duration_minutes, v.description
from public.tenants t
cross join (values
  ('Schimb ambreiaj (set complet)', 1400.00, 198, 'Disc, placă presiune, rulment de decuplare — manoperă Autodata 3.30h'),
  ('Schimb discuri + plăcuțe frână spate', 500.00, 90, 'Set complet spate — manoperă Autodata 1.50h')
) as v(name, price, duration_minutes, description)
where not exists (
  select 1 from public.services s
  where s.tenant_id = t.id and lower(s.name) = lower(v.name)
);

-- Matching catalog entry for the intervention quick-pick list
insert into public.intervention_catalog (tenant_id, name, sort_order)
select t.id, 'Schimb ambreiaj (set complet)', 45
from public.tenants t
on conflict (tenant_id, name) do nothing;
