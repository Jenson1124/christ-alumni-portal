import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Calendar, MapPin, Trash2, Eye, Users, Mic, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const EVENT_TYPES = ["Seminar", "Webinar", "Workshop", "Meetup", "Hackathon", "Conference", "Guest Lecture", "Cultural", "Sports", "Other"];
const EVENT_MODES = ["Offline", "Online", "Hybrid"];

const emptyForm = {
  title: "", description: "", event_date: "", event_time: "", venue: "",
  department_id: "", event_type: "Seminar", mode: "Offline",
  coordinator_name: "", expected_participants: "",
  speaker_name: "", speaker_designation: "", speaker_organization: "", speaker_bio: "",
};

export default function Events() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isDirector = userRole?.role === "director";

  // Effective department: auto-assign for non-Director users
  const effectiveDeptId = isDirector ? form.department_id : userRole?.department_id;

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("*, departments(name)").order("event_date", { ascending: false });
    setEvents(data || []);
  };

  const fetchDepts = async () => {
    const { data } = await supabase.from("departments").select("id, name").order("name");
    setDepartments(data || []);
  };

  useEffect(() => { fetchEvents(); fetchDepts(); }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.event_date) e.event_date = "Date is required";
    if (!form.event_time) e.event_time = "Time is required";
    if (!form.venue.trim()) e.venue = "Venue is required";
    if (!form.coordinator_name.trim()) e.coordinator_name = "Coordinator name is required";
    // Only validate department selection for Director
    if (isDirector && !form.department_id) e.department_id = "Department is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!effectiveDeptId) {
      toast({ title: "Error", description: "Department mapping missing. Contact administrator.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const payload: any = {
      title: form.title.trim(),
      description: form.description.trim(),
      event_date: form.event_date,
      event_time: form.event_time,
      venue: form.venue.trim(),
      department_id: effectiveDeptId,
      event_type: form.event_type.toLowerCase(),
      mode: form.mode.toLowerCase(),
      coordinator_name: form.coordinator_name.trim(),
      expected_participants: form.expected_participants ? Number(form.expected_participants) : null,
      speaker_name: form.speaker_name.trim() || null,
      speaker_designation: form.speaker_designation.trim() || null,
      speaker_organization: form.speaker_organization.trim() || null,
      speaker_bio: form.speaker_bio.trim() || null,
    };

    let error;
    if (editingEvent) {
      ({ error } = await supabase.from("events").update(payload).eq("id", editingEvent.id));
    } else {
      ({ error } = await supabase.from("events").insert(payload));
    }

    setLoading(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: editingEvent ? "Event updated" : "Event created" });
      setDialogOpen(false);
      setEditingEvent(null);
      setForm({ ...emptyForm });
      setErrors({});
      fetchEvents();
    }
  };

  const handleEdit = (evt: any) => {
    setEditingEvent(evt);
    setForm({
      title: evt.title || "",
      description: evt.description || "",
      event_date: evt.event_date || "",
      event_time: evt.event_time || "",
      venue: evt.venue || "",
      department_id: evt.department_id || "",
      event_type: (evt.event_type || "seminar").charAt(0).toUpperCase() + (evt.event_type || "seminar").slice(1),
      mode: (evt.mode || "offline").charAt(0).toUpperCase() + (evt.mode || "offline").slice(1),
      coordinator_name: evt.coordinator_name || "",
      expected_participants: evt.expected_participants?.toString() || "",
      speaker_name: evt.speaker_name || "",
      speaker_designation: evt.speaker_designation || "",
      speaker_organization: evt.speaker_organization || "",
      speaker_bio: evt.speaker_bio || "",
    });
    setErrors({});
    setDialogOpen(true);
  };

  const canEditEvent = (evt: any) => isDirector || (evt.department_id === userRole?.department_id);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Deleted" }); fetchEvents(); }
  };

  const FieldError = ({ field }: { field: string }) => errors[field] ? <p className="text-xs text-destructive">{errors[field]}</p> : null;

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Events</h2>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingEvent(null); setForm({ ...emptyForm }); setErrors({}); } }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Create Event</Button></DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader><DialogTitle>{editingEvent ? "Edit Event" : "Create Event"}</DialogTitle></DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-1">
                  <Label>Title *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Event title" />
                  <FieldError field="title" />
                </div>
                <div className="grid gap-1">
                  <Label>Description *</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Event description" rows={3} />
                  <FieldError field="description" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1"><Label>Date *</Label><Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /><FieldError field="event_date" /></div>
                  <div className="grid gap-1"><Label>Time *</Label><Input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} /><FieldError field="event_time" /></div>
                </div>
                <div className="grid gap-1"><Label>Venue *</Label><Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Event venue" /><FieldError field="venue" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label>Event Type</Label>
                    <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1">
                    <Label>Mode</Label>
                    <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{EVENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {isDirector && (
                  <div className="grid gap-1">
                    <Label>Department *</Label>
                    <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                      <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FieldError field="department_id" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1"><Label>Coordinator Name *</Label><Input value={form.coordinator_name} onChange={(e) => setForm({ ...form, coordinator_name: e.target.value })} /><FieldError field="coordinator_name" /></div>
                  <div className="grid gap-1"><Label>Expected Participants</Label><Input type="number" value={form.expected_participants} onChange={(e) => setForm({ ...form, expected_participants: e.target.value })} /></div>
                </div>
                <div className="border-t pt-3">
                  <Label className="text-sm font-semibold flex items-center gap-1 mb-3"><Mic className="h-4 w-4" />Speaker Details (Optional)</Label>
                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1"><Label className="text-xs">Speaker Name</Label><Input value={form.speaker_name} onChange={(e) => setForm({ ...form, speaker_name: e.target.value })} /></div>
                      <div className="grid gap-1"><Label className="text-xs">Designation</Label><Input value={form.speaker_designation} onChange={(e) => setForm({ ...form, speaker_designation: e.target.value })} /></div>
                    </div>
                    <div className="grid gap-1"><Label className="text-xs">Organization</Label><Input value={form.speaker_organization} onChange={(e) => setForm({ ...form, speaker_organization: e.target.value })} /></div>
                    <div className="grid gap-1"><Label className="text-xs">Short Bio</Label><Textarea value={form.speaker_bio} onChange={(e) => setForm({ ...form, speaker_bio: e.target.value })} rows={2} /></div>
                  </div>
                </div>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? "Saving..." : editingEvent ? "Save Changes" : "Create Event"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.length === 0 ? (
            <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">No events yet</CardContent></Card>
          ) : events.map((e, idx) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.25 }}
            >
              <Card className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5" onClick={() => navigate(`/events/${e.id}`)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-lg">{e.title}</h3>
                    <div className="flex gap-1">
                      {e.event_type && <Badge variant="outline" className="text-[10px] capitalize">{e.event_type}</Badge>}
                      {e.mode && <Badge variant="secondary" className="text-[10px] capitalize">{e.mode}</Badge>}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{e.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {e.event_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(e.event_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
                    {e.venue && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.venue}</span>}
                    {e.expected_participants && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{e.expected_participants}</span>}
                  </div>
                  {e.departments?.name && <span className="text-xs text-primary">{e.departments.name}</span>}
                  <div className="flex justify-end gap-1 pt-2">
                    <Button variant="ghost" size="icon" onClick={(ev) => { ev.stopPropagation(); navigate(`/events/${e.id}`); }}><Eye className="h-4 w-4" /></Button>
                    {canEditEvent(e) && (
                      <Button variant="ghost" size="icon" onClick={(ev) => { ev.stopPropagation(); handleEdit(e); }}><Edit className="h-4 w-4" /></Button>
                    )}
                    {canEditEvent(e) && (
                      <Button variant="ghost" size="icon" onClick={(ev) => { ev.stopPropagation(); handleDelete(e.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
