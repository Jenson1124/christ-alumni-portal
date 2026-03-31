import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard, Users, GraduationCap, Calendar, FileText, Megaphone,
  Settings, Building2, UserCog, LogOut, ChevronUp,
} from "lucide-react";

const directorMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Departments", url: "/departments", icon: Building2 },
  { title: "User Management", url: "/users", icon: UserCog },
  { title: "Alumni", url: "/alumni", icon: GraduationCap },
  { title: "Events", url: "/events", icon: Calendar },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Announcements", url: "/announcements", icon: Megaphone },
  { title: "Settings", url: "/settings", icon: Settings },
];

const hodMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Alumni", url: "/alumni", icon: GraduationCap },
  { title: "Events", url: "/events", icon: Calendar },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Announcements", url: "/announcements", icon: Megaphone },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Alumni", url: "/alumni", icon: GraduationCap },
  { title: "Events", url: "/events", icon: Calendar },
  { title: "Settings", url: "/settings", icon: Settings },
];

export default function AppSidebar() {
  const { userRole, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = userRole?.role === "director"
    ? directorMenuItems
    : userRole?.role === "hod"
      ? hodMenuItems
      : adminMenuItems;

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <GraduationCap className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">Alumni Portal</span>
            <span className="text-xs capitalize text-sidebar-foreground/60">{userRole?.role?.replace("_", " ") || "User"}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.url}
                    onClick={() => navigate(item.url)}
                    tooltip={item.title}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-medium">{profile?.full_name || "User"}</span>
                    <span className="text-xs text-sidebar-foreground/60">{profile?.email}</span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-56">
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { signOut(); navigate("/login"); }}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
