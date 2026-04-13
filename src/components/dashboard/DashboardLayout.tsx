import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import DashboardSidebar from "./DashboardSidebar";
import DashboardTopbar from "./DashboardTopbar";

interface DashboardLayoutProps {
  title?: string;
}

const DashboardLayout = ({ title }: DashboardLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full max-w-full overflow-x-hidden">
        <DashboardSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <DashboardTopbar title={title} />
          <main className="flex-1 min-w-0 bg-secondary/30 px-3 py-4 sm:px-4 sm:py-5 md:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
