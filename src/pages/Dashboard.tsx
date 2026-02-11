import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import StudentDashboard from "./StudentDashboard";
import TeacherDashboard from "./TeacherDashboard";
import RecruiterDashboard from "./RecruiterDashboard";

const Dashboard = () => {
  const { user, loading } = useAuth();
  const { primaryRole, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  switch (primaryRole) {
    case "teacher":
      return <TeacherDashboard />;
    case "recruiter":
      return <RecruiterDashboard />;
    default:
      return <StudentDashboard />;
  }
};

export default Dashboard;
