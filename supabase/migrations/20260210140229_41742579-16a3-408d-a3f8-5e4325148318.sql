
-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('director', 'hod', 'department_admin');

-- 2. Departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. User roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  UNIQUE (user_id, role)
);

-- 4. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  signature_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Alumni table
CREATE TABLE public.alumni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  graduation_year INTEGER,
  batch TEXT,
  degree TEXT,
  placement_status TEXT DEFAULT 'unknown',
  company TEXT,
  designation TEXT,
  profile_photo_url TEXT,
  address TEXT,
  linkedin_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  event_time TIME,
  venue TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Event photos
CREATE TABLE public.event_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Event attendees
CREATE TABLE public.event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  alumni_id UUID NOT NULL REFERENCES public.alumni(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, alumni_id)
);

-- 9. Announcements
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'all', -- 'all' or 'department'
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Activity logs
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. System settings
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_alumni_updated_at BEFORE UPDATE ON public.alumni FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 14. Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: get user's department_id
CREATE OR REPLACE FUNCTION public.get_user_department_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM public.user_roles
  WHERE user_id = _user_id LIMIT 1
$$;

-- 15. Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 16. RLS Policies

-- DEPARTMENTS: All authenticated users can read, only directors can modify
CREATE POLICY "Anyone can view departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Directors can insert departments" ON public.departments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'director'));
CREATE POLICY "Directors can update departments" ON public.departments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'director'));
CREATE POLICY "Directors can delete departments" ON public.departments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'director'));

-- USER_ROLES: Directors can manage, users can see their own
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'director'));
CREATE POLICY "Directors can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'director'));
CREATE POLICY "Directors can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'director'));
CREATE POLICY "Directors can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'director'));

-- PROFILES: Users see own + directors see all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'director'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ALUMNI: Directors see all, HODs/admins see their dept
CREATE POLICY "Directors view all alumni" ON public.alumni FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'director'));
CREATE POLICY "Dept users view dept alumni" ON public.alumni FOR SELECT TO authenticated USING (department_id = public.get_user_department_id(auth.uid()));
CREATE POLICY "Directors insert alumni" ON public.alumni FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'director'));
CREATE POLICY "Dept users insert dept alumni" ON public.alumni FOR INSERT TO authenticated WITH CHECK (department_id = public.get_user_department_id(auth.uid()));
CREATE POLICY "Directors update alumni" ON public.alumni FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'director'));
CREATE POLICY "Dept users update dept alumni" ON public.alumni FOR UPDATE TO authenticated USING (department_id = public.get_user_department_id(auth.uid()));
CREATE POLICY "Directors delete alumni" ON public.alumni FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'director'));
CREATE POLICY "Dept users delete dept alumni" ON public.alumni FOR DELETE TO authenticated USING (department_id = public.get_user_department_id(auth.uid()));

-- EVENTS: Same pattern as alumni
CREATE POLICY "Directors view all events" ON public.events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'director'));
CREATE POLICY "Dept users view dept events" ON public.events FOR SELECT TO authenticated USING (department_id = public.get_user_department_id(auth.uid()) OR department_id IS NULL);
CREATE POLICY "Authenticated insert events" ON public.events FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'director') OR department_id = public.get_user_department_id(auth.uid()));
CREATE POLICY "Authenticated update events" ON public.events FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'director') OR department_id = public.get_user_department_id(auth.uid()));
CREATE POLICY "Authenticated delete events" ON public.events FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'director') OR department_id = public.get_user_department_id(auth.uid()));

-- EVENT PHOTOS: Follow event access
CREATE POLICY "View event photos" ON public.event_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert event photos" ON public.event_photos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Delete event photos" ON public.event_photos FOR DELETE TO authenticated USING (true);

-- EVENT ATTENDEES
CREATE POLICY "View event attendees" ON public.event_attendees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage event attendees insert" ON public.event_attendees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Manage event attendees delete" ON public.event_attendees FOR DELETE TO authenticated USING (true);

-- ANNOUNCEMENTS
CREATE POLICY "View announcements" ON public.announcements FOR SELECT TO authenticated USING (target = 'all' OR department_id = public.get_user_department_id(auth.uid()) OR public.has_role(auth.uid(), 'director'));
CREATE POLICY "Directors insert announcements" ON public.announcements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'director') OR (public.has_role(auth.uid(), 'hod') AND department_id = public.get_user_department_id(auth.uid())));
CREATE POLICY "Directors delete announcements" ON public.announcements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'director') OR created_by = auth.uid());

-- ACTIVITY LOGS: Directors see all, users see own
CREATE POLICY "Directors view all logs" ON public.activity_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'director'));
CREATE POLICY "Users view own logs" ON public.activity_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Insert activity logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- SYSTEM SETTINGS: Directors manage, all read
CREATE POLICY "Anyone can read settings" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Directors manage settings" ON public.system_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'director'));
CREATE POLICY "Directors update settings" ON public.system_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'director'));

-- 17. Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('alumni-photos', 'alumni-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('event-photos', 'event-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('department-logos', 'department-logos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false);

-- Storage policies
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Auth update avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

CREATE POLICY "Public read alumni-photos" ON storage.objects FOR SELECT USING (bucket_id = 'alumni-photos');
CREATE POLICY "Auth upload alumni-photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'alumni-photos');

CREATE POLICY "Public read event-photos" ON storage.objects FOR SELECT USING (bucket_id = 'event-photos');
CREATE POLICY "Auth upload event-photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-photos');

CREATE POLICY "Public read dept-logos" ON storage.objects FOR SELECT USING (bucket_id = 'department-logos');
CREATE POLICY "Auth upload dept-logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'department-logos');
CREATE POLICY "Auth update dept-logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'department-logos');

CREATE POLICY "Auth read signatures" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'signatures');
CREATE POLICY "Auth upload signatures" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signatures');
CREATE POLICY "Auth update signatures" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'signatures');

CREATE POLICY "Auth read reports" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'reports');
CREATE POLICY "Auth upload reports" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reports');

-- 18. Indexes for performance
CREATE INDEX idx_alumni_department ON public.alumni(department_id);
CREATE INDEX idx_alumni_graduation_year ON public.alumni(graduation_year);
CREATE INDEX idx_alumni_placement_status ON public.alumni(placement_status);
CREATE INDEX idx_events_department ON public.events(department_id);
CREATE INDEX idx_events_date ON public.events(event_date);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX idx_announcements_department ON public.announcements(department_id);
