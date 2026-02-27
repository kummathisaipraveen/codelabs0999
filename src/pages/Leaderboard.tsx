import { motion } from "framer-motion";
import { Trophy, Flame, Medal, Crown, Star, TrendingUp, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const badgesList = [
  { name: "Logical Thinker", description: "Mastered 3 debugging tasks", icon: "🧠" },
  { name: "Consistency Hero", description: "7-day coding streak", icon: "🔥" },
  { name: "Creative Coder", description: "Refactored 10+ solutions", icon: "✨" },
  { name: "Speed Demon", description: "Solved 5 problems under time limit", icon: "⚡" },
  { name: "Graph Master", description: "Mastered all graph problems", icon: "🕸️" },
  { name: "Recursion Guru", description: "Solved 10 recursive problems", icon: "🔄" },
];

interface BadgeItem {
  name: string;
  description: string;
  icon: string;
}

const RankIcon = ({ rank }: { rank: number }) => {
  if (rank === 1) return <Crown className="h-5 w-5 text-warning" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-warning/60" />;
  return <span className="w-5 text-center text-sm font-mono text-muted-foreground">{rank}</span>;
};

interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  streak: number;
  problemsSolved: number;
  avatar: string;
}

const LeaderboardPage = () => {
  const { data: leaderboardData = [], isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      // Fetch points
      const { data: points, error: pointsError } = await supabase
        .from("user_points")
        .select("user_id, total_points, current_streak, problems_solved")
        .order("total_points", { ascending: false })
        .limit(20);

      if (pointsError) throw pointsError;
      if (!points || points.length === 0) return [];

      // Fetch profiles for those users
      const userIds = points.map((p) => p.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.display_name]));

      return points.map((entry, i) => {
        const name = profileMap.get(entry.user_id) || "Anonymous";
        return {
          rank: i + 1,
          name,
          points: entry.total_points,
          streak: entry.current_streak,
          problemsSolved: entry.problems_solved,
          avatar: name
            .split(" ")
            .map((w: string) => w[0])
            .join("")
            .substring(0, 2)
            .toUpperCase(),
        };
      });
    },
  });

  const { data: badges = [] } = useQuery({
    queryKey: ["badges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("badges").select("*").order("id");
      if (error) throw error;
      return data;
    },
  });

  const hasData = leaderboardData.length > 0;

  return (
    <div className="relative min-h-screen pt-24 pb-12">
      <div className="fixed inset-0 grid-pattern opacity-20" />
      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="mb-2 text-3xl font-bold flex items-center gap-3">
            <Trophy className="h-8 w-8 text-warning" />
            Leader<span className="gradient-text">board</span>
          </h1>
          <p className="text-muted-foreground">Top performers ranked by points, consistency, and mastery.</p>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            {/* Main leaderboard */}
            <div className="space-y-3">
              {!hasData ? (
                <div className="glass rounded-xl p-12 text-center">
                  <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No rankings yet</h3>
                  <p className="text-sm text-muted-foreground">Be the first to solve problems and earn points!</p>
                </div>
              ) : (
                <>
                  {/* Top 3 podium */}
                  {leaderboardData.length >= 3 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-3 gap-4 mb-6"
                    >
                      {[leaderboardData[1], leaderboardData[0], leaderboardData[2]].map((user, i) => {
                        if (!user) return null;
                        const heights = ["h-28", "h-36", "h-24"];
                        return (
                          <div key={user.rank} className="flex flex-col items-center">
                            <div className="glass rounded-xl p-4 text-center w-full mb-2 glow-primary">
                              <div className="relative mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full gradient-primary text-primary-foreground font-bold text-sm">
                                {user.avatar}
                                {user.rank === 1 && <Crown className="absolute -top-2 -right-1 h-4 w-4 text-warning" />}
                              </div>
                              <div className="text-sm font-semibold truncate">{user.name}</div>
                              <div className="text-lg font-bold gradient-text">{user.points.toLocaleString()}</div>
                              <div className="text-[10px] text-muted-foreground">points</div>
                            </div>
                            <div className={`w-full gradient-primary rounded-t-lg ${heights[i]} flex items-end justify-center pb-2`}>
                              <span className="text-2xl font-bold text-primary-foreground">{user.rank}</span>
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* Remaining rows */}
                  {leaderboardData.slice(3).map((user, i) => (
                    <motion.div
                      key={user.rank}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="glass rounded-xl p-4 flex items-center gap-4"
                    >
                      <RankIcon rank={user.rank} />
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-sm font-semibold">
                        {user.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{user.name}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Flame className="h-3 w-3 text-warning" />
                            {user.streak}d streak
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-primary" />
                            {user.problemsSolved} solved
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">{user.points.toLocaleString()}</div>
                      </div>
                    </motion.div>
                  ))}
                </>
              )}
            </div>

            {/* Badges sidebar */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Achievements
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                {(badges.length > 0 ? badges : badgesList).map((badge: BadgeItem) => (
                  <div
                    key={badge.name}
                    className="glass rounded-xl p-4 flex items-center gap-3 hover:border-primary/30 transition-colors"
                  >
                    <span className="text-2xl">{badge.icon}</span>
                    <div>
                      <div className="text-sm font-semibold">{badge.name}</div>
                      <div className="text-[10px] text-muted-foreground">{badge.description}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Scoring formula */}
              <div className="glass rounded-xl p-4 mt-4">
                <h4 className="text-sm font-semibold mb-2">Scoring Formula</h4>
                <div className="font-mono text-xs text-muted-foreground space-y-1">
                  <div>Points = (Difficulty × 10)</div>
                  <div className="text-success">+ Streak Modifier</div>
                  <div className="text-destructive">- (Hints Used × 2)</div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardPage;
