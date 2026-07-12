-- Replace the estimated durations for a few key services with official
-- Autodata labor times, looked up live via workshop.autodata-group.com for
-- a Volkswagen Golf IV 1.6 16V (a common reference vehicle) at the user's
-- request. Applied as an UPDATE against the already-seeded rows (from
-- 20260712000000) rather than editing that migration, since it's already
-- applied to production.
--
-- Source figures (Autodata "Calculator estimativ", VW Golf IV 1.6 16V):
--   Service 30000 km / 24 luni ................. 1.60 h
--   Plăcuțe frână față — demontare/montare ...... 0.70 h
--   Plăcuțe frână spate — demontare/montare ..... 0.60 h
--   Disc frână față (ambele) — demontare/montare  0.90 h
-- "Schimb discuri + plăcuțe frână față" combines the disc + pad times
-- (0.90 + 0.70 = 1.60 h). Only duration_minutes is touched — prices are
-- left as the shop's own figures, not Autodata's (Autodata doesn't set
-- RON prices, only official labor time).
update public.services set duration_minutes = 96
where lower(name) = lower('Revizie completă');

update public.services set duration_minutes = 42
where lower(name) = lower('Schimb plăcuțe frână față');

update public.services set duration_minutes = 36
where lower(name) = lower('Schimb plăcuțe frână spate');

update public.services set duration_minutes = 96
where lower(name) = lower('Schimb discuri + plăcuțe frână față');
