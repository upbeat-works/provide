INSERT INTO indicators (id, sector) VALUES
  ('Heat-Wave Magnitude Index daily (HMWId)', 'urban-climate'),
  ('Nights with Maximum Temperatures above 20 °C', 'urban-climate'),
  ('Nights with Maximum Temperatures above 25 °C', 'urban-climate'),
  ('Nights with Maximum Temperatures above 28 °C', 'urban-climate'),
  ('High Heat Risk', 'urban-climate'),
  ('Mean Air Temperature', 'terrestrial-climate'),
  ('Maximum Air Temperature', 'terrestrial-climate')
ON CONFLICT (id) DO UPDATE SET sector = EXCLUDED.sector;
