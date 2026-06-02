-- Make event slug uniqueness organizer-scoped instead of global.
-- This allows different organizers to use the same slug while preserving
-- uniqueness for URLs inside a single organizer's namespace.

alter table public.events
  drop constraint if exists events_slug_unique;

alter table public.events
  add constraint events_slug_organizer_unique unique (organizer_id, slug);

