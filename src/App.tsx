import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Problems from "./pages/Problems";
import Practice from "./pages/Practice";
import Leaderboard from "./pages/Leaderboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/problems" element={<WithNav><Problems /></WithNav>} />
          <Route path="/practice" element={<WithNav><Practice /></WithNav>} />
          <Route path="/leaderboard" element={<WithNav><Leaderboard /></WithNav>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

// Wrapper to include Navbar on sub-pages
import Navbar from "@/components/Navbar";
const WithNav = ({ children }: { children: React.ReactNode }) => (
  <>
    <Navbar />
    {children}
  </>
);

export default App;
