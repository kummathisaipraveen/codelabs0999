import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, RotateCcw, Send, MessageCircle, ChevronRight, CheckCircle2, XCircle, Lightbulb, Loader2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { AntiCheatMonitor } from "@/components/AntiCheatMonitor";

type ChatMsg = { role: "user" | "assistant"; content: string };

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
  const [searchParams] = useSearchParams();
  const isAssignment = searchParams.get("assignment") === "true";

  const motivationalMessages = [
    "You're doing great! Keep it up! 🚀",
    "Every line of code brings you closer to mastery. 💻",
    "Don't give up! The breakthrough is just around the corner. ✨",
    "Coding is a superpower. You're leveling up! 🦸‍♂️",
    "Small steps lead to big results. Stay focused! 🎯",
    "You've got this! One problem at a time. 💪",
    "Complexity is just a challenge waiting to be solved. 🧠",
    "Even the best developers started with 'Hello World'. 🌎",
    "Your logic is getting sharper with every test case. 🗡️",
    "Consistency is the key to becoming a coding wizard. 🧙‍♂️",
    "Mistakes are the best teachers. Embrace the bugs! 🐛",
    "You're building something amazing, one function at a time. 🏗️",
    "Progress, not perfection. Keep pushing! 📈",
    "Your future self will thank you for this effort. 🤝"
  ];

  useEffect(() => {
    if (isAssignment) return;

    // Show an immediate message on mount to confirm changes are reflecting
    const initialMsg = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
    toast({
      title: "Welcome to Practice!",
      description: initialMsg,
    });

    const interval = setInterval(() => {
      const randomMsg = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
      toast({
        title: "Keep Going!",
        description: randomMsg,
      });
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [isAssignment, toast]);
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
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [hasRun, setHasRun] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResults, setRunResults] = useState<{ input: string; expected: string; passed: boolean }[]>([]);
  const [serverResponse, setServerResponse] = useState<{ tests_passed: number; tests_total: number; score: number; submission_id: string } | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg: ChatMsg = { role: "user", content: chatInput.trim() };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput("");
    setIsChatLoading(true);

    let assistantContent = "";

    try {
      const problemContext = problem
        ? `Title: ${problem.title}\nDifficulty: ${problem.difficulty}\nConcepts: ${problem.concepts.join(", ")}\nDescription: ${problem.description}\nHint: ${problem.hint || "None"}`
        : "";

      const CHAT_URL = "/api/chat";

      // ... auth checks ...

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Authorization headers...
        },
        body: JSON.stringify({
          messages: updatedMessages,
          problem_context: problemContext, // Note key change problemContext -> problem_context to match Python model
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "AI service error" }));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      const data = await resp.json();
      if (data.role === "assistant" && data.content) {
        assistantContent = data.content;
        setChatMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "AI service error";
      toast({ title: "Chat error", description: errMsg, variant: "destructive" });
      // Remove user message if no response came
      if (!assistantContent) {
        setChatMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setIsChatLoading(false);
    }
  }, [chatInput, chatMessages, isChatLoading, problem, toast]);

  // Set code when problem loads
  const currentCode = code || problem?.default_code || "";

  const testCases = (problem?.test_cases as unknown as TestCase[] | null) || [];
  const examples = (problem?.examples as unknown as Example[] | null) || [];

  const handleRun = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to run code.", variant: "destructive" });
      navigate("/auth");
      return;
    }

    setHasRun(true);
    setOutput("Running tests on server...");
    setRunResults([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Please sign in to run code.");
      }

      // python backend
      const resp = await fetch("/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Authorization: session?.access_token ... (Backend verify skipped for demo)
        },
        body: JSON.stringify({
          code: currentCode,
          language: "python",
          test_cases: testCases
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || data.detail || `Server error ${resp.status}`);
      }

      // Backend returns { status: "success", results: [...], logs: "..." }
      if (data.status === "error" || data.status === "system_error" || data.status === "timeout") {
        throw new Error(data.error || "Execution failed");
      }

      const results = data.results.map((r: { input: string; expected: string; actual: string; passed: boolean }) => ({
        input: r.input,
        expected: r.expected,
        actual: r.actual,
        passed: r.passed
      }));

      setRunResults(results);

      const passed = results.filter((r: { passed: boolean }) => r.passed).length;
      const total = results.length;

      // Mocking the serverResponse structure expected by handleSubmit
      setServerResponse({
        tests_passed: passed,
        tests_total: total,
        score: (passed / total) * 100, // Simplistic scoring
        submission_id: "local-sub-" + Date.now()
      });

      setOutput(
        `Server-verified results:\n\n${results
          .map((r: { passed: boolean; input: string; expected: string; actual: string }, i: number) => `${r.passed ? "✓" : "✗"} Test ${i + 1}: ${r.input} → expected ${r.expected}, got ${r.actual}`)
          .join("\n")}\n\n${passed}/${total} tests passed ${passed === total ? "🎉" : ""}`
      );

    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Execution failed";
      setOutput(`Error: ${errMsg}`);
      toast({ title: "Execution failed", description: errMsg, variant: "destructive" });

      if (!isAssignment) {
        const randomMsg = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
        setTimeout(() => {
          toast({
            title: "Don't give up!",
            description: randomMsg,
          });
        }, 1000);
      }
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to submit solutions.", variant: "destructive" });
      navigate("/auth");
      return;
    }

    if (!hasRun || !serverResponse) {
      toast({ title: "Run first", description: "Please run your code before submitting.", variant: "destructive" });
      return;
    }

    // Results are already submitted server-side during execution
    const passed = serverResponse.tests_passed;
    const total = serverResponse.tests_total;

    toast({
      title: passed === total ? "All tests passed! 🎉" : "Solution submitted",
      description: `${passed}/${total} tests passed. ${passed === total ? "Points awarded!" : "Keep trying!"}`,
    });
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



  // ... inside PracticePage component ...

  return (
    <div className="relative min-h-screen pt-16">
      <AntiCheatMonitor onViolation={(type) => console.log("Violation:", type)} />
      <div className="flex h-[calc(100vh-4rem)]">
        {/* ... rest of the JSX ... */}

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
          animate={{ width: showChat ? 360 : 48 }}
          className="border-l border-border/50 flex-shrink-0 overflow-hidden"
        >
          {showChat ? (
            <div className="flex flex-col h-full w-[360px]">
              <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Socratic Guide</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShowChat(false)} className="h-6 w-6 p-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {/* Welcome message */}
                <div className="flex gap-2">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full gradient-primary flex items-center justify-center">
                    <Bot className="h-3 w-3 text-primary-foreground" />
                  </div>
                  <div className="glass rounded-lg rounded-tl-none p-3 text-xs text-muted-foreground max-w-[280px]">
                    <div className="flex items-center gap-1.5 text-primary font-semibold mb-1">
                      <Lightbulb className="h-3 w-3" />
                      Socratic Guide
                    </div>
                    I see you're working on <strong className="text-foreground">{problem.title}</strong>. Ask me anything — I'll guide you through questions, not answers!
                  </div>
                </div>

                {/* Chat messages */}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center ${msg.role === "user" ? "bg-secondary" : "gradient-primary"}`}>
                      {msg.role === "user" ? (
                        <User className="h-3 w-3 text-foreground" />
                      ) : (
                        <Bot className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className={`rounded-lg p-3 text-xs max-w-[280px] whitespace-pre-wrap ${msg.role === "user"
                      ? "bg-primary/10 text-foreground rounded-tr-none"
                      : "glass text-muted-foreground rounded-tl-none"
                      }`}>
                      {msg.content}
                      {msg.role === "assistant" && isChatLoading && i === chatMessages.length - 1 && (
                        <span className="inline-block w-1.5 h-3 bg-primary/50 animate-pulse ml-0.5" />
                      )}
                    </div>
                  </div>
                ))}

                {isChatLoading && chatMessages[chatMessages.length - 1]?.role !== "assistant" && (
                  <div className="flex gap-2">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full gradient-primary flex items-center justify-center">
                      <Bot className="h-3 w-3 text-primary-foreground" />
                    </div>
                    <div className="glass rounded-lg rounded-tl-none p-3">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="border-t border-border/50 p-3">
                <form
                  onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }}
                  className="flex gap-2"
                >
                  <Input
                    value={chatInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChatInput(e.target.value)}
                    placeholder="Ask for a hint..."
                    className="text-xs bg-card border-border/50"
                    disabled={isChatLoading}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isChatLoading || !chatInput.trim()}
                    className="gradient-primary text-primary-foreground px-3"
                  >
                    {isChatLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  </Button>
                </form>
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
