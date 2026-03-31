import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, UserCog } from "lucide-react";

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "hod" as string, department_id: "" });
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    // Fetch roles and profiles separately since there's no FK relationship
    const { data: roles } = await supabase.from("user_roles").select("*");
    if (!roles || roles.length === 0) { setUsers([]); return; }

    const userIds = roles.map(r => r.user_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);

    const merged = roles.map(r => ({
      ...r,
      profile: profiles?.find(p => p.user_id === r.user_id) || null,
    }));
    setUsers(merged);
  };

  const fetchDepts = async () => {
    const { data } = await supabase.from("departments").select("id, name").order("name");
    setDepartments(data || []);
  };

  useEffect(() => { fetchUsers(); fetchDepts(); }, []);

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.full_name) {
      toast({ title: "All fields required", variant: "destructive" }); return;
    }
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await supabase.functions.invoke("create-user", {
      body: {
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        role: form.role,
        department_id: form.department_id || null,
      },
    });

    setLoading(false);
    if (response.error || response.data?.error) {
      toast({ title: "Error creating user", description: response.data?.error || response.error?.message, variant: "destructive" });
    } else {
      toast({ title: "User created successfully" });
      setDialogOpen(false);
      setForm({ email: "", password: "", full_name: "", role: "hod", department_id: "" });
      fetchUsers();
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm("Remove this user's role?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Role removed" }); fetchUsers(); }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case "director": return "destructive" as const;
      case "hod": return "default" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">User Management</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Create User</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>Add a new user with a specific role and department.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2"><Label>Full Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="director">Director</SelectItem>
                      <SelectItem value="hod">HOD</SelectItem>
                      <SelectItem value="department_admin">Department Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.role !== "director" && (
                  <div className="grid gap-2">
                    <Label>Department</Label>
                    <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                      <SelectContent>{departments.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={handleCreate} disabled={loading}>{loading ? "Creating..." : "Create User"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
              ) : users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium"><div className="flex items-center gap-2"><UserCog className="h-4 w-4 text-muted-foreground" />{u.profile?.full_name || "—"}</div></TableCell>
                  <TableCell>{u.profile?.email || "—"}</TableCell>
                  <TableCell><Badge variant={roleColor(u.role)} className="capitalize">{u.role.replace("_", " ")}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteRole(u.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
