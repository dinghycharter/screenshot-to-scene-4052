-- Run after 0000_dinghycharter_core.sql.
-- Seeds only the public catalog; does not add demo profiles, boats, or bookings.

insert into public.classes (slug, name, category, crew, sort_order) values
  ('ilca-4', 'ILCA 4', 'Youth singlehanded', 1, 1),
  ('ilca-6', 'ILCA 6', 'Olympic singlehanded', 1, 2),
  ('ilca-7', 'ILCA 7', 'Olympic singlehanded', 1, 3),
  ('420', '420', 'Youth doublehanded', 2, 4),
  ('470', '470', 'Olympic mixed doublehanded', 2, 5),
  ('49er', '49er', 'Olympic skiff', 2, 6),
  ('49erfx', '49erFX', 'Olympic skiff', 2, 7),
  ('nacra-17', 'Nacra 17', 'Olympic foiling catamaran', 2, 8),
  ('optimist', 'Optimist', 'Junior singlehanded', 1, 9),
  ('rs-aero', 'RS Aero', 'Singlehanded', 1, 10),
  ('finn', 'Finn', 'Heavyweight singlehanded', 1, 11)
on conflict (slug) do nothing;

insert into public.events (slug, name, city, country, start_date, end_date, description, sort_order) values
  ('trofeo-princesa-sofia', 'Trofeo Princesa Sofia', 'Palma de Mallorca', 'Spain', '2027-03-27', '2027-04-03', 'The season-opening Olympic class regatta in the Bay of Palma.', 1),
  ('french-olympic-week', 'French Olympic Week', 'Hyères', 'France', '2027-04-17', '2027-04-24', 'Semaine Olympique Française on the Mediterranean waters of Hyères.', 2),
  ('kiel-week', 'Kiel Week', 'Kiel', 'Germany', '2027-06-19', '2027-06-27', 'The world''s largest sailing event on the Baltic.', 3),
  ('lake-garda-meeting', 'Lake Garda Meeting', 'Riva del Garda', 'Italy', '2027-03-24', '2027-03-28', 'The legendary Easter Optimist regatta on Lake Garda.', 4),
  ('ilca-worlds', 'ILCA Worlds', 'Vilamoura', 'Portugal', '2027-07-10', '2027-07-18', 'World championship for the ILCA classes.', 5),
  ('470-worlds', '470 Worlds', 'Cádiz', 'Spain', '2027-09-04', '2027-09-12', 'World championship for the 470 class.', 6),
  ('420-worlds', '420 Worlds', 'Balatonfüred', 'Hungary', '2027-07-24', '2027-08-01', 'World championship for the 420 class.', 7)
on conflict (slug) do nothing;
