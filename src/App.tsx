import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Problems from "./pages/Problems";
import Practice from "./pages/Practice";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import UpdatePassword from "./pages/UpdatePassword";
import NotFound from "./pages/NotFound";
import Navbar from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const queryClient = new QueryClient();

const WithNav = ({ children }: { children: React.ReactNode }) => (
  <>
    <Navbar />
    {children}
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/problems" element={<ProtectedRoute><WithNav><Problems /></WithNav></ProtectedRoute>} />
            <Route path="/practice/:id" element={<ProtectedRoute><WithNav><Practice /></WithNav></ProtectedRoute>} />
            <Route path="/practice" element={<ProtectedRoute><WithNav><Practice /></WithNav></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><WithNav><Leaderboard /></WithNav></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><WithNav><Profile /></WithNav></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><WithNav><Dashboard /></WithNav></ProtectedRoute>} />
            <Route path="/update-password" element={<ProtectedRoute><UpdatePassword /></ProtectedRoute>} />
            <Route path="*" element={<WithNav><NotFound /></WithNav>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
