ALTER TABLE public.programs
ADD COLUMN intro_video_url TEXT;

ALTER TABLE public.programs
ADD CONSTRAINT programs_intro_video_url_https_check
CHECK (
  intro_video_url IS NULL
  OR (
    char_length(intro_video_url) <= 2048
    AND intro_video_url ~* '^https://[^[:space:]]+$'
  )
);
