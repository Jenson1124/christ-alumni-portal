import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { FileText, Download } from "lucide-react";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import { useNavigate } from "react-router-dom";

export default function Reports() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const isDirector = userRole?.role === "director";
  const isHod = userRole?.role === "hod";

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("events").select("id, title, event_date, departments(name)").order("event_date", { ascending: false });
      setEvents(data || []);
    };
    fetch();
  }, []);

  const exportCSV = async () => {
    if (!selectedEvent) { toast({ title: "Select an event", variant: "destructive" }); return; }
    const { data: event } = await supabase.from("events").select("title").eq("id", selectedEvent).maybeSingle();
    const { data: attendees } = await supabase.from("event_attendees").select("*, alumni(name, email, graduation_year, degree, company)").eq("event_id", selectedEvent);
    const csv = Papa.unparse((attendees || []).map(a => ({
      name: a.alumni?.name, email: a.alumni?.email, year: a.alumni?.graduation_year, degree: a.alumni?.degree, company: a.alumni?.company,
    })));
    const blob = new Blob([csv], { type: "text/csv" });
    saveAs(blob, `${event?.title || "event"}_attendees.csv`);
    toast({ title: "CSV exported" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Reports</h2>
        <Card>
          <CardHeader><CardTitle className="text-base">Generate Event Report</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select an event and navigate to its detail page to generate a professional PDF/DOCX report with full event details, feedback, and photos.
            </p>
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger><SelectValue placeholder="Select an event" /></SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.title} — {e.departments?.name} ({e.event_date || "No date"})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              {(isDirector || isHod) && selectedEvent && (
                <Button onClick={() => navigate(`/events/${selectedEvent}`)}>
                  <FileText className="mr-2 h-4 w-4" />Open Event & Generate Report
                </Button>
              )}
              <Button variant="outline" onClick={exportCSV} disabled={!selectedEvent}><Download className="mr-2 h-4 w-4" />Export Attendees CSV</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
