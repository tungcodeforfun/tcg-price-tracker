import { NavLink, useLocation } from "react-router-dom";
import { Home, Search, FolderOpen, Bell, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Dashboard", to: "/dashboard" },
  { icon: Search, label: "Search", to: "/search" },
  { icon: FolderOpen, label: "Collection", to: "/collection" },
  { icon: Bell, label: "Alerts", to: "/alerts" },
  { icon: User, label: "Profile", to: "/profile" },
];

export function Sidebar({ className }: { className?: string }) {
  const location = useLocation();

  return (
    <aside className={cn("hidden md:flex flex-col w-64 border-r bg-card h-screen sticky top-0", className)}>
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
          TCG Price Tracker
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Track. Collect. Profit.</p>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map(({ icon: Icon, label, to }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink key={to} to={to}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <Icon className="w-5 h-5 mr-3" />
                {label}
              </Button>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileSidebar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
            TCG Price Tracker
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track. Collect. Profit.</p>
        </div>
        <nav className="p-4 space-y-2">
          {navItems.map(({ icon: Icon, label, to }) => {
            const isActive = location.pathname === to;
            return (
              <NavLink key={to} to={to} onClick={() => setOpen(false)}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full justify-start"
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {label}
                </Button>
              </NavLink>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
