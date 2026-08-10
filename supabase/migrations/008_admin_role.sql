-- Admin role and account status for platform management.
-- Bootstrap first admin (run once in Supabase SQL editor):
--   UPDATE public.profiles SET role = 'admin' WHERE id = '<your-user-uuid>';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended'));

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role);
CREATE INDEX IF NOT EXISTS profiles_status_idx ON public.profiles (status);

COMMENT ON COLUMN public.profiles.role IS 'Platform role: user or admin';
COMMENT ON COLUMN public.profiles.status IS 'Account status: active or suspended';
