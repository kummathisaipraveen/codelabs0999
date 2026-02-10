import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Code2, Trophy, BookOpen, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", label: "Home", icon: Terminal },
  { to: "/problems", label: "Problems", icon: BookOpen },
  { to: "/practice", label: "Practice", icon: Code2 },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

const Navbar = () => {
  const location = useLocation();

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50"
    >
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
            <Code2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            CODE <span className="gradient-text">LABS</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;
            return (
              <Button
                key={to}
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={`gap-2 text-sm ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                asChild
              >
                <Link to={to}>
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              </Button>
            );
          })}
        </div>

        <Button size="sm" className="gradient-primary text-primary-foreground font-semibold glow-primary">
          Sign In
        </Button>
      </div>
    </motion.nav>
  );
};

export default Navbar;
