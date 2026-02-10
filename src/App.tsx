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
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Navbar from "@/components/Navbar";

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
            <Route path="/problems" element={<WithNav><Problems /></WithNav>} />
            <Route path="/practice/:id" element={<WithNav><Practice /></WithNav>} />
            <Route path="/practice" element={<WithNav><Practice /></WithNav>} />
            <Route path="/leaderboard" element={<WithNav><Leaderboard /></WithNav>} />
            <Route path="/profile" element={<WithNav><Profile /></WithNav>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
