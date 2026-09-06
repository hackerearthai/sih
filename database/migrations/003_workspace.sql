ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'Central Investigations';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS case_reference TEXT NOT NULL DEFAULT '';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(user_id);
ALTER TABLE public.access_log_cache ADD COLUMN IF NOT EXISTS detail TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS public.notification_reads (
  user_id UUID NOT NULL REFERENCES public.users(user_id),
  doc_id UUID NOT NULL REFERENCES public.documents(doc_id),
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, doc_id)
);
