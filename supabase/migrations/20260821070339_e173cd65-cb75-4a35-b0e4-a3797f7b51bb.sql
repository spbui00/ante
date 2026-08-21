CREATE TYPE public.observation_status_enum AS ENUM ('ORDERED', 'PENDING', 'RESULTED', 'CANCELLED');

ALTER TABLE public.observation
  ADD COLUMN status public.observation_status_enum NOT NULL DEFAULT 'RESULTED',
  ADD COLUMN ordered_date date;