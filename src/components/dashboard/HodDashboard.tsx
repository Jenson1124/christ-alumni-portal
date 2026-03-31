import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Calendar, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function HodDashboard() {
  const { userRole } = useAuth();
  const [stats, setStats] = useState({ alumni: 0, events: 0 });
  const [yearlyData, setYearlyData] = useState<any[]>([]);

  useEffect(() => {
    if (!userRole?.department_id) return;
    const fetchData = async () => {
      const [alumniRes, eventRes] = await Promise.all([
        supabase.from("alumni").select("id, graduation_year", { count: "exact" }).eq("department_id", userRole.department_id!),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("department_id", userRole.department_id!),
      ]);

      setStats({ alumni: alumniRes.count || 0, events: eventRes.count || 0 });

      const yearCounts: Record<number, number> = {};
      (alumniRes.data || []).forEach((a) => {
        if (a.graduation_year) yearCounts[a.graduation_year] = (yearCounts[a.graduation_year] || 0) + 1;
      });
      setYearlyData(Object.entries(yearCounts).sort(([a], [b]) => Number(a) - Number(b)).map(([year, count]) => ({ year, count })));
    };
    fetchData();
  }, [userRole?.department_id]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Department Alumni</CardTitle>
            <GraduationCap className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.alumni}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Department Events</CardTitle>
            <Calendar className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.events}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Growth Rate</CardTitle>
            <TrendingUp className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{yearlyData.length > 1 ? "+" + ((yearlyData[yearlyData.length - 1]?.count || 0) - (yearlyData[yearlyData.length - 2]?.count || 0)) : "N/A"}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Alumni by Year</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={yearlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(221,83%,53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
