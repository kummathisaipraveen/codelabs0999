import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Users, Trophy, Flame, Star, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

const RecruiterDashboard = () => {
  const { user } = useAuth();
  const { hasRole, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [minPoints, setMinPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (roleLoading) return;
    if (!user) { navigate("/auth"); return; }
    if (!hasRole("recruiter")) { navigate("/dashboard"); return; }

    const fetchData = async () => {
      const [profilesRes, pointsRes, badgesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url"),
        supabase.from("user_points").select("*"),
        supabase.from("user_badges").select("user_id, badges(name, icon)"),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p]));
      const badgeMap = new Map<string, any[]>();
      (badgesRes.data || []).forEach((ub) => {
        const list = badgeMap.get(ub.user_id) || [];
        list.push(ub);
        badgeMap.set(ub.user_id, list);
      });

      const merged = (pointsRes.data || []).map((pt) => ({
        ...pt,
        profile: profileMap.get(pt.user_id),
        badges: badgeMap.get(pt.user_id) || [],
      }));

      setCandidates(merged);
      setLoading(false);
    };
    fetchData();
  }, [user, navigate, hasRole, roleLoading]);

  if (loading || roleLoading) return <div className="min-h-screen pt-20 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  const filtered = candidates
    .filter((c) => {
      const name = (c.profile?.display_name || "").toLowerCase();
      return name.includes(search.toLowerCase()) && c.total_points >= minPoints;
    })
    .sort((a, b) => b.total_points - a.total_points);

  const topPerformers = candidates.filter((c) => c.problems_solved >= 5).length;
  const avgPoints = candidates.length > 0 ? Math.round(candidates.reduce((a, c) => a + c.total_points, 0) / candidates.length) : 0;

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="container max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2">Recruiter Dashboard</h1>
          <p className="text-muted-foreground mb-8">Discover top coding talent</p>
        </motion.div>

        {/* Overview stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Candidates", value: candidates.length, icon: Users, color: "text-blue-500" },
            { label: "Top Performers (5+ solved)", value: topPerformers, icon: Star, color: "text-yellow-500" },
            { label: "Avg Points", value: avgPoints, icon: Trophy, color: "text-green-500" },
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

        {/* Filters */}
        <Card className="glass border-border/50 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-card/50 border-border/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Min points:</span>
                {[0, 50, 100, 200].map((v) => (
                  <Button key={v} size="sm" variant={minPoints === v ? "default" : "outline"} onClick={() => setMinPoints(v)} className="text-xs">
                    {v === 0 ? "All" : `${v}+`}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Candidate list */}
        <Card className="glass border-border/50">
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Candidates ({filtered.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground">No candidates match your filters.</p>
              ) : filtered.map((candidate, i) => (
                <motion.div key={candidate.user_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/30 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-primary text-sm font-bold text-primary-foreground">
                      {(candidate.profile?.display_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-semibold">{candidate.profile?.display_name || "Anonymous"}</span>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">{candidate.problems_solved} problems</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Flame className="h-3 w-3 text-orange-500" />{candidate.current_streak} streak</span>
                        {candidate.badges.length > 0 && (
                          <div className="flex gap-0.5">
                            {candidate.badges.slice(0, 3).map((b: any, j: number) => (
                              <span key={j} className="text-xs">{b.badges?.icon || "🏆"}</span>
                            ))}
                            {candidate.badges.length > 3 && <span className="text-xs text-muted-foreground">+{candidate.badges.length - 3}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">{candidate.total_points}</div>
                    <span className="text-xs text-muted-foreground">points</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RecruiterDashboard;
