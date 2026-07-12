-- Revert the Golf-IV-specific Autodata labor times added in
-- 20260712010000 and 20260712020000. Repair times vary too much by
-- make/model/engine for a single reference vehicle's figures to be a
-- meaningful default for every tenant's generic service list — the user
-- decided to drop this approach rather than mislead shops with numbers
-- that only apply to one specific car. Confirmed via SQL that none of the
-- touched/added services had ever been used on a real invoice before
-- reverting (0 invoice_items references for all of them).

-- Restore the original estimated durations these services had before the
-- Autodata detour.
update public.services set duration_minutes = 120
where lower(name) = lower('Revizie completă');

update public.services set duration_minutes = 60
where lower(name) = lower('Schimb plăcuțe frână față');

update public.services set duration_minutes = 60
where lower(name) = lower('Schimb plăcuțe frână spate');

update public.services set duration_minutes = 90
where lower(name) = lower('Schimb discuri + plăcuțe frână față');

-- Remove the two services that only existed because of this detour.
delete from public.services
where lower(name) in (lower('Schimb ambreiaj (set complet)'), lower('Schimb discuri + plăcuțe frână spate'));

-- Remove the matching intervention catalog entry added alongside them.
delete from public.intervention_catalog
where lower(name) = lower('Schimb ambreiaj (set complet)');
