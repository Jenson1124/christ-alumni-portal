import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Calendar, MapPin, Clock, Plus, Trash2, Upload, FileText, Users, Mic, Edit } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType, AlignmentType, PageNumber, Footer, Header, BorderStyle, ShadingType, ImageRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ReportModal, { type ReportFormData, type ReportLogos } from "@/components/reports/ReportModal";
import { motion } from "framer-motion";

const EVENT_TYPES = ["Seminar", "Webinar", "Workshop", "Meetup", "Hackathon", "Conference", "Guest Lecture", "Cultural", "Sports", "Other"];
const EVENT_MODES = ["Offline", "Online", "Hybrid"];

const formatDate = (dateStr: string) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

const formatTime = (timeStr: string) => {
  if (!timeStr) return "N/A";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "N/A";

// Sanitize text to remove any debug/prompt/markdown artifacts
const sanitize = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .replace(/Here is.*?prompt[^.]*\.?/gi, "")
    .replace(/production[- ]?ready/gi, "")
    .replace(/[#*_`>]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const loadImageAsBase64 = (url: string): Promise<{ data: string; width: number; height: number } | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      try {
        resolve({ data: canvas.toDataURL("image/jpeg", 0.8), width: img.naturalWidth, height: img.naturalHeight });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

const dataUrlToArrayBuffer = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export default function EventDetail() {
  const { id } = useParams();
  const { user, userRole } = useAuth();
  const [event, setEvent] = useState<any>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [alumni, setAlumni] = useState<any[]>([]);
  const [selectedAlumni, setSelectedAlumni] = useState("");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editLoading, setEditLoading] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);

  const isDirector = userRole?.role === "director";
  const isHod = userRole?.role === "hod";
  const canGenerateReport = isDirector || isHod;
  const canEdit = isDirector || (event?.department_id === userRole?.department_id);

  const fetchEvent = async () => {
    const { data } = await supabase.from("events").select("*, departments(name, logo_url)").eq("id", id!).maybeSingle();
    setEvent(data);
  };
  const fetchAttendees = async () => {
    const { data } = await supabase.from("event_attendees").select("*, alumni(name, email, graduation_year, degree, company)").eq("event_id", id!);
    setAttendees(data || []);
  };
  const fetchPhotos = async () => {
    const { data } = await supabase.from("event_photos").select("*").eq("event_id", id!);
    setPhotos(data || []);
  };
  const fetchAlumni = async () => {
    const { data } = await supabase.from("alumni").select("id, name").order("name");
    setAlumni(data || []);
  };
  const fetchDepts = async () => {
    const { data } = await supabase.from("departments").select("id, name").order("name");
    setDepartments(data || []);
  };

  useEffect(() => { fetchEvent(); fetchAttendees(); fetchPhotos(); fetchAlumni(); fetchDepts(); }, [id]);

  const addAttendee = async () => {
    if (!selectedAlumni) return;
    const { error } = await supabase.from("event_attendees").insert({ event_id: id!, alumni_id: selectedAlumni });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Attendee added" }); setSelectedAlumni(""); fetchAttendees(); }
  };

  const removeAttendee = async (attendeeId: string) => {
    const { error } = await supabase.from("event_attendees").delete().eq("id", attendeeId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Removed" }); fetchAttendees(); }
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const path = `${id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("event-photos").upload(path, file);
      if (uploadError) { toast({ title: "Upload failed", variant: "destructive" }); continue; }
      const { data: urlData } = supabase.storage.from("event-photos").getPublicUrl(path);
      await supabase.from("event_photos").insert({ event_id: id!, photo_url: urlData.publicUrl, uploaded_by: user?.id });
    }
    toast({ title: "Photos uploaded" });
    fetchPhotos();
    e.target.value = "";
  };

  // ---- Edit Event ----
  const openEditDialog = () => {
    setEditForm({
      title: event.title || "",
      description: event.description || "",
      event_date: event.event_date || "",
      event_time: event.event_time || "",
      venue: event.venue || "",
      department_id: event.department_id || "",
      event_type: event.event_type || "seminar",
      mode: event.mode || "offline",
      coordinator_name: event.coordinator_name || "",
      expected_participants: event.expected_participants?.toString() || "",
      speaker_name: event.speaker_name || "",
      speaker_designation: event.speaker_designation || "",
      speaker_organization: event.speaker_organization || "",
      speaker_bio: event.speaker_bio || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editForm.title?.trim() || !editForm.event_date || !editForm.venue?.trim()) {
      toast({ title: "Title, Date & Venue are required", variant: "destructive" });
      return;
    }
    setEditLoading(true);
    const effectiveDeptId = isDirector ? editForm.department_id : userRole?.department_id;
    const payload: any = {
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      event_date: editForm.event_date,
      event_time: editForm.event_time,
      venue: editForm.venue.trim(),
      department_id: effectiveDeptId,
      event_type: editForm.event_type,
      mode: editForm.mode,
      coordinator_name: editForm.coordinator_name.trim(),
      expected_participants: editForm.expected_participants ? Number(editForm.expected_participants) : null,
      speaker_name: editForm.speaker_name.trim() || null,
      speaker_designation: editForm.speaker_designation.trim() || null,
      speaker_organization: editForm.speaker_organization.trim() || null,
      speaker_bio: editForm.speaker_bio.trim() || null,
    };
    const { error } = await supabase.from("events").update(payload).eq("id", id!);
    setEditLoading(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Event updated" });
      setEditDialogOpen(false);
      fetchEvent();
    }
  };

  const handleGenerateReport = async (format: "pdf" | "docx", reportData: ReportFormData, reportPhotos: string[], logos: ReportLogos) => {
    await supabase.from("event_report_data").insert({
      event_id: id!,
      introduction: reportData.introduction,
      event_summary: reportData.event_summary,
      key_highlights: reportData.key_highlights,
      outcomes: reportData.outcomes,
      speaker_rating: reportData.speaker_rating,
      speaker_feedback: reportData.speaker_feedback,
      overall_rating: reportData.overall_rating,
      was_useful: reportData.was_useful === "yes",
      what_went_well: reportData.what_went_well,
      what_to_improve: reportData.what_to_improve,
      future_suggestions: reportData.future_suggestions,
      conclusion: reportData.conclusion,
      students_attended: Number(reportData.students_attended) || 0,
      external_guests: Number(reportData.external_guests) || 0,
      coordinator_name: reportData.coordinator_name,
      approved_by: reportData.approved_by,
      generated_by: user?.id,
    } as any);

    if (format === "pdf") await generatePDF(reportData, reportPhotos, logos);
    else await generateDOCX(reportData, reportPhotos, logos);

    setReportModalOpen(false);
    toast({ title: `${format.toUpperCase()} report generated and downloaded` });
  };

  // ==================== PDF GENERATION ====================
  const generatePDF = async (rd: ReportFormData, reportPhotos: string[], logos: ReportLogos) => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.width;
    const ph = doc.internal.pageSize.height;
    const margin = 20;
    const contentWidth = pw - margin * 2;
    let y = 0;

    // Load logo images
    const collegeLogoImg = logos.collegeLogo ? await loadImageAsBase64(logos.collegeLogo) : null;
    const deptLogoImg = logos.departmentLogo ? await loadImageAsBase64(logos.departmentLogo) : null;
    const coordSigImg = logos.coordinatorSignature ? await loadImageAsBase64(logos.coordinatorSignature) : null;
    const approverSigImg = logos.approverSignature ? await loadImageAsBase64(logos.approverSignature) : null;

    // ========== FIRST PAGE HEADER BANNER ==========
    const bannerHeight = 72;
    doc.setFillColor(26, 54, 93);
    doc.rect(0, 0, pw, bannerHeight, "F");

    // College logo (left)
    if (collegeLogoImg) {
      const logoH = 22;
      const logoW = (collegeLogoImg.width / collegeLogoImg.height) * logoH;
      doc.addImage(collegeLogoImg.data, "JPEG", margin, 8, Math.min(logoW, 28), logoH);
    } else {
      doc.setFillColor(200, 210, 230);
      doc.roundedRect(margin, 8, 22, 22, 2, 2, "F");
      doc.setFontSize(5); doc.setTextColor(26, 54, 93);
      doc.text("LOGO", margin + 11, 21, { align: "center" });
    }

    // Department logo (right)
    if (deptLogoImg) {
      const logoH = 22;
      const logoW = (deptLogoImg.width / deptLogoImg.height) * logoH;
      doc.addImage(deptLogoImg.data, "JPEG", pw - margin - Math.min(logoW, 28), 8, Math.min(logoW, 28), logoH);
    } else {
      doc.setFillColor(200, 210, 230);
      doc.roundedRect(pw - margin - 22, 8, 22, 22, 2, 2, "F");
      doc.setFontSize(5); doc.setTextColor(26, 54, 93);
      doc.text("DEPT", pw - margin - 11, 21, { align: "center" });
    }

    // Center text on banner
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15); doc.setFont("helvetica", "bold");
    doc.text("INSTITUTION NAME", pw / 2, 18, { align: "center" });
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Department of ${sanitize(event.departments?.name) || "N/A"}`, pw / 2, 27, { align: "center" });
    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("ALUMNI EVENT REPORT", pw / 2, 39, { align: "center" });

    // Event info on banner
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(sanitize(event.title), pw / 2, 49, { align: "center" });
    doc.setFontSize(9);
    doc.text(`${formatDate(event.event_date)}  |  ${formatTime(event.event_time)}`, pw / 2, 56, { align: "center" });
    doc.text(`Venue: ${sanitize(event.venue) || "N/A"}  |  Mode: ${capitalize(event.mode)}  |  Type: ${capitalize(event.event_type)}`, pw / 2, 63, { align: "center" });

    // Accent line
    doc.setFillColor(59, 130, 246);
    doc.rect(0, bannerHeight, pw, 2, "F");

    y = bannerHeight + 14;

    // Coordinator
    doc.setFontSize(9); doc.setTextColor(80); doc.setFont("helvetica", "normal");
    doc.text(`Organized by: ${sanitize(rd.coordinator_name)}  |  Department: ${sanitize(event.departments?.name) || "N/A"}`, pw / 2, y, { align: "center" });
    y += 14;

    // ========== HELPERS ==========
    const checkPage = (needed: number) => { if (y + needed > ph - 30) { doc.addPage(); y = 22; } };

    const addSectionTitle = (num: string, title: string) => {
      checkPage(18);
      doc.setDrawColor(200, 210, 230); doc.setLineWidth(0.3);
      doc.line(margin, y, pw - margin, y);
      y += 7;
      doc.setFontSize(12); doc.setTextColor(26, 54, 93); doc.setFont("helvetica", "bold");
      doc.text(`${num}. ${title}`, margin, y);
      y += 8;
    };

    const addParagraph = (text: string) => {
      const clean = sanitize(text) || "N/A";
      doc.setFontSize(10); doc.setTextColor(50, 50, 50); doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(clean, contentWidth);
      checkPage(lines.length * 5 + 4);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 6;
    };

    const addField = (label: string, value: string) => {
      checkPage(10);
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(80);
      const labelText = `${label}: `;
      doc.text(labelText, margin, y);
      const labelW = doc.getTextWidth(labelText);
      doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50);
      doc.text(sanitize(value) || "N/A", margin + labelW, y);
      y += 6;
    };

    // ========== SECTIONS ==========
    if (rd.introduction) { addSectionTitle("1", "Introduction"); addParagraph(rd.introduction); }

    addSectionTitle("2", "Event Overview");
    addField("Theme / Topic", event.title);
    addField("Type", capitalize(event.event_type));
    addField("Mode", capitalize(event.mode));
    y += 2;

    if (event.speaker_name) {
      addSectionTitle("3", "Speaker Details");
      addField("Name", event.speaker_name);
      if (event.speaker_designation) addField("Designation", event.speaker_designation);
      if (event.speaker_organization) addField("Organization", event.speaker_organization);
      if (event.speaker_bio) {
        doc.setFontSize(9); doc.setFont("helvetica", "italic"); doc.setTextColor(80);
        const bioLines = doc.splitTextToSize(sanitize(event.speaker_bio), contentWidth);
        checkPage(bioLines.length * 4.5 + 4);
        doc.text(bioLines, margin, y);
        y += bioLines.length * 4.5 + 4;
      }
      addField("Speaker Rating", capitalize(rd.speaker_rating));
      if (rd.speaker_feedback) addField("Feedback", rd.speaker_feedback);
      y += 2;
    }

    addSectionTitle("4", "Event Description");
    addParagraph(rd.event_summary);
    if (rd.key_highlights) {
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(26, 54, 93);
      checkPage(8); doc.text("Key Highlights:", margin, y); y += 6;
      doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50); doc.setFontSize(9);
      for (const h of rd.key_highlights.split("\n").filter(Boolean)) {
        checkPage(6);
        const cleanH = sanitize(h).replace(/^[-]\s*/, "");
        doc.text(`  \u2022  ${cleanH}`, margin, y);
        y += 5.5;
      }
      y += 4;
    }

    // Participation
    addSectionTitle("5", "Participation Details");
    const totalParticipants = attendees.length + Number(rd.students_attended) + Number(rd.external_guests);
    autoTable(doc, {
      startY: y,
      head: [["Category", "Count"]],
      body: [
        ["Alumni Attended", String(attendees.length)],
        ["Students Attended", rd.students_attended],
        ["External Guests", rd.external_guests],
        ["Total Participants", String(totalParticipants)],
      ],
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 252] },
      columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "center" } },
      margin: { left: margin, right: margin },
      tableWidth: contentWidth * 0.55,
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    if (attendees.length > 0) {
      checkPage(20);
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(26, 54, 93);
      doc.text("Alumni Attendance List", margin, y); y += 6;
      autoTable(doc, {
        startY: y,
        head: [["#", "Name", "Email", "Year", "Degree", "Company"]],
        body: attendees.map((a, i) => [
          String(i + 1), a.alumni?.name || "", a.alumni?.email || "",
          a.alumni?.graduation_year?.toString() || "", a.alumni?.degree || "", a.alumni?.company || "",
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 247, 252] },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    addSectionTitle("6", "Outcomes & Impact");
    addParagraph(rd.outcomes);

    addSectionTitle("7", "Feedback & Evaluation");
    // Safe star rendering with fallback
    const ratingNum = Math.max(1, Math.min(5, rd.overall_rating));
    let ratingDisplay: string;
    try {
      ratingDisplay = `${"★".repeat(ratingNum)}${"☆".repeat(5 - ratingNum)} (${ratingNum}/5)`;
    } catch {
      ratingDisplay = `${ratingNum}/5`;
    }
    autoTable(doc, {
      startY: y,
      head: [["Parameter", "Response"]],
      body: [
        ["Overall Rating", ratingDisplay],
        ["Was the event useful?", rd.was_useful === "yes" ? "Yes" : "No"],
        ["What went well?", sanitize(rd.what_went_well) || "\u2014"],
        ["What can be improved?", sanitize(rd.what_to_improve) || "\u2014"],
        ["Suggestions for future", sanitize(rd.future_suggestions) || "\u2014"],
      ],
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 252] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Photos
    if (reportPhotos.length > 0) {
      addSectionTitle("8", "Event Photos");
      const imgSize = (contentWidth - 10) / 3;
      let col = 0;
      for (const photoUrl of reportPhotos) {
        const imgData = await loadImageAsBase64(photoUrl);
        if (!imgData) continue;
        checkPage(imgSize + 10);
        const x = margin + col * (imgSize + 5);
        const aspect = imgData.width / imgData.height;
        const drawW = imgSize;
        const drawH = imgSize / aspect;
        doc.addImage(imgData.data, "JPEG", x, y, drawW, Math.min(drawH, imgSize));
        col++;
        if (col >= 3) { col = 0; y += imgSize + 5; }
      }
      if (col > 0) y += imgSize + 5;
      y += 4;
    }

    if (rd.conclusion) { addSectionTitle("9", "Conclusion"); addParagraph(rd.conclusion); }

    // ========== APPROVAL / SIGNATURE SECTION ==========
    checkPage(80);
    y += 8;
    doc.setDrawColor(200, 210, 230); doc.setLineWidth(0.3);
    doc.line(margin, y, pw - margin, y);
    y += 12;

    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(26, 54, 93);
    doc.text("APPROVAL & AUTHORIZATION", pw / 2, y, { align: "center" });
    y += 12;

    const colW = (contentWidth - 20) / 2;

    if (coordSigImg) {
      const sigH = 18;
      const sigW = (coordSigImg.width / coordSigImg.height) * sigH;
      doc.addImage(coordSigImg.data, "JPEG", margin, y, Math.min(sigW, colW), sigH);
    }
    if (approverSigImg) {
      const sigH = 18;
      const sigW = (approverSigImg.width / approverSigImg.height) * sigH;
      doc.addImage(approverSigImg.data, "JPEG", margin + colW + 20, y, Math.min(sigW, colW), sigH);
    }
    y += 22;

    doc.setDrawColor(100); doc.setLineWidth(0.5);
    doc.line(margin, y, margin + colW, y);
    doc.line(margin + colW + 20, y, pw - margin, y);
    y += 5;
    doc.setFontSize(9); doc.setTextColor(30); doc.setFont("helvetica", "bold");
    doc.text(sanitize(rd.coordinator_name), margin, y);
    doc.text(sanitize(rd.approved_by), margin + colW + 20, y);
    y += 4;
    doc.setFont("helvetica", "normal"); doc.setTextColor(100);
    doc.text("Event Coordinator", margin, y);
    doc.text("HOD / Director", margin + colW + 20, y);

    // ========== FOOTER on every page ==========
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(26, 54, 93); doc.setLineWidth(0.5);
      doc.line(margin, ph - 16, pw - margin, ph - 16);
      doc.setFontSize(7); doc.setTextColor(100); doc.setFont("helvetica", "normal");
      doc.text("Institution Name  |  Alumni Management Portal", margin, ph - 11);
      doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, pw / 2, ph - 11, { align: "center" });
      doc.text(`Page ${i} of ${pages}`, pw - margin, ph - 11, { align: "right" });
      if (i > 1) {
        doc.setFillColor(26, 54, 93);
        doc.rect(0, 0, pw, 12, "F");
        doc.setTextColor(255); doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.text(`Alumni Event Report — ${sanitize(event.title)}`, pw / 2, 8, { align: "center" });
      }
    }

    doc.save(`${event.title.replace(/[^a-zA-Z0-9]/g, "_")}_report.pdf`);
  };

  // ==================== DOCX GENERATION ====================
  const generateDOCX = async (rd: ReportFormData, reportPhotos: string[], logos: ReportLogos) => {
    const headerRow = new DocxTableRow({
      children: ["#", "Name", "Email", "Year", "Degree", "Company"].map((t) =>
        new DocxTableCell({
          children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 18, color: "FFFFFF" })] })],
          width: { size: 16, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.SOLID, color: "1A365D" },
        })
      ),
    });
    const dataRows = attendees.map((a, i) =>
      new DocxTableRow({
        children: [String(i + 1), a.alumni?.name, a.alumni?.email, a.alumni?.graduation_year?.toString(), a.alumni?.degree, a.alumni?.company].map((t, ci) =>
          new DocxTableCell({
            children: [new Paragraph({ children: [new TextRun({ text: t || "\u2014", size: 18 })] })],
            width: { size: 16, type: WidthType.PERCENTAGE },
            shading: i % 2 === 1 ? { type: ShadingType.SOLID, color: "F5F7FC" } : undefined,
          })
        ),
      })
    );

    const makeParagraph = (text: string, opts?: { bold?: boolean; size?: number; alignment?: typeof AlignmentType[keyof typeof AlignmentType]; spacing?: any; color?: string }) =>
      new Paragraph({
        children: [new TextRun({ text: sanitize(text), bold: opts?.bold, size: opts?.size || 22, color: opts?.color })],
        alignment: opts?.alignment,
        spacing: opts?.spacing,
      });

    const sectionTitle = (num: string, title: string) =>
      new Paragraph({
        children: [new TextRun({ text: `${num}. ${title}`, bold: true, size: 26, color: "1A365D" })],
        spacing: { before: 400, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "C8D2E6" } },
      });

    const totalParticipants = attendees.length + Number(rd.students_attended) + Number(rd.external_guests);

    const headerChildren: any[] = [];
    if (logos.collegeLogo) {
      try {
        headerChildren.push(new Paragraph({
          children: [new ImageRun({ data: dataUrlToArrayBuffer(logos.collegeLogo), transformation: { width: 60, height: 60 }, type: "png" })],
          alignment: AlignmentType.CENTER,
        }));
      } catch { /* skip */ }
    }

    const ratingNum = Math.max(1, Math.min(5, rd.overall_rating));
    const starsDocx = `${"★".repeat(ratingNum)}${"☆".repeat(5 - ratingNum)} (${ratingNum}/5)`;

    const children: any[] = [
      makeParagraph("INSTITUTION NAME", { bold: true, size: 28, alignment: AlignmentType.CENTER, color: "1A365D" }),
      makeParagraph(`Department of ${event.departments?.name || "N/A"}`, { size: 22, alignment: AlignmentType.CENTER, color: "4A5568" }),
      new Paragraph({ spacing: { before: 100 } }),
      makeParagraph("ALUMNI EVENT REPORT", { bold: true, size: 36, alignment: AlignmentType.CENTER, color: "1A365D", spacing: { before: 200, after: 100 } }),
      makeParagraph(event.title, { bold: true, size: 28, alignment: AlignmentType.CENTER }),
      makeParagraph(`${formatDate(event.event_date)}  |  ${formatTime(event.event_time)}`, { size: 20, alignment: AlignmentType.CENTER, color: "4A5568" }),
      makeParagraph(`Venue: ${event.venue || "N/A"}  |  Mode: ${capitalize(event.mode)}  |  Type: ${capitalize(event.event_type)}`, { size: 20, alignment: AlignmentType.CENTER, color: "4A5568" }),
      makeParagraph(`Coordinator: ${sanitize(rd.coordinator_name)}`, { size: 20, alignment: AlignmentType.CENTER, color: "4A5568", spacing: { after: 300 } }),
    ];

    if (rd.introduction) { children.push(sectionTitle("1", "Introduction"), makeParagraph(rd.introduction)); }

    children.push(sectionTitle("2", "Event Overview"));
    children.push(makeParagraph(`Theme: ${event.title}  |  Type: ${capitalize(event.event_type)}  |  Mode: ${capitalize(event.mode)}`));

    if (event.speaker_name) {
      children.push(sectionTitle("3", "Speaker Details"));
      children.push(makeParagraph(`Name: ${event.speaker_name}`));
      if (event.speaker_designation) children.push(makeParagraph(`Designation: ${event.speaker_designation}`));
      if (event.speaker_organization) children.push(makeParagraph(`Organization: ${event.speaker_organization}`));
      if (event.speaker_bio) children.push(makeParagraph(`Bio: ${event.speaker_bio}`, { size: 20, color: "4A5568" }));
      children.push(makeParagraph(`Performance: ${capitalize(rd.speaker_rating)} — ${sanitize(rd.speaker_feedback) || "No comments"}`));
    }

    children.push(sectionTitle("4", "Event Description"));
    children.push(makeParagraph(rd.event_summary));
    if (rd.key_highlights) children.push(makeParagraph(`Key Highlights: ${rd.key_highlights}`));

    children.push(sectionTitle("5", "Participation Details"));
    children.push(makeParagraph(`Alumni: ${attendees.length}  |  Students: ${rd.students_attended}  |  External: ${rd.external_guests}  |  Total: ${totalParticipants}`, { bold: true }));

    if (attendees.length > 0) {
      children.push(new DocxTable({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }));
    }

    children.push(sectionTitle("6", "Outcomes & Impact"), makeParagraph(rd.outcomes));

    children.push(sectionTitle("7", "Feedback & Evaluation"));
    children.push(makeParagraph(`Overall Rating: ${starsDocx}`));
    children.push(makeParagraph(`Event Useful: ${rd.was_useful === "yes" ? "Yes" : "No"}`));
    if (rd.what_went_well) children.push(makeParagraph(`What went well: ${rd.what_went_well}`));
    if (rd.what_to_improve) children.push(makeParagraph(`Improvements: ${rd.what_to_improve}`));
    if (rd.future_suggestions) children.push(makeParagraph(`Suggestions: ${rd.future_suggestions}`));

    if (reportPhotos.length > 0) {
      children.push(sectionTitle("8", "Event Photos"));
      for (const photoUrl of reportPhotos) {
        const imgData = await loadImageAsBase64(photoUrl);
        if (!imgData) continue;
        try {
          const maxW = 400;
          const aspect = imgData.width / imgData.height;
          const w = Math.min(maxW, imgData.width);
          const h = w / aspect;
          children.push(new Paragraph({
            children: [new ImageRun({ data: dataUrlToArrayBuffer(imgData.data), transformation: { width: w, height: h }, type: "jpg" })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 100 },
          }));
        } catch { /* skip broken images */ }
      }
    }

    if (rd.conclusion) { children.push(sectionTitle("9", "Conclusion"), makeParagraph(rd.conclusion)); }

    children.push(new Paragraph({ spacing: { before: 600 } }));
    children.push(new Paragraph({
      children: [new TextRun({ text: "APPROVAL & AUTHORIZATION", bold: true, size: 24, color: "1A365D" })],
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 1, color: "C8D2E6" } },
      spacing: { before: 400, after: 200 },
    }));

    if (logos.coordinatorSignature) {
      try {
        children.push(new Paragraph({
          children: [new ImageRun({ data: dataUrlToArrayBuffer(logos.coordinatorSignature), transformation: { width: 120, height: 50 }, type: "png" })],
          spacing: { before: 100 },
        }));
      } catch { /* skip */ }
    }
    children.push(makeParagraph(`Prepared by: ${rd.coordinator_name}`, { bold: true }));
    children.push(makeParagraph("Event Coordinator", { size: 18, color: "718096" }));
    children.push(new Paragraph({ spacing: { before: 200 } }));

    if (logos.approverSignature) {
      try {
        children.push(new Paragraph({
          children: [new ImageRun({ data: dataUrlToArrayBuffer(logos.approverSignature), transformation: { width: 120, height: 50 }, type: "png" })],
          spacing: { before: 100 },
        }));
      } catch { /* skip */ }
    }
    children.push(makeParagraph(`Approved by: ${rd.approved_by}`, { bold: true }));
    children.push(makeParagraph("HOD / Director", { size: 18, color: "718096" }));
    children.push(makeParagraph(`Report generated: ${new Date().toLocaleString("en-GB")}`, { size: 18, color: "718096", spacing: { before: 300 } }));

    const docx = new Document({
      sections: [{
        properties: {
          page: { pageNumbers: { start: 1 }, margin: { top: 720, bottom: 720, left: 1080, right: 1080 } },
        },
        headers: {
          default: new Header({
            children: [makeParagraph(`Alumni Event Report — ${sanitize(event.title)}`, { size: 16, alignment: AlignmentType.RIGHT, color: "718096" })],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Institution Name  |  Alumni Management Portal  |  Page ", size: 14, color: "718096" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 14, color: "718096" }),
                  new TextRun({ text: " of ", size: 14, color: "718096" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: "718096" }),
                ],
              }),
            ],
          }),
        },
        children,
      }],
    });

    const blob = await Packer.toBlob(docx);
    saveAs(blob, `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}_report.docx`);
  };

  if (!event) return (
    <DashboardLayout>
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{event.title}</h2>
              {event.event_type && <Badge variant="outline" className="capitalize">{event.event_type}</Badge>}
              {event.mode && <Badge variant="secondary" className="capitalize">{event.mode}</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              {event.event_date && <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{formatDate(event.event_date)}</span>}
              {event.event_time && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{formatTime(event.event_time)}</span>}
              {event.venue && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{event.venue}</span>}
              {event.expected_participants && <span className="flex items-center gap-1"><Users className="h-4 w-4" />Expected: {event.expected_participants}</span>}
            </div>
            {event.description && <p className="mt-3 text-sm text-muted-foreground max-w-2xl">{event.description}</p>}
            {event.coordinator_name && <p className="mt-1 text-sm"><strong>Coordinator:</strong> {event.coordinator_name}</p>}
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <Button size="sm" variant="outline" onClick={openEditDialog}><Edit className="mr-2 h-4 w-4" />Edit</Button>
            )}
            {canGenerateReport && (
              <Button size="sm" onClick={() => setReportModalOpen(true)}><FileText className="mr-2 h-4 w-4" />Generate Report</Button>
            )}
          </div>
        </div>

        {/* Speaker Card */}
        {event.speaker_name && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mic className="h-4 w-4" />Speaker</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>{event.speaker_name}</strong></p>
                {event.speaker_designation && <p>{event.speaker_designation}{event.speaker_organization ? `, ${event.speaker_organization}` : ""}</p>}
                {event.speaker_bio && <p className="text-muted-foreground">{event.speaker_bio}</p>}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Photos */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Event Photos ({photos.length})</CardTitle>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" multiple className="hidden" onChange={uploadPhoto} />
                <Button variant="outline" size="sm" asChild><span><Upload className="mr-2 h-4 w-4" />Upload</span></Button>
              </label>
            </CardHeader>
            <CardContent>
              {photos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No photos yet</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {photos.map((p) => (
                    <div key={p.id} className="aspect-square overflow-hidden rounded-lg border transition-transform hover:scale-[1.02]">
                      <img src={p.photo_url} alt="Event" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Attendees */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Attendees ({attendees.length})</CardTitle>
              <div className="flex gap-2">
                <Select value={selectedAlumni} onValueChange={setSelectedAlumni}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select alumni" /></SelectTrigger>
                  <SelectContent>{alumni.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}</SelectContent>
                </Select>
                <Button size="sm" onClick={addAttendee} disabled={!selectedAlumni}><Plus className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Degree</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendees.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No attendees</TableCell></TableRow>
                ) : attendees.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.alumni?.name}</TableCell>
                    <TableCell>{a.alumni?.email}</TableCell>
                    <TableCell>{a.alumni?.graduation_year}</TableCell>
                    <TableCell>{a.alumni?.degree}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => removeAttendee(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </motion.div>

        {/* Report Modal */}
        <ReportModal
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
          event={event}
          attendees={attendees}
          photos={photos}
          onGenerate={handleGenerateReport}
        />

        {/* Edit Event Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader><DialogTitle>Edit Event</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-1">
                <Label>Title *</Label>
                <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
              <div className="grid gap-1">
                <Label>Description</Label>
                <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1"><Label>Date *</Label><Input type="date" value={editForm.event_date} onChange={(e) => setEditForm({ ...editForm, event_date: e.target.value })} /></div>
                <div className="grid gap-1"><Label>Time</Label><Input type="time" value={editForm.event_time} onChange={(e) => setEditForm({ ...editForm, event_time: e.target.value })} /></div>
              </div>
              <div className="grid gap-1"><Label>Venue *</Label><Input value={editForm.venue} onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label>Event Type</Label>
                  <Select value={editForm.event_type} onValueChange={(v) => setEditForm({ ...editForm, event_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t.toLowerCase()}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label>Mode</Label>
                  <Select value={editForm.mode} onValueChange={(v) => setEditForm({ ...editForm, mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EVENT_MODES.map((m) => <SelectItem key={m} value={m.toLowerCase()}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {isDirector && (
                <div className="grid gap-1">
                  <Label>Department</Label>
                  <Select value={editForm.department_id} onValueChange={(v) => setEditForm({ ...editForm, department_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1"><Label>Coordinator Name</Label><Input value={editForm.coordinator_name} onChange={(e) => setEditForm({ ...editForm, coordinator_name: e.target.value })} /></div>
                <div className="grid gap-1"><Label>Expected Participants</Label><Input type="number" value={editForm.expected_participants} onChange={(e) => setEditForm({ ...editForm, expected_participants: e.target.value })} /></div>
              </div>
              <div className="border-t pt-3">
                <Label className="text-sm font-semibold flex items-center gap-1 mb-3"><Mic className="h-4 w-4" />Speaker Details</Label>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1"><Label className="text-xs">Speaker Name</Label><Input value={editForm.speaker_name} onChange={(e) => setEditForm({ ...editForm, speaker_name: e.target.value })} /></div>
                    <div className="grid gap-1"><Label className="text-xs">Designation</Label><Input value={editForm.speaker_designation} onChange={(e) => setEditForm({ ...editForm, speaker_designation: e.target.value })} /></div>
                  </div>
                  <div className="grid gap-1"><Label className="text-xs">Organization</Label><Input value={editForm.speaker_organization} onChange={(e) => setEditForm({ ...editForm, speaker_organization: e.target.value })} /></div>
                  <div className="grid gap-1"><Label className="text-xs">Short Bio</Label><Textarea value={editForm.speaker_bio} onChange={(e) => setEditForm({ ...editForm, speaker_bio: e.target.value })} rows={2} /></div>
                </div>
              </div>
              <Button onClick={handleEditSave} disabled={editLoading}>{editLoading ? "Saving..." : "Save Changes"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </DashboardLayout>
  );
}
