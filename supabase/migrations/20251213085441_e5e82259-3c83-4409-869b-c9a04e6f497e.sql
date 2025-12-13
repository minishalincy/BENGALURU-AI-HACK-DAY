-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-recordings', 'event-recordings', false);

-- Create policies for audio storage
CREATE POLICY "Users can upload their own recordings"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'event-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own recordings"
ON storage.objects
FOR SELECT
USING (bucket_id = 'event-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own recordings"
ON storage.objects
FOR DELETE
USING (bucket_id = 'event-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create table for event recordings
CREATE TABLE public.event_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  audio_url TEXT,
  transcription TEXT,
  insights JSONB,
  linkedin_post TEXT,
  instagram_caption TEXT,
  twitter_thread TEXT,
  status TEXT NOT NULL DEFAULT 'recording',
  duration_seconds INTEGER,
  event_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_recordings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own recordings"
ON public.event_recordings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recordings"
ON public.event_recordings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recordings"
ON public.event_recordings
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recordings"
ON public.event_recordings
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_event_recordings_updated_at
BEFORE UPDATE ON public.event_recordings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();