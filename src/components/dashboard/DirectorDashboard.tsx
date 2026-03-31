import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Building2, Calendar, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const COLORS = ["hsl(221,83%,53%)", "hsl(142,76%,36%)", "hsl(38,92%,50%)", "hsl(280,65%,60%)", "hsl(0,84%,60%)"];

export default function DirectorDashboard() {
  const [stats, setStats] = useState({ alumni: 0, departments: 0, events: 0, users: 0 });
  const [deptDist, setDeptDist] = useState<any[]>([]);
  const [yearlyGrowth, setYearlyGrowth] = useState<any[]>([]);
  const [placementData, setPlacementData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [alumniRes, deptRes, eventRes, usersRes] = await Promise.all([
        supabase.from("alumni").select("id, department_id, graduation_year, placement_status", { count: "exact", head: false }),
        supabase.from("departments").select("id, name"),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        alumni: alumniRes.count || 0,
        departments: deptRes.data?.length || 0,
        events: eventRes.count || 0,
        users: usersRes.count || 0,
      });

      const alumni = alumniRes.data || [];
      const depts = deptRes.data || [];

      // Department distribution
      const deptMap = new Map(depts.map((d) => [d.id, d.name]));
      const deptCounts: Record<string, number> = {};
      alumni.forEach((a) => {
        const name = deptMap.get(a.department_id) || "Unknown";
        deptCounts[name] = (deptCounts[name] || 0) + 1;
      });
      setDeptDist(Object.entries(deptCounts).map(([name, value]) => ({ name, value })));

      // Yearly growth
      const yearCounts: Record<number, number> = {};
      alumni.forEach((a) => {
        if (a.graduation_year) yearCounts[a.graduation_year] = (yearCounts[a.graduation_year] || 0) + 1;
      });
      setYearlyGrowth(
        Object.entries(yearCounts)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([year, count]) => ({ year, count }))
      );

      // Placement stats
      const placeCounts: Record<string, number> = {};
      alumni.forEach((a) => {
        const s = a.placement_status || "unknown";
        placeCounts[s] = (placeCounts[s] || 0) + 1;
      });
      setPlacementData(Object.entries(placeCounts).map(([name, value]) => ({ name, value })));
    };
    fetchData();
  }, []);

  const statCards = [
    { label: "Total Alumni", value: stats.alumni, icon: GraduationCap, color: "text-primary" },
    { label: "Departments", value: stats.departments, icon: Building2, color: "text-success" },
    { label: "Events", value: stats.events, icon: Calendar, color: "text-warning" },
    { label: "Users", value: stats.users, icon: Users, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Department-wise Alumni</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deptDist}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(221,83%,53%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Placement Statistics</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={placementData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {placementData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Yearly Alumni Growth</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={yearlyGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(221,83%,53%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
