import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { User, Lock, Upload, Image } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function SettingsPage() {
  const { profile, user, updatePassword, refreshProfile } = useAuth();
  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
  });
  const [passwordForm, setPasswordForm] = useState({ current: "", newPass: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const handleProfileUpdate = async () => {
    setLoading(true);
    const { error } = await supabase.from("profiles").update({
      full_name: profileForm.full_name,
      phone: profileForm.phone,
    }).eq("user_id", user!.id);
    setLoading(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Profile updated" }); refreshProfile(); }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPass !== passwordForm.confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" }); return;
    }
    if (passwordForm.newPass.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return;
    }
    setLoading(true);
    const { error } = await updatePassword(passwordForm.newPass);
    setLoading(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Password changed successfully" }); setPasswordForm({ current: "", newPass: "", confirm: "" }); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${user!.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file);
    if (uploadError) { toast({ title: "Upload failed", variant: "destructive" }); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", user!.id);
    toast({ title: "Avatar updated" });
    refreshProfile();
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${user!.id}/${Date.now()}_signature_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("signatures").upload(path, file);
    if (uploadError) { toast({ title: "Upload failed", variant: "destructive" }); return; }
    const { data: urlData } = supabase.storage.from("signatures").getPublicUrl(path);
    await supabase.from("profiles").update({ signature_image_url: urlData.publicUrl }).eq("user_id", user!.id);
    toast({ title: "Signature uploaded" });
    refreshProfile();
  };

  const initials = profile?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "U";

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <h2 className="text-2xl font-bold">Settings</h2>

        {/* Profile */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="h-5 w-5" />Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <Button variant="outline" size="sm" asChild><span><Upload className="mr-2 h-4 w-4" />Upload Photo</span></Button>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2"><Label>Full Name</Label><Input value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Phone</Label><Input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>Email</Label><Input value={profile?.email || ""} disabled /></div>
            <Button onClick={handleProfileUpdate} disabled={loading}>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Password */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Lock className="h-5 w-5" />Change Password</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2"><Label>New Password</Label><Input type="password" value={passwordForm.newPass} onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Confirm Password</Label><Input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} /></div>
            <Button onClick={handlePasswordChange} disabled={loading}>Change Password</Button>
          </CardContent>
        </Card>

        {/* Signature */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Image className="h-5 w-5" />Digital Signature</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {profile?.signature_image_url && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <img src={profile.signature_image_url} alt="Signature" className="max-h-20" />
              </div>
            )}
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
              <Button variant="outline" size="sm" asChild><span><Upload className="mr-2 h-4 w-4" />Upload Signature</span></Button>
            </label>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
