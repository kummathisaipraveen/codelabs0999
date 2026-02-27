import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "student" | "teacher" | "recruiter";

export const useUserRole = () => {
  const { user, loading } = useAuth();

  // Read role from user metadata (set during signup)
  const role = user?.user_metadata?.role as AppRole | undefined;

  // Default to student if no role found
  const primaryRole: AppRole = role || "student";

  return {
    primaryRole,
    isLoading: loading
  };
};
