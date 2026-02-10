import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, Filter, Clock, Code2, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Difficulty = "Easy" | "Medium" | "Hard";

interface Problem {
  id: number;
  title: string;
  difficulty: Difficulty;
  concepts: string[];
  type: string;
  completionRate: number;
  timeEstimate: string;
}

const problems: Problem[] = [
  { id: 1, title: "Two Sum", difficulty: "Easy", concepts: ["Arrays", "Hash Maps"], type: "Implementation", completionRate: 87, timeEstimate: "15 min" },
  { id: 2, title: "Reverse Linked List", difficulty: "Easy", concepts: ["Linked Lists", "Pointers"], type: "Implementation", completionRate: 78, timeEstimate: "20 min" },
  { id: 3, title: "Valid Parentheses", difficulty: "Easy", concepts: ["Stacks", "Strings"], type: "Implementation", completionRate: 82, timeEstimate: "15 min" },
  { id: 4, title: "Binary Tree Inorder", difficulty: "Medium", concepts: ["Trees", "Recursion"], type: "Traversal", completionRate: 64, timeEstimate: "25 min" },
  { id: 5, title: "Longest Substring", difficulty: "Medium", concepts: ["Sliding Window", "Hash Maps"], type: "Optimization", completionRate: 55, timeEstimate: "30 min" },
  { id: 6, title: "Merge Intervals", difficulty: "Medium", concepts: ["Arrays", "Sorting"], type: "Implementation", completionRate: 60, timeEstimate: "25 min" },
  { id: 7, title: "Word Search", difficulty: "Medium", concepts: ["Backtracking", "Matrices"], type: "Search", completionRate: 48, timeEstimate: "35 min" },
  { id: 8, title: "Trapping Rain Water", difficulty: "Hard", concepts: ["Two Pointers", "Dynamic Programming"], type: "Optimization", completionRate: 32, timeEstimate: "45 min" },
  { id: 9, title: "Serialize Binary Tree", difficulty: "Hard", concepts: ["Trees", "Design"], type: "Design", completionRate: 28, timeEstimate: "40 min" },
  { id: 10, title: "LRU Cache", difficulty: "Hard", concepts: ["Design", "Hash Maps"], type: "Design", completionRate: 35, timeEstimate: "45 min" },
];

const difficultyVariant: Record<Difficulty, "easy" | "medium" | "hard"> = {
  Easy: "easy",
  Medium: "medium",
  Hard: "hard",
};

const ProblemsPage = () => {
  const [search, setSearch] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | "All">("All");

  const filtered = problems.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.concepts.some((c) => c.toLowerCase().includes(search.toLowerCase()));
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
        <div className="space-y-3">
          {filtered.map((problem, i) => (
            <motion.div
              key={problem.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to="/practice" className="block">
                <div className="glass rounded-xl p-5 transition-all duration-200 hover:border-primary/30 hover:glow-primary group cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-mono text-muted-foreground">#{problem.id}</span>
                        <h3 className="font-semibold group-hover:text-primary transition-colors">
                          {problem.title}
                        </h3>
                        <Badge variant={difficultyVariant[problem.difficulty]}>
                          {problem.difficulty}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                          {problem.concepts.map((c) => (
                            <Badge key={c} variant="concept" className="text-[10px]">{c}</Badge>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {problem.timeEstimate}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:block text-right">
                        <div className="text-sm font-semibold">{problem.completionRate}%</div>
                        <div className="text-[10px] text-muted-foreground">completion</div>
                      </div>
                      <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProblemsPage;
