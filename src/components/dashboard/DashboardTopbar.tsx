import { useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { roleLabelMap } from "./sidebarConfig";
import NotificationDropdown from "./NotificationDropdown";

interface DashboardTopbarProps {
  title?: string;
}

const DashboardTopbar = ({ title }: DashboardTopbarProps) => {
  const { activeRole, roles, setActiveRole } = useAuth();
  const navigate = useNavigate();

  const handleRoleSwitch = (newRole: string) => {
    setActiveRole(newRole as any);
    navigate(`/${newRole}`);
  };

  return (
    <header className="h-14 flex items-center justify-between border-b border-border px-3 sm:px-4 bg-background gap-2 overflow-hidden">
      <div className="flex items-center gap-2 min-w-0">
        <SidebarTrigger className="text-foreground shrink-0" />
        {title && <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">{title}</h1>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {roles.length > 1 && activeRole && (
          <select
            value={activeRole}
            onChange={(e) => handleRoleSwitch(e.target.value)}
            className="text-sm bg-secondary text-secondary-foreground rounded-md px-2 py-1 border border-border max-w-[110px] sm:max-w-none"
          >
            {roles.map((r) => (
              <option key={r} value={r}>{roleLabelMap[r]}</option>
            ))}
          </select>
        )}

        <NotificationDropdown />
      </div>
    </header>
  );
};

export default DashboardTopbar;
