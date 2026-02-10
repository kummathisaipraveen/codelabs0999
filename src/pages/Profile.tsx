import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Trophy, Flame, Target, Zap, Star, CheckCircle2 } from "lucide-react";

interface UserPoints {
  total_points: number;
  problems_solved: number;
  current_streak: number;
  longest_streak: number;
}

interface SolvedProblem {
  problem_id: number;
  score: number;
  tests_passed: number;
  tests_total: number;
  created_at: string;
  title: string;
  difficulty: string;
}

interface EarnedBadge {
  earned_at: string;
  name: string;
  description: string;
  icon: string;
}

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [points, setPoints] = useState<UserPoints | null>(null);
  const [solvedProblems, setSolvedProblems] = useState<SolvedProblem[]>([]);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);

      const [pointsRes, profileRes, subsRes, badgesRes] = await Promise.all([
        supabase.from("user_points").select("*").eq("user_id", user.id).single(),
        supabase.from("profiles").select("display_name").eq("user_id", user.id).single(),
        supabase.from("submissions").select("problem_id, score, tests_passed, tests_total, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("user_badges").select("earned_at, badge_id").eq("user_id", user.id),
      ]);

      if (pointsRes.data) setPoints(pointsRes.data);
      if (profileRes.data) setDisplayName(profileRes.data.display_name || user.email || "");

      // Enrich submissions with problem titles
      if (subsRes.data && subsRes.data.length > 0) {
        const problemIds = [...new Set(subsRes.data.map((s) => s.problem_id))];
        const { data: problems } = await supabase.from("problems").select("id, title, difficulty").in("id", problemIds);
        const problemMap = new Map(problems?.map((p) => [p.id, p]) || []);

        // Keep best submission per problem
        const bestByProblem = new Map<number, typeof subsRes.data[0]>();
        for (const s of subsRes.data) {
          const existing = bestByProblem.get(s.problem_id);
          if (!existing || s.score > existing.score) {
            bestByProblem.set(s.problem_id, s);
          }
        }

        setSolvedProblems(
          Array.from(bestByProblem.values()).map((s) => ({
            ...s,
            title: problemMap.get(s.problem_id)?.title || `Problem #${s.problem_id}`,
            difficulty: problemMap.get(s.problem_id)?.difficulty || "Easy",
          }))
        );
      }

      // Enrich badges
      if (badgesRes.data && badgesRes.data.length > 0) {
        const badgeIds = badgesRes.data.map((b) => b.badge_id);
        const { data: badgeDetails } = await supabase.from("badges").select("id, name, description, icon").in("id", badgeIds);
        const badgeMap = new Map(badgeDetails?.map((b) => [b.id, b]) || []);

        setBadges(
          badgesRes.data.map((ub) => {
            const detail = badgeMap.get(ub.badge_id);
            return {
              earned_at: ub.earned_at,
              name: detail?.name || "Badge",
              description: detail?.description || "",
              icon: detail?.icon || "🏆",
            };
          })
        );
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background pt-24 px-4">
        <div className="container max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const difficultyVariant = (d: string) =>
    d === "Easy" ? "easy" : d === "Medium" ? "medium" : "hard";

  return (
    <div className="min-h-screen bg-background pt-24 px-4 pb-12">
      <div className="container max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8 flex items-center gap-6"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary text-2xl font-bold text-primary-foreground shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">{displayName}</h1>
            <p className="text-muted-foreground text-sm">{user?.email}</p>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { label: "Total Points", value: points?.total_points ?? 0, icon: Star, color: "text-primary" },
            { label: "Problems Solved", value: points?.problems_solved ?? 0, icon: CheckCircle2, color: "text-accent" },
            { label: "Current Streak", value: `${points?.current_streak ?? 0}d`, icon: Flame, color: "text-warning" },
            { label: "Longest Streak", value: `${points?.longest_streak ?? 0}d`, icon: Zap, color: "text-primary" },
          ].map((stat) => (
            <Card key={stat.label} className="glass border-border/50">
              <CardContent className="p-5 flex flex-col items-center text-center gap-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <span className="text-2xl font-bold font-heading">{stat.value}</span>
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-primary" />
                Earned Badges
              </CardTitle>
            </CardHeader>
            <CardContent>
              {badges.length === 0 ? (
                <p className="text-muted-foreground text-sm">No badges earned yet. Keep solving problems!</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {badges.map((badge, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                      <span className="text-2xl">{badge.icon}</span>
                      <div>
                        <p className="font-semibold text-sm">{badge.name}</p>
                        <p className="text-xs text-muted-foreground">{badge.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Solved Problems */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-accent" />
                Solved Problems
              </CardTitle>
            </CardHeader>
            <CardContent>
              {solvedProblems.length === 0 ? (
                <p className="text-muted-foreground text-sm">No problems solved yet. Start practicing!</p>
              ) : (
                <div className="space-y-3">
                  {solvedProblems.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-secondary/50 p-3 cursor-pointer hover:bg-secondary/80 transition-colors"
                      onClick={() => navigate(`/practice/${p.problem_id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={difficultyVariant(p.difficulty)}>{p.difficulty}</Badge>
                        <span className="font-medium text-sm">{p.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24">
                          <Progress value={(p.tests_passed / Math.max(p.tests_total, 1)) * 100} className="h-2" />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {p.tests_passed}/{p.tests_total} tests
                        </span>
                        <span className="text-xs font-semibold text-primary">+{p.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
