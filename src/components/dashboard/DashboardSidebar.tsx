import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { sidebarConfig, roleLabelMap } from "./sidebarConfig";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const DashboardSidebar = () => {
  const { activeRole, profile, signOut } = useAuth();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();

  if (!activeRole) return null;

  const items = sidebarConfig[activeRole];
  const roleLabel = roleLabelMap[activeRole];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Brand */}
        <div className="px-4 py-4 border-b border-border">
          {!collapsed ? (
            <a href="/" className="text-xl font-extrabold tracking-tight text-foreground">
              Our<span className="text-primary">Yatra</span>
            </a>
          ) : (
            <a href="/" className="text-xl font-extrabold text-primary">L</a>
          )}
          {!collapsed && (
            <p className="text-xs text-muted-foreground mt-1">{roleLabel} Dashboard</p>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === `/${activeRole}`}
                      className="hover:bg-accent/50"
                      activeClassName="bg-accent text-primary font-medium"
                      onClick={handleNavClick}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-3 py-3 border-t border-border">
          {!collapsed && (
            <p className="text-sm font-medium text-foreground truncate mb-2">
              {profile?.full_name || "User"}
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {!collapsed && "Sign Out"}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default DashboardSidebar;
