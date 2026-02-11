import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "student" | "teacher" | "recruiter";

export const useUserRole = () => {
  const { user } = useAuth();

  const { data: roles, isLoading } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data?.map((r) => r.role) as AppRole[]) || [];
    },
    enabled: !!user,
  });

  const primaryRole: AppRole = roles?.[0] || "student";
  const hasRole = (role: AppRole) => roles?.includes(role) ?? false;

  return { roles: roles || [], primaryRole, hasRole, isLoading };
};
