import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Code2, Trophy, BookOpen, Terminal, LogOut, User, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { to: "/", label: "Home", icon: Terminal },
  { to: "/problems", label: "Problems", icon: BookOpen },
  { to: "/practice", label: "Practice", icon: Code2 },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

const Navbar = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50"
    >
      <div className="container flex h-16 items-center justify-between">
        <Button variant="ghost" className="flex items-center gap-2 p-0 hover:bg-transparent" asChild>
          <Link to="/">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
              <Code2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              CODE <span className="gradient-text">LABS</span>
            </span>
          </Link>
        </Button>

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

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2 border-border/50">
                <div className="flex h-6 w-6 items-center justify-center rounded-full gradient-primary text-[10px] font-bold text-primary-foreground">
                  {user.email?.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline text-sm truncate max-w-[120px]">
                  {user.email}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/dashboard" className="flex items-center">
                  <LayoutDashboard className="h-3 w-3 mr-2" />
                  Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex items-center">
                  <User className="h-3 w-3 mr-2" />
                  My Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                <LogOut className="h-3 w-3 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button size="sm" className="gradient-primary text-primary-foreground font-semibold glow-primary" asChild>
            <Link to="/auth">Sign In</Link>
          </Button>
        )}
      </div>
    </motion.nav>
  );
};

export default Navbar;
