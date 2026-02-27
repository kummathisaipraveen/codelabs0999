import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import StudentDashboard from "./dashboards/StudentDashboard";
import TeacherDashboard from "./dashboards/TeacherDashboard";
import RecruiterDashboard from "./dashboards/RecruiterDashboard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Dashboard = () => {
  const { user, loading } = useAuth();
  const { primaryRole, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showResetDialog, setShowResetDialog] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
    if (searchParams.get("reset") === "true") {
      setShowResetDialog(true);
    }
  }, [user, loading, navigate, searchParams]);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  let content;
  switch (primaryRole) {
    case "teacher":
      content = <TeacherDashboard />;
      break;
    case "recruiter":
      content = <RecruiterDashboard />;
      break;
    default:
      content = <StudentDashboard />;
  }

  return (
    <>
      {content}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change your password?</AlertDialogTitle>
            <AlertDialogDescription>
              You've logged in with a temporary code. Would you like to update your password now to keep your account secure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Later</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => navigate("/update-password")}
              className="gradient-primary text-primary-foreground"
            >
              Update Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Dashboard;
