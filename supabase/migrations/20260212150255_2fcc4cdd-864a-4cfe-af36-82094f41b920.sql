
-- Add new columns to events table for enhanced event creation
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type text DEFAULT 'seminar',
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS coordinator_name text,
  ADD COLUMN IF NOT EXISTS expected_participants integer,
  ADD COLUMN IF NOT EXISTS speaker_name text,
  ADD COLUMN IF NOT EXISTS speaker_designation text,
  ADD COLUMN IF NOT EXISTS speaker_organization text,
  ADD COLUMN IF NOT EXISTS speaker_bio text;

-- Create event_report_data table for storing report metadata when generating reports
CREATE TABLE IF NOT EXISTS public.event_report_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  introduction text,
  event_summary text,
  key_highlights text,
  outcomes text,
  speaker_rating text DEFAULT 'good',
  speaker_feedback text,
  overall_rating integer DEFAULT 3,
  was_useful boolean DEFAULT true,
  what_went_well text,
  what_to_improve text,
  future_suggestions text,
  conclusion text,
  students_attended integer DEFAULT 0,
  external_guests integer DEFAULT 0,
  coordinator_name text,
  approved_by text,
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_report_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View report data" ON public.event_report_data FOR SELECT
  USING (
    has_role(auth.uid(), 'director'::app_role) OR
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_report_data.event_id AND e.department_id = get_user_department_id(auth.uid()))
  );

CREATE POLICY "Insert report data" ON public.event_report_data FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'director'::app_role) OR
    has_role(auth.uid(), 'hod'::app_role)
  );

CREATE POLICY "Delete report data" ON public.event_report_data FOR DELETE
  USING (has_role(auth.uid(), 'director'::app_role));
