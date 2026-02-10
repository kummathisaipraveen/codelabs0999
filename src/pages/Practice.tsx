import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, RotateCcw, Send, MessageCircle, ChevronRight, CheckCircle2, XCircle, Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface TestCase {
  input: string;
  expected: string;
}

interface Example {
  input: string;
  output: string;
  explanation?: string;
}

const difficultyVariant: Record<string, "easy" | "medium" | "hard"> = {
  Easy: "easy",
  Medium: "medium",
  Hard: "hard",
};

const PracticePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const problemId = id ? parseInt(id) : 1;

  const { data: problem, isLoading } = useQuery({
    queryKey: ["problem", problemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("problems")
        .select("*")
        .eq("id", problemId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Problem not found");
      return data;
    },
  });

  const [code, setCode] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [hasRun, setHasRun] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResults, setRunResults] = useState<{ input: string; expected: string; passed: boolean }[]>([]);

  // Set code when problem loads
  const currentCode = code || problem?.default_code || "";

  const testCases = (problem?.test_cases as unknown as TestCase[] | null) || [];
  const examples = (problem?.examples as unknown as Example[] | null) || [];

  const handleRun = () => {
    setHasRun(true);
    // Simulate test execution (in a real app this would call a sandboxed execution service)
    const results = testCases.map((tc) => ({
      input: tc.input,
      expected: tc.expected,
      passed: Math.random() > 0.3, // Simulated
    }));
    setRunResults(results);

    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    setOutput(
      `Running tests...\n\n${results
        .map((r, i) => `${r.passed ? "✓" : "✗"} Test ${i + 1}: ${r.input} → ${r.expected}`)
        .join("\n")}\n\n${passed}/${total} tests passed ${passed === total ? "🎉" : ""}`
    );
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to submit solutions.", variant: "destructive" });
      navigate("/auth");
      return;
    }

    if (!hasRun) {
      toast({ title: "Run first", description: "Please run your code before submitting.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const passed = runResults.filter((r) => r.passed).length;
      const total = runResults.length;

      const { error } = await supabase.rpc("submit_solution", {
        p_problem_id: problemId,
        p_code: currentCode,
        p_tests_passed: passed,
        p_tests_total: total,
      });

      if (error) throw error;

      toast({
        title: passed === total ? "All tests passed! 🎉" : "Solution submitted",
        description: `${passed}/${total} tests passed. ${passed === total ? "Points awarded!" : "Keep trying!"}`,
      });
    } catch (error: any) {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="relative min-h-screen pt-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="relative min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Problem not found</h2>
          <Button onClick={() => navigate("/problems")} variant="outline">Back to Problems</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pt-16">
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Problem Panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[380px] flex-shrink-0 border-r border-border/50 overflow-y-auto"
        >
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant={difficultyVariant[problem.difficulty] || "default"}>
                {problem.difficulty}
              </Badge>
              {problem.concepts.map((c: string) => (
                <Badge key={c} variant="concept" className="text-[10px]">{c}</Badge>
              ))}
            </div>
            <h2 className="text-xl font-bold mb-4">{problem.id}. {problem.title}</h2>
            <div className="prose prose-sm prose-invert text-sm text-muted-foreground space-y-3">
              <p>{problem.description}</p>

              {examples.map((ex, i) => (
                <div key={i} className="glass rounded-lg p-4 space-y-2">
                  <div className="text-xs font-semibold text-foreground">Example {i + 1}:</div>
                  <div className="font-mono text-xs space-y-1">
                    <div><span className="text-muted-foreground">Input:</span> {ex.input}</div>
                    <div><span className="text-muted-foreground">Output:</span> <span className="text-success">{ex.output}</span></div>
                    {ex.explanation && <div className="text-muted-foreground">{ex.explanation}</div>}
                  </div>
                </div>
              ))}

              {problem.constraints.length > 0 && (
                <div className="glass rounded-lg p-4 space-y-2">
                  <div className="text-xs font-semibold text-foreground">Constraints:</div>
                  <ul className="font-mono text-xs space-y-1 list-none p-0">
                    {problem.constraints.map((c: string, i: number) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {problem.hint && (
              <div className="mt-6 glass rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-warning mb-2">
                  <Lightbulb className="h-4 w-4" />
                  Hint
                </div>
                <p className="text-xs text-muted-foreground">{problem.hint}</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Editor + Output */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor toolbar */}
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <div className="h-2 w-2 rounded-full bg-success" />
                solution.py
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setCode(problem.default_code); setOutput(null); setHasRun(false); setRunResults([]); }}
                className="gap-1.5 text-xs border-border/50"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleRun}
                className="gap-1.5 text-xs gradient-primary text-primary-foreground glow-primary"
              >
                <Play className="h-3 w-3" />
                Run Code
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="gap-1.5 text-xs bg-success text-success-foreground hover:bg-success/90"
              >
                {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Submit
              </Button>
            </div>
          </div>

          {/* Code editor area */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 relative">
              <Textarea
                value={currentCode}
                onChange={(e) => setCode(e.target.value)}
                className="absolute inset-0 resize-none rounded-none border-0 bg-card font-mono text-sm leading-relaxed p-4 focus-visible:ring-0 focus-visible:ring-offset-0"
                spellCheck={false}
              />
            </div>

            {/* Output console */}
            <div className="h-64 border-t border-border/50">
              <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2">
                <span className="text-xs font-semibold">Output</span>
                {hasRun && (
                  <Badge variant={runResults.every((r) => r.passed) ? "easy" : "medium"} className="text-[10px]">
                    {runResults.filter((r) => r.passed).length}/{runResults.length} Passed
                  </Badge>
                )}
              </div>
              <div className="p-4 overflow-y-auto h-[calc(100%-2.5rem)]">
                {output ? (
                  <pre className="font-mono text-xs text-foreground whitespace-pre-wrap">{output}</pre>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    Click "Run Code" to see output
                  </div>
                )}

                {hasRun && (
                  <div className="mt-4 space-y-2">
                    {runResults.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-mono">
                        {t.passed ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                        )}
                        <div>
                          <span className="text-muted-foreground">{t.input}</span>
                          <span className={t.passed ? "text-success" : "text-destructive"} > → {t.expected}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Chat sidebar */}
        <motion.div
          initial={false}
          animate={{ width: showChat ? 320 : 48 }}
          className="border-l border-border/50 flex-shrink-0 overflow-hidden"
        >
          {showChat ? (
            <div className="flex flex-col h-full w-[320px]">
              <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">AI Assistant</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShowChat(false)} className="h-6 w-6 p-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                <div className="glass rounded-lg p-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 text-primary font-semibold mb-1">
                    <Lightbulb className="h-3 w-3" />
                    Socratic Guide
                  </div>
                  I see you're working on {problem.title}. {problem.hint || "Think carefully about the approach before coding."}
                </div>
              </div>
              <div className="border-t border-border/50 p-3">
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChatInput(e.target.value)}
                    placeholder="Ask for a hint..."
                    className="text-xs bg-card border-border/50"
                  />
                  <Button size="sm" className="gradient-primary text-primary-foreground px-3">
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowChat(true)}
              className="flex flex-col items-center justify-center h-full w-12 hover:bg-secondary/50 transition-colors"
            >
              <MessageCircle className="h-5 w-5 text-primary mb-1" />
              <span className="text-[9px] text-muted-foreground font-mono">Chat</span>
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default PracticePage;
