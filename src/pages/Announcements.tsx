import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Megaphone, Trash2 } from "lucide-react";

export default function Announcements() {
  const { userRole, user } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", target: "all", department_id: "" });
  const [loading, setLoading] = useState(false);
  const isDirector = userRole?.role === "director";

  const fetchAnnouncements = async () => {
    const { data } = await supabase.from("announcements").select("*, departments(name)").order("created_at", { ascending: false });
    setAnnouncements(data || []);
  };

  const fetchDepts = async () => {
    const { data } = await supabase.from("departments").select("id, name").order("name");
    setDepartments(data || []);
  };

  useEffect(() => { fetchAnnouncements(); fetchDepts(); }, []);

  const handleSave = async () => {
    if (!form.title.trim() || !form.message.trim()) { toast({ title: "Title and message required", variant: "destructive" }); return; }
    setLoading(true);
    const payload = {
      title: form.title, message: form.message, target: form.target,
      department_id: form.target === "department" ? (form.department_id || userRole?.department_id) : null,
      created_by: user?.id,
    };
    const { error } = await supabase.from("announcements").insert(payload);
    setLoading(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Announcement sent" }); setDialogOpen(false); setForm({ title: "", message: "", target: "all", department_id: "" }); fetchAnnouncements(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Deleted" }); fetchAnnouncements(); }
  };

  const canCreate = isDirector || userRole?.role === "hod";

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Announcements</h2>
          {canCreate && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />New Announcement</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Message</Label><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} /></div>
                  {isDirector && (
                    <div className="grid gap-2">
                      <Label>Target</Label>
                      <Select value={form.target} onValueChange={(v) => setForm({ ...form, target: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="department">Specific Department</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {isDirector && form.target === "department" && (
                    <div className="grid gap-2">
                      <Label>Department</Label>
                      <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                        <SelectContent>{departments.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button onClick={handleSave} disabled={loading}>{loading ? "Sending..." : "Send Announcement"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="space-y-3">
          {announcements.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No announcements yet</CardContent></Card>
          ) : announcements.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Megaphone className="mt-1 h-5 w-5 text-primary shrink-0" />
                    <div>
                      <h3 className="font-semibold">{a.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{a.message}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs capitalize">{a.target === "all" ? "All" : a.departments?.name}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  {(isDirector || a.created_by === user?.id) && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
