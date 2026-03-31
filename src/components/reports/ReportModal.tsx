import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Star, X, Image as ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: any;
  attendees: any[];
  photos: any[];
  onGenerate: (format: "pdf" | "docx", reportData: ReportFormData, uploadedPhotos: string[], logos: ReportLogos) => void;
}

export interface ReportLogos {
  collegeLogo: string | null;
  departmentLogo: string | null;
  coordinatorSignature: string | null;
  approverSignature: string | null;
}

export interface ReportFormData {
  introduction: string;
  event_summary: string;
  key_highlights: string;
  outcomes: string;
  speaker_rating: string;
  speaker_feedback: string;
  overall_rating: number;
  was_useful: string;
  what_went_well: string;
  what_to_improve: string;
  future_suggestions: string;
  conclusion: string;
  students_attended: string;
  external_guests: string;
  coordinator_name: string;
  approved_by: string;
}

export default function ReportModal({ open, onOpenChange, event, attendees, photos, onGenerate }: ReportModalProps) {
  const [form, setForm] = useState<ReportFormData>({
    introduction: "",
    event_summary: "",
    key_highlights: "",
    outcomes: "",
    speaker_rating: "good",
    speaker_feedback: "",
    overall_rating: 4,
    was_useful: "yes",
    what_went_well: "",
    what_to_improve: "",
    future_suggestions: "",
    conclusion: "",
    students_attended: "0",
    external_guests: "0",
    coordinator_name: event?.coordinator_name || "",
    approved_by: "",
  });
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [collegeLogo, setCollegeLogo] = useState<string | null>(null);
  const [departmentLogo, setDepartmentLogo] = useState<string | null>(null);
  const [coordinatorSig, setCoordinatorSig] = useState<string | null>(null);
  const [approverSig, setApproverSig] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${event.id}/report_${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("event-photos").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("event-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    setUploadedPhotos((prev) => [...prev, ...urls]);
    setUploading(false);
    e.target.value = "";
  };

  const handleFileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string | null) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Only image files allowed", variant: "destructive" }); return; }
    const dataUrl = await handleFileToDataUrl(file);
    setter(dataUrl);
    e.target.value = "";
  };

  const removePhoto = (idx: number) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const validate = () => {
    if (!form.event_summary.trim()) { toast({ title: "Event summary is required", variant: "destructive" }); return false; }
    if (!form.key_highlights.trim()) { toast({ title: "Key highlights are required", variant: "destructive" }); return false; }
    if (!form.outcomes.trim()) { toast({ title: "Outcomes are required", variant: "destructive" }); return false; }
    if (!form.coordinator_name.trim()) { toast({ title: "Coordinator name is required", variant: "destructive" }); return false; }
    if (!form.approved_by.trim()) { toast({ title: "Approved by is required", variant: "destructive" }); return false; }
    return true;
  };

  const handleGenerate = async (format: "pdf" | "docx") => {
    if (!validate()) return;
    setGenerating(true);
    const allPhotos = [...photos.map((p) => p.photo_url), ...uploadedPhotos];
    const logos: ReportLogos = {
      collegeLogo,
      departmentLogo,
      coordinatorSignature: coordinatorSig,
      approverSignature: approverSig,
    };
    onGenerate(format, form, allPhotos, logos);
    setGenerating(false);
  };

  const LogoUploadField = ({ label, value, setter }: { label: string; value: string | null; setter: (v: string | null) => void }) => (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        {value ? (
          <div className="relative h-12 w-20 border rounded overflow-hidden bg-muted">
            <img src={value} alt={label} className="h-full w-full object-contain" />
            <button onClick={() => setter(null)} className="absolute top-0 right-0 bg-background/80 rounded-bl p-0.5"><X className="h-3 w-3" /></button>
          </div>
        ) : (
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, setter)} />
            <Button variant="outline" size="sm" asChild><span><ImageIcon className="mr-1 h-3 w-3" />Upload</span></Button>
          </label>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Generate Event Report</DialogTitle></DialogHeader>
        <div className="grid gap-4 text-sm">
          {/* Logos & Signatures */}
          <div className="border-b pb-3">
            <h3 className="font-semibold mb-2">Report Branding & Signatures</h3>
            <div className="grid grid-cols-2 gap-3">
              <LogoUploadField label="College/University Logo" value={collegeLogo} setter={setCollegeLogo} />
              <LogoUploadField label="Department Logo" value={departmentLogo} setter={setDepartmentLogo} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <LogoUploadField label="Coordinator Signature" value={coordinatorSig} setter={setCoordinatorSig} />
              <LogoUploadField label="Approver Signature (HOD/Director)" value={approverSig} setter={setApproverSig} />
            </div>
          </div>

          {/* Section 1: Introduction */}
          <div className="border-b pb-3">
            <h3 className="font-semibold mb-2">1. Introduction</h3>
            <Textarea placeholder="Purpose and background of the event..." value={form.introduction} onChange={(e) => setForm({ ...form, introduction: e.target.value })} rows={2} />
          </div>

          {/* Section 2: Event Summary */}
          <div className="border-b pb-3">
            <h3 className="font-semibold mb-2">2. Event Summary *</h3>
            <Textarea placeholder="What was covered in the session, key topics discussed..." value={form.event_summary} onChange={(e) => setForm({ ...form, event_summary: e.target.value })} rows={3} />
          </div>

          {/* Section 3: Key Highlights */}
          <div className="border-b pb-3">
            <h3 className="font-semibold mb-2">3. Key Highlights *</h3>
            <Textarea placeholder="Major highlights, technologies discussed, interaction summary..." value={form.key_highlights} onChange={(e) => setForm({ ...form, key_highlights: e.target.value })} rows={2} />
          </div>

          {/* Section 4: Speaker Feedback */}
          {event?.speaker_name && (
            <div className="border-b pb-3">
              <h3 className="font-semibold mb-2">4. Speaker Performance</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">Rating</Label>
                  <Select value={form.speaker_rating} onValueChange={(v) => setForm({ ...form, speaker_rating: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="average">Average</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Comments</Label>
                  <Input value={form.speaker_feedback} onChange={(e) => setForm({ ...form, speaker_feedback: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Participation */}
          <div className="border-b pb-3">
            <h3 className="font-semibold mb-2">5. Participation Details</h3>
            <p className="text-xs text-muted-foreground mb-2">Alumni Attended: {attendees.length} (auto from database)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label className="text-xs">Students Attended</Label><Input type="number" value={form.students_attended} onChange={(e) => setForm({ ...form, students_attended: e.target.value })} /></div>
              <div className="grid gap-1"><Label className="text-xs">External Guests</Label><Input type="number" value={form.external_guests} onChange={(e) => setForm({ ...form, external_guests: e.target.value })} /></div>
            </div>
          </div>

          {/* Section 6: Outcomes */}
          <div className="border-b pb-3">
            <h3 className="font-semibold mb-2">6. Outcomes & Impact *</h3>
            <Textarea placeholder="Skills gained, knowledge improvement, networking benefits..." value={form.outcomes} onChange={(e) => setForm({ ...form, outcomes: e.target.value })} rows={2} />
          </div>

          {/* Section 7: Feedback */}
          <div className="border-b pb-3">
            <h3 className="font-semibold mb-2">7. Feedback</h3>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">Overall Rating (1-5)</Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setForm({ ...form, overall_rating: n })} className="p-1">
                        <Star className={`h-5 w-5 ${n <= form.overall_rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Was the event useful?</Label>
                  <Select value={form.was_useful} onValueChange={(v) => setForm({ ...form, was_useful: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1"><Label className="text-xs">What went well?</Label><Input value={form.what_went_well} onChange={(e) => setForm({ ...form, what_went_well: e.target.value })} /></div>
              <div className="grid gap-1"><Label className="text-xs">What can be improved?</Label><Input value={form.what_to_improve} onChange={(e) => setForm({ ...form, what_to_improve: e.target.value })} /></div>
              <div className="grid gap-1"><Label className="text-xs">Suggestions for future</Label><Input value={form.future_suggestions} onChange={(e) => setForm({ ...form, future_suggestions: e.target.value })} /></div>
            </div>
          </div>

          {/* Section 8: Event Photos */}
          <div className="border-b pb-3">
            <h3 className="font-semibold mb-2">8. Event Photos</h3>
            {photos.length > 0 && <p className="text-xs text-muted-foreground mb-2">{photos.length} existing photo(s) will be included</p>}
            <div className="grid grid-cols-4 gap-2 mb-2">
              {uploadedPhotos.map((url, i) => (
                <div key={i} className="relative aspect-square rounded border overflow-hidden">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              <Button variant="outline" size="sm" asChild disabled={uploading}><span><Upload className="mr-2 h-4 w-4" />{uploading ? "Uploading..." : "Upload Photos"}</span></Button>
            </label>
          </div>

          {/* Section 9: Conclusion */}
          <div className="border-b pb-3">
            <h3 className="font-semibold mb-2">9. Conclusion</h3>
            <Textarea placeholder="Summary of event success, future recommendations..." value={form.conclusion} onChange={(e) => setForm({ ...form, conclusion: e.target.value })} rows={2} />
          </div>

          {/* Coordinator & Approval */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Coordinator Name *</Label><Input value={form.coordinator_name} onChange={(e) => setForm({ ...form, coordinator_name: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Approved By (HOD/Director) *</Label><Input value={form.approved_by} onChange={(e) => setForm({ ...form, approved_by: e.target.value })} /></div>
          </div>

          {/* Generate Buttons */}
          <div className="flex gap-2 pt-2">
            <Button onClick={() => handleGenerate("pdf")} disabled={generating} className="flex-1">Generate PDF</Button>
            <Button onClick={() => handleGenerate("docx")} disabled={generating} variant="outline" className="flex-1">Generate DOCX</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
