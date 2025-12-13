-- Add username column to profiles table
ALTER TABLE public.profiles ADD COLUMN username text;

-- Create unique index on username
CREATE UNIQUE INDEX idx_profiles_username ON public.profiles(username) WHERE username IS NOT NULL;