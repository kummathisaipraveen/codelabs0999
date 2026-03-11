import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, RotateCcw, Send, MessageCircle, ChevronRight, CheckCircle2, XCircle, Lightbulb, Loader2, Bot, User, Zap, Clock, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { AntiCheatMonitor } from "@/components/AntiCheatMonitor";
import { usePythonRunner } from "@/hooks/usePythonRunner";

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
  const [runResults, setRunResults] = useState<{ input: string; expected: string; actual?: string; passed: boolean; error?: string; execution_time_ms?: number }[]>([]);
  const [serverResponse, setServerResponse] = useState<{ tests_passed: number; tests_total: number; score: number; submission_id: string } | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);

  // Pyodide hook kept for future use when CDN is accessible; execution currently uses backend
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { runCode: _runCode } = usePythonRunner();


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

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", description: "Please sign in to chat with the AI.", variant: "destructive" });
        setIsChatLoading(false);
        setChatMessages((prev) => prev.slice(0, -1)); // Remove user message if no session
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          messages: updatedMessages,
          problem_context: problemContext,
          current_code: code,
          problem_id: parseInt(id || "0"),
          student_id: user?.id
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


  // Initialize code from problem default when problem loads — NOT as a computed fallback
  // Unescape literal \n strings stored in the DB into real newlines
  useEffect(() => {
    if (problem?.default_code !== undefined) {
      // DB may store newlines as literal \n string — convert to real newlines
      const cleaned = problem.default_code.replace(/\\n/g, "\n").replace(/\\t/g, "    ");
      setCode(cleaned);
    }
  }, [problem?.id]); // Only re-init when problem ID changes

  // Tab key → insert 4 spaces for Python indentation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const indent = "    "; // 4 spaces
      const newCode = code.substring(0, start) + indent + code.substring(end);
      setCode(newCode);
      // Restore cursor position after the inserted spaces
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + indent.length;
      });
    }
  }, [code]);


  const testCases = (problem?.test_cases as unknown as TestCase[] | null) || [];
  const examples = (problem?.examples as unknown as Example[] | null) || [];

  const handleRun = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to run code.", variant: "destructive" });
      navigate("/auth");
      return;
    }

    setHasRun(true);
    setRunResults([]);
    setAiInsight(null);
    setOutput("Running your code...");

    try {
      // Use backend /api/execute — runs Python via local subprocess (no CDN needed)
      const resp = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language: "python", test_cases: testCases }),
      });

      const data = await resp.json();

      if (!resp.ok || data.status === "error" || data.status === "system_error" || data.status === "timeout") {
        throw new Error(data.error || data.detail || `Execution failed (${data.status})`);
      }

      const results = data.results;
      setRunResults(results);

      const passed = results.filter((r: { passed: boolean }) => r.passed).length;
      const total = results.length;

      setServerResponse({
        tests_passed: passed,
        tests_total: total,
        score: total > 0 ? Math.round((passed / total) * 100) : 0,
        submission_id: "run-" + Date.now(),
      });

      const summary = results
        .map((r: { passed: boolean; input: string; expected: string; actual?: string; execution_time_ms?: number }, i: number) =>
          `${r.passed ? "✓" : "✗"} Test ${i + 1}${r.execution_time_ms !== undefined ? ` (${r.execution_time_ms}ms)` : ""}: ${r.input} → expected ${r.expected}, got ${r.actual ?? "error"}`
        )
        .join("\n");
      setOutput(`${passed}/${total} tests passed\n\n${summary}${data.logs ? "\n\nOutput:\n" + data.logs : ""}`);

      // Async AI insight — appears after results, non-blocking
      if (problem) {
        setIsInsightLoading(true);
        try {
          const firstFail = results.find((r: { passed: boolean }) => !r.passed);
          const insightPrompt = [{
            role: "user", content:
              `Python problem: "${problem.title}" (${problem.difficulty})\n` +
              `User code:\n\`\`\`python\n${code}\n\`\`\`\n` +
              `Test results: ${passed}/${total} passed.\n` +
              (firstFail
                ? `First failure: input=${firstFail.input}, expected=${firstFail.expected}, got=${firstFail.actual}\n`
                : "All tests passed!\n") +
              `Give ONLY: 1 code quality observation (e.g. time complexity), 1 Socratic nudge if not all passed, and skill level: Beginner/Developing/Proficient/Advanced. Max 3 sentences. Be concise.`
          }];
          const chatResp = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: insightPrompt, problem_context: problem.title }),
          });
          if (chatResp.ok) {
            const d = await chatResp.json();
            if (d.content) setAiInsight(d.content);
          }
        } catch {
          // Best-effort — silently ignore
        } finally {
          setIsInsightLoading(false);
        }
      }

    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Execution failed";
      setOutput(`❌ ${errMsg}`);
      toast({ title: "Execution failed", description: errMsg.slice(0, 100), variant: "destructive" });
      if (!isAssignment) {
        const randomMsg = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
        setTimeout(() => toast({ title: "Don't give up!", description: randomMsg }), 1000);
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
                onClick={() => {
                  const cleaned = (problem.default_code || "").replace(/\\n/g, "\n").replace(/\\t/g, "    ");
                  setCode(cleaned);
                  setOutput(null);
                  setHasRun(false);
                  setRunResults([]);
                  setAiInsight(null);
                }}
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
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                className="absolute inset-0 resize-none rounded-none border-0 bg-card font-mono text-sm leading-relaxed p-4 focus-visible:ring-0 focus-visible:ring-offset-0"
                spellCheck={false}
                placeholder="Write your Python solution here..."
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

                {hasRun && runResults.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {runResults.map((t, i) => (
                      <div key={i} className="rounded-lg border border-border/50 bg-card/50 p-2.5 space-y-1">
                        <div className="flex items-center gap-2 text-xs font-mono">
                          {t.passed ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                          )}
                          <span className="text-muted-foreground">Test {i + 1}</span>
                          {t.execution_time_ms !== undefined && (
                            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/60">
                              <Clock className="h-2.5 w-2.5" />{t.execution_time_ms}ms
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-mono pl-5">
                          <span className="text-muted-foreground">in: <span className="text-foreground">{t.input}</span></span>
                          <span className="text-muted-foreground">exp: <span className="text-success">{t.expected}</span></span>
                          <span className="text-muted-foreground">got: <span className={t.passed ? "text-success" : "text-destructive"}>{t.actual ?? "—"}</span></span>
                        </div>
                        {t.error && (
                          <pre className="text-[9px] text-destructive/80 pl-5 whitespace-pre-wrap leading-relaxed">{t.error}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Insight Card — loads asynchronously after results */}
                {(isInsightLoading || aiInsight) && (
                  <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1.5">
                      <Brain className="h-3.5 w-3.5" />
                      <Zap className="h-3 w-3" />
                      AI Code Insight
                    </div>
                    {isInsightLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Analysing your code...
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{aiInsight}</p>
                    )}
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
