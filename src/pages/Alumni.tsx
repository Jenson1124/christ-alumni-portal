import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, Upload, Download, Edit, Trash2, ImageIcon, X } from "lucide-react";
import Papa from "papaparse";
import { motion } from "framer-motion";

export default function AlumniPage() {
  const { userRole } = useAuth();
  const [alumni, setAlumni] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAlumni, setEditingAlumni] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", graduation_year: "", batch: "", degree: "", placement_status: "unknown", company: "", designation: "", department_id: "", linkedin_url: "", address: "", notes: "" });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const isDirector = userRole?.role === "director";
  // Auto-assign department for non-Director users — never ask them
  const effectiveDeptId = isDirector ? form.department_id : userRole?.department_id;

  const fetchAlumni = async () => {
    let query = supabase.from("alumni").select("*, departments(name)").order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (search) query = query.ilike("name", `%${search}%`);
    if (filterDept !== "all") query = query.eq("department_id", filterDept);
    if (filterYear !== "all") query = query.eq("graduation_year", Number(filterYear));
    if (filterStatus !== "all") query = query.eq("placement_status", filterStatus);
    const { data } = await query;
    setAlumni(data || []);
  };

  const fetchDepts = async () => {
    const { data } = await supabase.from("departments").select("id, name").order("name");
    setDepartments(data || []);
  };

  useEffect(() => { fetchDepts(); }, []);
  useEffect(() => { fetchAlumni(); }, [search, filterDept, filterYear, filterStatus, page]);

  const uploadAlumniPhoto = async (alumniId: string): Promise<string | null> => {
    if (!photoFile) return null;
    const path = `${alumniId}/${Date.now()}_${photoFile.name}`;
    const { error } = await supabase.storage.from("alumni-photos").upload(path, photoFile);
    if (error) { console.error("Photo upload failed:", error); return null; }
    const { data } = supabase.storage.from("alumni-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const deleteStoragePhoto = async (url: string) => {
    try {
      const bucketBase = "/alumni-photos/";
      const idx = url.indexOf(bucketBase);
      if (idx === -1) return;
      const path = decodeURIComponent(url.substring(idx + bucketBase.length));
      await supabase.storage.from("alumni-photos").remove([path]);
    } catch (e) { console.error("Failed to delete photo from storage:", e); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    // For non-Director users, never show department error — it's auto-assigned
    if (isDirector && !form.department_id) {
      toast({ title: "Department is required", variant: "destructive" });
      return;
    }
    if (!effectiveDeptId) {
      toast({ title: "Error", description: "Your department mapping is missing. Contact administrator.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const finalPayload: any = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      graduation_year: form.graduation_year ? Number(form.graduation_year) : null,
      batch: form.batch.trim() || null,
      degree: form.degree.trim() || null,
      placement_status: form.placement_status || "unknown",
      company: form.company.trim() || null,
      designation: form.designation.trim() || null,
      department_id: effectiveDeptId,
      linkedin_url: form.linkedin_url.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };

    let error;
    if (editingAlumni) {
      // Handle photo removal atomically
      if (removeExistingPhoto && editingAlumni.profile_photo_url) {
        await deleteStoragePhoto(editingAlumni.profile_photo_url);
        finalPayload.profile_photo_url = null;
      }
      // Upload new photo if selected
      if (photoFile) {
        if (editingAlumni.profile_photo_url && !removeExistingPhoto) {
          await deleteStoragePhoto(editingAlumni.profile_photo_url);
        }
        const photoUrl = await uploadAlumniPhoto(editingAlumni.id);
        if (photoUrl) finalPayload.profile_photo_url = photoUrl;
      }
      ({ error } = await supabase.from("alumni").update(finalPayload).eq("id", editingAlumni.id));
    } else {
      ({ error } = await supabase.from("alumni").insert(finalPayload));
      if (!error && photoFile) {
        const { data: inserted } = await supabase.from("alumni").select("id").eq("name", finalPayload.name).eq("department_id", finalPayload.department_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (inserted) {
          const photoUrl = await uploadAlumniPhoto(inserted.id);
          if (photoUrl) await supabase.from("alumni").update({ profile_photo_url: photoUrl }).eq("id", inserted.id);
        }
      }
    }
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingAlumni ? "Alumni updated" : "Alumni added" });
      setDialogOpen(false);
      setEditingAlumni(null);
      resetForm();
      fetchAlumni();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this alumni record?")) return;
    const target = alumni.find(a => a.id === id);
    if (target?.profile_photo_url) await deleteStoragePhoto(target.profile_photo_url);
    const { error } = await supabase.from("alumni").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Alumni deleted" }); fetchAlumni(); }
  };

  const handleEdit = (a: any) => {
    setEditingAlumni(a);
    setForm({
      name: a.name || "", email: a.email || "", phone: a.phone || "",
      graduation_year: a.graduation_year?.toString() || "", batch: a.batch || "",
      degree: a.degree || "", placement_status: a.placement_status || "unknown",
      company: a.company || "", designation: a.designation || "",
      department_id: a.department_id || "", linkedin_url: a.linkedin_url || "",
      address: a.address || "", notes: a.notes || "",
    });
    setPhotoPreview(a.profile_photo_url || null);
    setPhotoFile(null);
    setRemoveExistingPhoto(false);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setForm({ name: "", email: "", phone: "", graduation_year: "", batch: "", degree: "", placement_status: "unknown", company: "", designation: "", department_id: "", linkedin_url: "", address: "", notes: "" });
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemoveExistingPhoto(false);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Only image files allowed", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRemoveExistingPhoto(false);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (editingAlumni?.profile_photo_url) {
      setRemoveExistingPhoto(true);
    }
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        // For non-Director users, always use their department
        const deptId = isDirector ? undefined : userRole?.department_id;
        let success = 0, failed = 0;
        for (const row of results.data as any[]) {
          const payload: any = {
            name: row.name?.trim(),
            email: row.email?.trim() || null,
            phone: row.phone?.trim() || null,
            graduation_year: row.graduation_year ? Number(row.graduation_year) : null,
            batch: row.batch?.trim() || null,
            degree: row.degree?.trim() || null,
            placement_status: row.placement_status?.trim() || "unknown",
            company: row.company?.trim() || null,
            designation: row.designation?.trim() || null,
            department_id: deptId || row.department_id?.trim(),
            profile_photo_url: row.image_url?.trim() || null,
          };
          if (!payload.name || !payload.department_id) { failed++; continue; }
          const { error } = await supabase.from("alumni").insert(payload);
          if (error) failed++; else success++;
        }
        toast({ title: `CSV Import Complete`, description: `${success} added, ${failed} failed.` });
        fetchAlumni();
      },
    });
    e.target.value = "";
  };

  const handleExport = () => {
    const csv = Papa.unparse(alumni.map((a) => ({
      name: a.name, email: a.email, phone: a.phone, graduation_year: a.graduation_year,
      batch: a.batch, degree: a.degree, placement_status: a.placement_status,
      company: a.company, department: a.departments?.name, image_url: a.profile_photo_url || "",
    })));
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "alumni_export.csv"; link.click();
    URL.revokeObjectURL(url);
  };

  const years = [...new Set(alumni.map((a) => a.graduation_year).filter(Boolean))].sort((a, b) => b - a);

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Alumni Directory</h2>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer">
              <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
              <Button variant="outline" size="sm" asChild><span><Upload className="mr-2 h-4 w-4" />Import CSV</span></Button>
            </label>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="mr-2 h-4 w-4" />Export</Button>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingAlumni(null); resetForm(); } }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Alumni</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader><DialogTitle>{editingAlumni ? "Edit Alumni" : "Add Alumni"}</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  {/* Profile Photo */}
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={(!removeExistingPhoto && photoPreview) || undefined} />
                      <AvatarFallback className="bg-muted"><ImageIcon className="h-6 w-6 text-muted-foreground" /></AvatarFallback>
                    </Avatar>
                    <div className="flex gap-2">
                      <label className="cursor-pointer">
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoSelect} />
                        <Button variant="outline" size="sm" asChild><span><Upload className="mr-2 h-4 w-4" />Upload Photo</span></Button>
                      </label>
                      {(photoPreview || editingAlumni?.profile_photo_url) && !removeExistingPhoto && (
                        <Button variant="ghost" size="sm" onClick={handleRemovePhoto} className="text-destructive hover:text-destructive">
                          <X className="mr-1 h-4 w-4" />Remove
                        </Button>
                      )}
                    </div>
                  </div>
                  {removeExistingPhoto && (
                    <p className="text-xs text-muted-foreground">Photo will be removed on save.</p>
                  )}

                  <div className="grid gap-2">
                    <Label>Name *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    <div className="grid gap-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  </div>
                  {/* Department dropdown only for Director */}
                  {isDirector && (
                    <div className="grid gap-2">
                      <Label>Department *</Label>
                      <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                        <SelectContent>{departments.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-2"><Label>Year</Label><Input value={form.graduation_year} onChange={(e) => setForm({ ...form, graduation_year: e.target.value })} /></div>
                    <div className="grid gap-2"><Label>Batch</Label><Input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} /></div>
                    <div className="grid gap-2"><Label>Degree</Label><Input value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>Placement Status</Label>
                      <Select value={form.placement_status} onValueChange={(v) => setForm({ ...form, placement_status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="placed">Placed</SelectItem>
                          <SelectItem value="unplaced">Unplaced</SelectItem>
                          <SelectItem value="higher_studies">Higher Studies</SelectItem>
                          <SelectItem value="entrepreneur">Entrepreneur</SelectItem>
                          <SelectItem value="unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2"><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
                  </div>
                  <div className="grid gap-2"><Label>Designation</Label><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>LinkedIn URL</Label><Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                  <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search alumni..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {isDirector && (
                <Select value={filterDept} onValueChange={setFilterDept}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              )}
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Year" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="placed">Placed</SelectItem>
                  <SelectItem value="unplaced">Unplaced</SelectItem>
                  <SelectItem value="higher_studies">Higher Studies</SelectItem>
                  <SelectItem value="entrepreneur">Entrepreneur</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Degree</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alumni.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No alumni records found</TableCell></TableRow>
              ) : alumni.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={a.profile_photo_url || undefined} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <AvatarFallback className="text-xs bg-muted">{a.name?.charAt(0)?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.departments?.name}</TableCell>
                  <TableCell>{a.graduation_year}</TableCell>
                  <TableCell>{a.degree}</TableCell>
                  <TableCell>
                    <Badge variant={a.placement_status === "placed" ? "default" : "secondary"} className="capitalize">
                      {a.placement_status?.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{a.company}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(a)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between p-4">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page + 1}</span>
            <Button variant="outline" size="sm" disabled={alumni.length < PAGE_SIZE} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}
