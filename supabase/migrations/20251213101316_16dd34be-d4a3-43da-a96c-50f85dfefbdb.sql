-- Add columns to store generated content and platforms
ALTER TABLE public.event_recordings 
ADD COLUMN IF NOT EXISTS platforms text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS generated_content jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS additional_context text;

-- Add index for faster user queries
CREATE INDEX IF NOT EXISTS idx_event_recordings_user_created 
ON public.event_recordings(user_id, created_at DESC);