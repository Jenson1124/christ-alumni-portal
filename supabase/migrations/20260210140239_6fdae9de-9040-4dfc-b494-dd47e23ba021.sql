
-- Fix overly permissive policies on event_photos
DROP POLICY "Insert event photos" ON public.event_photos;
DROP POLICY "Delete event photos" ON public.event_photos;
CREATE POLICY "Auth insert event photos" ON public.event_photos FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "Auth delete event photos" ON public.event_photos FOR DELETE TO authenticated USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'director'));

-- Fix overly permissive policies on event_attendees
DROP POLICY "Manage event attendees insert" ON public.event_attendees;
DROP POLICY "Manage event attendees delete" ON public.event_attendees;
CREATE POLICY "Auth insert event attendees" ON public.event_attendees FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'director')
    OR EXISTS (
      SELECT 1 FROM public.events e WHERE e.id = event_id AND e.department_id = public.get_user_department_id(auth.uid())
    )
  );
CREATE POLICY "Auth delete event attendees" ON public.event_attendees FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'director')
    OR EXISTS (
      SELECT 1 FROM public.events e WHERE e.id = event_id AND e.department_id = public.get_user_department_id(auth.uid())
    )
  );

-- Fix overly permissive insert on activity_logs
DROP POLICY "Insert activity logs" ON public.activity_logs;
CREATE POLICY "Auth insert own logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
