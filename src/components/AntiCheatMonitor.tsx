import { useEffect, useState } from 'react';
import { useToast } from "@/hooks/use-toast";

interface AntiCheatProps {
  onViolation: (type: string) => void;
}

export const AntiCheatMonitor = ({ onViolation }: AntiCheatProps) => {
  const { toast } = useToast();
  const [blurCount, setBlurCount] = useState(0);

  useEffect(() => {
    // 1. Detect Tab Switching / Window Blur
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setBlurCount(prev => prev + 1);
        onViolation("tab_switch");
        toast({
          title: "Focus Lost!",
          description: "Please stay on this tab to avoid flagging.",
          variant: "destructive",
        });
      }
    };

    // 2. Detect Copy/Paste (Global listener, though closer to editor is better)
    const handleCopy = (e: ClipboardEvent) => {
        // Allow copy if it's from the problem description? 
        // For now, simple strict mode: log it.
        onViolation("copy_attempt");
        // e.preventDefault(); // Optional: Block it entirely
    };

    const handlePaste = (e: ClipboardEvent) => {
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
