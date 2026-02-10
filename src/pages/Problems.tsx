import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, Filter, Clock, ArrowRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Difficulty = "Easy" | "Medium" | "Hard";

const difficultyVariant: Record<string, "easy" | "medium" | "hard"> = {
  Easy: "easy",
  Medium: "medium",
  Hard: "hard",
};

const ProblemsPage = () => {
  const [search, setSearch] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | "All">("All");

  const { data: problems = [], isLoading } = useQuery({
    queryKey: ["problems"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("problems")
        .select("id, title, difficulty, concepts, type, time_estimate")
        .order("id");
      if (error) throw error;
      return data;
    },
  });

  const filtered = problems.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.concepts.some((c: string) => c.toLowerCase().includes(search.toLowerCase()));
    const matchesDifficulty = filterDifficulty === "All" || p.difficulty === filterDifficulty;
    return matchesSearch && matchesDifficulty;
  });

  return (
    <div className="relative min-h-screen pt-24 pb-12">
      <div className="fixed inset-0 grid-pattern opacity-20" />
      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="mb-2 text-3xl font-bold">
            Problem <span className="gradient-text">Explorer</span>
          </h1>
          <p className="text-muted-foreground">
            Choose a challenge that matches your skill level. AI adapts to your progress.
          </p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search problems or concepts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(["All", "Easy", "Medium", "Hard"] as const).map((d) => (
              <Button
                key={d}
                size="sm"
                variant={filterDifficulty === d ? "default" : "outline"}
                onClick={() => setFilterDifficulty(d)}
                className={`text-xs ${filterDifficulty === d ? "gradient-primary text-primary-foreground" : "border-border/50"}`}
              >
                {d}
              </Button>
            ))}
          </div>
        </motion.div>

        {/* Problem list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((problem, i) => (
              <motion.div
                key={problem.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/practice/${problem.id}`} className="block">
                  <div className="glass rounded-xl p-5 transition-all duration-200 hover:border-primary/30 hover:glow-primary group cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-mono text-muted-foreground">#{problem.id}</span>
                          <h3 className="font-semibold group-hover:text-primary transition-colors">
                            {problem.title}
                          </h3>
                          <Badge variant={difficultyVariant[problem.difficulty] || "default"}>
                            {problem.difficulty}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1.5">
                            {problem.concepts.map((c: string) => (
                              <Badge key={c} variant="concept" className="text-[10px]">{c}</Badge>
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {problem.time_estimate}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No problems found matching your search.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProblemsPage;
