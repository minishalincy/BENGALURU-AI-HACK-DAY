-- Add new columns for the three features
ALTER TABLE public.event_recordings 
ADD COLUMN IF NOT EXISTS creation_mode text DEFAULT 'creator',
ADD COLUMN IF NOT EXISTS key_takeaways jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS recommended_platforms jsonb DEFAULT '[]'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.event_recordings.creation_mode IS 'Either speaker or creator mode';
COMMENT ON COLUMN public.event_recordings.key_takeaways IS 'Array of key takeaway strings extracted from content';
COMMENT ON COLUMN public.event_recordings.recommended_platforms IS 'AI-recommended platforms based on content analysis';