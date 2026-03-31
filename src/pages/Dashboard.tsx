import { useAuth } from "@/contexts/AuthContext";
import DirectorDashboard from "@/components/dashboard/DirectorDashboard";
import HodDashboard from "@/components/dashboard/HodDashboard";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function Dashboard() {
  const { userRole } = useAuth();

  return (
    <DashboardLayout>
      {userRole?.role === "director" ? <DirectorDashboard /> : <HodDashboard />}
    </DashboardLayout>
  );
}
