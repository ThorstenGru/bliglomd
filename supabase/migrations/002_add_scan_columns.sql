-- Add breach_names and breach_count columns to scans table
-- Replaces old hibp_breaches jsonb and category_suggestions jsonb fields

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS breach_names text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS breach_count  int    DEFAULT 0;

-- Migrate existing rows if any (best effort)
UPDATE public.scans
  SET breach_names = ARRAY(
        SELECT jsonb_array_elements_text(hibp_breaches)
      ),
      breach_count = jsonb_array_length(hibp_breaches)
  WHERE hibp_breaches IS NOT NULL
    AND jsonb_typeof(hibp_breaches) = 'array';
