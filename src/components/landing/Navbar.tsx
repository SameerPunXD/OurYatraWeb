import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { rolePathMap } from "@/components/dashboard/sidebarConfig";

const navLinks = ["Services", "Drive", "Safety", "Help"];

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, activeRole } = useAuth();

  const dashboardPath = activeRole ? rolePathMap[activeRole] : "/";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 flex items-center justify-between h-16 w-full">
        <a href="/" className="text-xl font-extrabold tracking-tight text-foreground">
          Our <span className="text-primary">Yatra</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase()}`}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link}
            </a>
          ))}
          {user ? (
            <Button size="sm" className="rounded-lg font-semibold px-6 h-9 text-sm" asChild>
              <Link to={dashboardPath}>Dashboard</Link>
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="text-sm" asChild>
                <Link to="/login">Log In</Link>
              </Button>
              <Button size="sm" className="rounded-lg font-semibold px-6 h-9 text-sm" asChild>
                <Link to="/signup">Get Started</Link>
              </Button>
            </div>
          )}
        </div>

        <button className="md:hidden text-foreground" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background border-t border-border overflow-hidden"
          >
            <div className="px-6 py-4 space-y-3">
              {navLinks.map((link) => (
                <a
                  key={link}
                  href={`#${link.toLowerCase()}`}
                  className="block text-sm font-medium text-foreground py-1"
                  onClick={() => setMenuOpen(false)}
                >
                  {link}
                </a>
              ))}
              {user ? (
                <Button size="sm" className="w-full rounded-lg mt-2" asChild>
                  <Link to={dashboardPath} onClick={() => setMenuOpen(false)}>Dashboard</Link>
                </Button>
              ) : (
                <div className="space-y-2 mt-2">
                  <Button variant="outline" size="sm" className="w-full rounded-lg" asChild>
                    <Link to="/login" onClick={() => setMenuOpen(false)}>Log In</Link>
                  </Button>
                  <Button size="sm" className="w-full rounded-lg" asChild>
                    <Link to="/signup" onClick={() => setMenuOpen(false)}>Get Started</Link>
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
