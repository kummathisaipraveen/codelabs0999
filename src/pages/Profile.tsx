import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, Flame, Target, Zap, Star, CheckCircle2, Pencil, Camera, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
        supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user.id).single(),
        supabase.from("submissions").select("problem_id, score, tests_passed, tests_total, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("user_badges").select("earned_at, badge_id").eq("user_id", user.id),
      ]);

      if (pointsRes.data) setPoints(pointsRes.data);
      if (profileRes.data) {
        setDisplayName(profileRes.data.display_name || user.email || "");
        setAvatarUrl(profileRes.data.avatar_url);
      }

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

  const handleSaveName = async () => {
    if (!user || !editName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: editName.trim() })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Failed to update name.", variant: "destructive" });
    } else {
      setDisplayName(editName.trim());
      setEditing(false);
      toast({ title: "Profile updated" });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 2MB.", variant: "destructive" });
      return;
    }

    setUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setUploadingAvatar(false);
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
    setAvatarUrl(publicUrl);
    setUploadingAvatar(false);
    toast({ title: "Avatar updated" });
  };

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
          {/* Avatar */}
          <div className="relative group shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary text-2xl font-bold text-primary-foreground">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              {uploadingAvatar ? <Loader2 className="h-5 w-5 animate-spin text-foreground" /> : <Camera className="h-5 w-5 text-foreground" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-9 max-w-xs bg-secondary/50 border-border/50"
                  maxLength={50}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                />
                <Button size="icon" variant="ghost" onClick={handleSaveName} disabled={saving} className="h-8 w-8">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-accent" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditing(false)} className="h-8 w-8">
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold font-heading truncate">{displayName}</h1>
                <Button size="icon" variant="ghost" onClick={() => { setEditName(displayName); setEditing(true); }} className="h-7 w-7 shrink-0">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            )}
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
