-- Adds simulation_config JSONB column to profiles
-- Stores user's configured locations for trip simulation
ALTER TABLE vat_km.profiles
ADD COLUMN IF NOT EXISTS simulation_config jsonb
DEFAULT '{"locations": []}'::jsonb;
