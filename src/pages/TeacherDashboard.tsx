import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, BookOpen, BarChart3, Eye, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

const TeacherDashboard = () => {
  const { user } = useAuth();
  const { hasRole, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [problems, setProblems] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (roleLoading) return;
    if (!user) { navigate("/auth"); return; }
    if (!hasRole("teacher")) { navigate("/dashboard"); return; }

    const fetchData = async () => {
      const [profilesRes, problemsRes, subsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url, created_at"),
        supabase.from("problems").select("*").order("id"),
        supabase.from("submissions").select("*, problems(title, difficulty)").order("created_at", { ascending: false }).limit(50),
      ]);

      // Get points for all students
      const { data: pointsData } = await supabase.from("user_points").select("*");

      const studentsWithPoints = (profilesRes.data || []).map((p) => ({
        ...p,
        points: pointsData?.find((pt) => pt.user_id === p.user_id),
      }));

      setStudents(studentsWithPoints);
      setProblems(problemsRes.data || []);
      setSubmissions(subsRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [user, navigate, hasRole, roleLoading]);

  if (loading || roleLoading) return <div className="min-h-screen pt-20 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  const totalSubmissions = submissions.length;
  const avgScore = totalSubmissions > 0 ? Math.round(submissions.reduce((a, s) => a + s.score, 0) / totalSubmissions) : 0;
  const passRate = totalSubmissions > 0 ? Math.round((submissions.filter((s) => s.tests_passed === s.tests_total).length / totalSubmissions) * 100) : 0;

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="container max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2">Teacher Dashboard</h1>
          <p className="text-muted-foreground mb-8">Monitor student progress and performance</p>
        </motion.div>

        {/* Overview stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Students", value: students.length, icon: Users, color: "text-blue-500" },
            { label: "Total Problems", value: problems.length, icon: BookOpen, color: "text-green-500" },
            { label: "Avg Score", value: avgScore, icon: BarChart3, color: "text-yellow-500" },
            { label: "Pass Rate", value: `${passRate}%`, icon: TrendingUp, color: "text-purple-500" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="glass border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{s.label}</span>
                    <s.icon className={`h-5 w-5 ${s.color}`} />
                  </div>
                  <div className="text-2xl font-bold">{s.value}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Student leaderboard */}
          <Card className="glass border-border/50">
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Student Progress</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {students.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No students found.</p>
                ) : students
                  .sort((a, b) => (b.points?.total_points || 0) - (a.points?.total_points || 0))
                  .slice(0, 15)
                  .map((student, i) => (
                    <div key={student.user_id} className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/30">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                        <div>
                          <span className="text-sm font-medium">{student.display_name || "Anonymous"}</span>
                          <div className="flex gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{student.points?.problems_solved || 0} solved</span>
                            <span className="text-xs text-muted-foreground">🔥 {student.points?.current_streak || 0}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-primary">{student.points?.total_points || 0} pts</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent submissions */}
          <Card className="glass border-border/50">
            <CardHeader><CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> Recent Submissions</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {submissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No submissions yet.</p>
                ) : submissions.slice(0, 15).map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/30">
                    <div>
                      <span className="text-sm font-medium">{(sub as any).problems?.title || `Problem #${sub.problem_id}`}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={sub.tests_passed === sub.tests_total ? "easy" : "medium"} className="text-[10px]">
                          {sub.tests_passed}/{sub.tests_total}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{new Date(sub.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold">+{sub.score}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
