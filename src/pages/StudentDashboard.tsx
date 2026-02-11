import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BookOpen, Trophy, Flame, Medal, Target, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [recentSubs, setRecentSubs] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [totalProblems, setTotalProblems] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }

    const fetchData = async () => {
      const [pointsRes, subsRes, badgesRes, problemsRes] = await Promise.all([
        supabase.from("user_points").select("*").eq("user_id", user.id).single(),
        supabase.from("submissions").select("*, problems(title, difficulty)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("user_badges").select("*, badges(name, icon, description)").eq("user_id", user.id),
        supabase.from("problems").select("id", { count: "exact" }),
      ]);

      setStats(pointsRes.data);
      setRecentSubs(subsRes.data || []);
      setBadges(badgesRes.data || []);
      setTotalProblems(problemsRes.count || 0);
      setLoading(false);
    };
    fetchData();
  }, [user, navigate]);

  if (loading) return <div className="min-h-screen pt-20 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  const solvedPercent = totalProblems > 0 ? Math.round(((stats?.problems_solved || 0) / totalProblems) * 100) : 0;

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="container max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2">Student Dashboard</h1>
          <p className="text-muted-foreground mb-8">Track your learning progress and achievements</p>
        </motion.div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Points", value: stats?.total_points || 0, icon: Trophy, color: "text-yellow-500" },
            { label: "Problems Solved", value: stats?.problems_solved || 0, icon: Target, color: "text-green-500" },
            { label: "Current Streak", value: `${stats?.current_streak || 0} days`, icon: Flame, color: "text-orange-500" },
            { label: "Longest Streak", value: `${stats?.longest_streak || 0} days`, icon: TrendingUp, color: "text-blue-500" },
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Progress */}
          <Card className="glass border-border/50 lg:col-span-2">
            <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Progress</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Problems completed</span>
                  <span className="font-semibold">{stats?.problems_solved || 0} / {totalProblems}</span>
                </div>
                <Progress value={solvedPercent} className="h-3" />
              </div>

              <h3 className="font-semibold text-sm mb-3">Recent Submissions</h3>
              <div className="space-y-2">
                {recentSubs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No submissions yet. Start solving problems!</p>
                ) : recentSubs.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/30">
                    <div>
                      <span className="text-sm font-medium">{(sub as any).problems?.title || `Problem #${sub.problem_id}`}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={sub.tests_passed === sub.tests_total ? "easy" : "medium"} className="text-[10px]">
                          {sub.tests_passed}/{sub.tests_total} passed
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(sub.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-primary">+{sub.score}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Badges */}
          <Card className="glass border-border/50">
            <CardHeader><CardTitle className="flex items-center gap-2"><Medal className="h-5 w-5" /> Badges</CardTitle></CardHeader>
            <CardContent>
              {badges.length === 0 ? (
                <p className="text-sm text-muted-foreground">No badges earned yet. Keep solving problems!</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {badges.map((ub) => (
                    <div key={ub.id} className="flex flex-col items-center p-3 rounded-lg bg-card/50 border border-border/30 text-center">
                      <span className="text-2xl mb-1">{(ub as any).badges?.icon || "🏆"}</span>
                      <span className="text-xs font-semibold">{(ub as any).badges?.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
