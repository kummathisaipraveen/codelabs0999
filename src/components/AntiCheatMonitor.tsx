import { useEffect, useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface AntiCheatProps {
  onViolation: (type: string) => void;
}

export const AntiCheatMonitor = ({ onViolation }: AntiCheatProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [blurCount, setBlurCount] = useState(0);

  const logInteraction = async (actionType: string, metadata: any) => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch("/api/logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          student_id: user.id,
          problem_id: id ? parseInt(id) : null,
          action_type: actionType,
          metadata
        })
      });
    } catch (e) { console.error("Failed to log interaction", e); }
  };

  useEffect(() => {
    // 1. Detect Tab Switching / Window Blur
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setBlurCount(prev => {
          const next = prev + 1;
          logInteraction("tab_switch", { blurCount: next });
          return next;
        });
        onViolation("tab_switch");
        toast({
          title: "Focus Lost!",
          description: "Please stay on this tab to avoid flagging.",
          variant: "destructive",
        });
      }
    };

    // 2. Detect Copy/Paste
    const handleCopy = (e: ClipboardEvent) => {
        logInteraction("copy_attempt", { path: window.location.pathname });
        onViolation("copy_attempt");
    };

    const handlePaste = (e: ClipboardEvent) => {
        logInteraction("paste_attempt", { path: window.location.pathname });
        onViolation("paste_attempt");
        e.preventDefault(); 
        toast({
            title: "Paste Blocked",
            description: "Pasting code is not allowed.",
            variant: "destructive",
        });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
    };
  }, [onViolation, toast]);

  return null; // Invisible component
};
