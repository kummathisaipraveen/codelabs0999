import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, RotateCcw, Send, MessageCircle, ChevronRight, CheckCircle2, XCircle, Lightbulb, Loader2, Bot, User, Zap, Clock, Brain, FileCode, Plus, X, FolderCode } from "lucide-react";
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
  output?: string;
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
  const { runCode: runLocal, isLoading: isPyodideLoading } = usePythonRunner();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get("assignment_id");
  const isAssignment = !!assignmentId || searchParams.get("assignment") === "true";

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
    queryKey: ["problem", problemId, searchParams.get("v")], // added v param to force refetch across navigation
    queryFn: async () => {
      if (problemId === 999) {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/next_task", {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch next task");
        const json = await res.json();
        return json.problem;
      }
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

  const { data: assignment } = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: async () => {
      if (!assignmentId) return null;
      const { data, error } = await (supabase as any)
        .from("assignments")
        .select("*")
        .eq("id", assignmentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!assignmentId,
  });

  const [files, setFiles] = useState<Record<string, string>>({ "main.py": "" });
  const [activeFile, setActiveFile] = useState("main.py");
  const [openFiles, setOpenFiles] = useState<string[]>(["main.py"]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  // Security / Anti-Cheating State
  const keystrokeTimes = useRef<number[]>([]);
  const lastKeyTime = useRef<number>(0);
  const pasteCount = useRef<number>(0);
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
  const [hintLevel, setHintLevel] = useState(0);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [numFailures, setNumFailures] = useState(0);
  const [showStuckIntervention, setShowStuckIntervention] = useState(false);

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
          current_code: JSON.stringify(files),
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
      try {
        const raw = problem.default_code.replace(/\\n/g, "\n").replace(/\\t/g, "    ");
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          setFiles(parsed);
          const firstFile = Object.keys(parsed)[0] || "main.py";
          setActiveFile(firstFile);
          setOpenFiles([firstFile]);
        } else {
          throw new Error("Not a dict");
        }
      } catch (e) {
        const cleaned = problem.default_code.replace(/\\n/g, "\n").replace(/\\t/g, "    ");
        setFiles({ "main.py": cleaned });
        setActiveFile("main.py");
        setOpenFiles(["main.py"]);
      }
    }
    setSelectedOption(null);
    setHasRun(false);
    setRunResults([]);
    setOutput(null);
    setServerResponse(null);
    setHintLevel(0);
    setNumFailures(0);
    setShowStuckIntervention(false);
  }, [problem?.id, problem?.description, problem?.title]); // Reset whenever the problem metadata changes

  // Tab key → insert 4 spaces for Python indentation, Enter key → auto-indent
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const indent = "    "; // 4 spaces
      const currentCode = files[activeFile] || "";
      const newCode = currentCode.substring(0, start) + indent + currentCode.substring(end);
      setFiles({ ...files, [activeFile]: newCode });
      // Restore cursor position after the inserted spaces
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + indent.length;
      });
    } else if (e.key === "Enter") {
      const el = e.currentTarget;
      const start = el.selectionStart;
      const val = el.value;
      const currentCode = files[activeFile] || "";
      
      // Find the start of the current line
      let lineStart = start - 1;
      while (lineStart >= 0 && val[lineStart] !== "\n") {
        lineStart--;
      }
      lineStart++;
      
      const currentLine = val.substring(lineStart, start);
      const match = currentLine.match(/^\s*/);
      let indent = match ? match[0] : "";
      
      // If previous line ends with colon, increase indentation by 4 spaces
      if (currentLine.trim().endsWith(":")) {
        indent += "    ";
      }
      
      if (indent.length > 0) {
        e.preventDefault();
        const end = el.selectionEnd;
        const newCode = currentCode.substring(0, start) + "\n" + indent + currentCode.substring(end);
        setFiles({ ...files, [activeFile]: newCode });
        
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = start + 1 + indent.length;
        });
      }
    }

    // Keystroke Analytics
    const now = Date.now();
    if (lastKeyTime.current > 0) {
      const delta = now - lastKeyTime.current;
      if (delta < 5000) { // Ignore long pauses
        keystrokeTimes.current.push(delta);
      }
    }
    lastKeyTime.current = now;

    // Periodic Security Sync (every 50 keystrokes)
    if (keystrokeTimes.current.length >= 50 && problem?.id) {
      const avgLatency = keystrokeTimes.current.reduce((a, b) => a + b, 0) / keystrokeTimes.current.length;
      // Heuristic: 100ms per char ~ 120 WPM. < 50ms is highly suspicious for sustained typing.
      const wpm = Math.round(60000 / (avgLatency * 5)); // Roughly 5 chars per word
      
      if (wpm > 200) { // Flag inhuman speed
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            fetch("/api/security/log", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
              body: JSON.stringify({
                problem_id: problem.id,
                event_type: "SPEED_BURST",
                wpm: wpm,
                metadata: { avg_latency: avgLatency, sample_count: keystrokeTimes.current.length }
              })
            });
          }
        });
      }
      keystrokeTimes.current = []; // Reset batch
    }
  }, [files, activeFile, problem?.id]);

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    pasteCount.current += 1;
    toast({
      title: "Action Blocked",
      description: "Copy-paste is disabled to encourage active learning! Please type your solution.",
      variant: "destructive"
    });
    
    if (problem?.id) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          fetch("/api/security/log", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
            body: JSON.stringify({
              problem_id: problem.id,
              event_type: "PASTE_ATTEMPT",
              metadata: { total_attempts: pasteCount.current }
            })
          });
        }
      });
    }
  };


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
      // Use local Pyodide runner for production-grade, zero-latency execution
      // This works on Vercel where Docker-based backend execution is restricted.
      const result = await runLocal(Object.values(files).join("\n\n"), testCases);
      
      if (result.status === "error") {
        throw new Error(result.error || "Execution failed");
      }

      const results = result.results;
      setRunResults(results);

      const passed = results.filter((r: { passed: boolean }) => r.passed).length;
      const total = results.length;

      setServerResponse({
        tests_passed: passed,
        tests_total: total,
        score: total > 0 ? Math.round((passed / total) * 100) : 0,
        submission_id: "run-" + Date.now(),
      });

      if (passed < total) {
          const newFailCount = numFailures + 1;
          setNumFailures(newFailCount);
          if (newFailCount >= 3) {
              setShowStuckIntervention(true);
          }
      } else {
          setNumFailures(0);
          setShowStuckIntervention(false);
      }

      const summary = results
        .map((r: { passed: boolean; input: string; expected: string; actual?: string; execution_time_ms?: number }, i: number) =>
          `${r.passed ? "✓" : "✗"} Test ${i + 1}${r.execution_time_ms !== undefined ? ` (${r.execution_time_ms}ms)` : ""}: ${r.input} → expected ${r.expected}, got ${r.actual ?? "error"}`
        )
        .join("\n");
      setOutput(`${passed}/${total} tests passed\n\n${summary}${result.stdout ? "\n\nOutput:\n" + result.stdout : ""}`);

      // Async AI insight — appears after results, non-blocking
      if (problem) {
        setIsInsightLoading(true);
        try {
          const firstFail = results.find((r: { passed: boolean }) => !r.passed);
          const insightPrompt = [{
            role: "user", content:
              `Python problem: "${problem.title}" (${problem.difficulty})\n` +
               `User project files:\n\`\`\`json\n${JSON.stringify(files, null, 2)}\n\`\`\`\n` +
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

  const handleGetHint = async () => {
    if (!user || isHintLoading) return;
    
    const nextLevel = hintLevel + 1;
    if (nextLevel > 3) {
      toast({ title: "Max hints reached", description: "You've used all the hints! Try breaking the problem down into smaller steps." });
      return;
    }

    setIsHintLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const firstFail = runResults.find(r => !r.passed);
      
      const resp = await fetch("/api/hint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          level: nextLevel,
          problem_context: problem?.title || "",
          current_code: JSON.stringify(files),
          problem_id: problem?.id,
          test_results: firstFail ? `Input: ${firstFail.input}, Expected: ${firstFail.expected}, Got: ${firstFail.actual}` : "None"
        })
      });

      if (!resp.ok) throw new Error("Hint service unavailable");
      
      const data = await resp.json();
      setHintLevel(nextLevel);
      
      // Add hint to chat
      const assistantMsg: ChatMsg = { 
        role: "assistant", 
        content: `💡 **Hint Level ${nextLevel}:**\n${data.hint}` 
      };
      setChatMessages(prev => [...prev, assistantMsg]);
      setShowChat(true);
      
    } catch (e) {
      toast({ title: "Hint error", description: "Could not fetch hint. Use the chat for help!", variant: "destructive" });
    } finally {
      setIsHintLoading(false);
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

    const passed = serverResponse.tests_passed;
    const total = serverResponse.tests_total;

    setIsSubmitting(true);
    try {
      const score = total > 0 ? Math.round((passed / total) * 100) : 0;
      
      const { error: subError } = await supabase.from("submissions").insert({
        user_id: user.id,
        problem_id: problem.id,
        code: JSON.stringify(files),
        score: score,
        tests_passed: passed,
        tests_total: total,
      });

      if (subError) throw subError;

      const { data: currentPoints } = await supabase
        .from("user_points")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      const newPoints = (currentPoints?.total_points || 0) + score;
      const newSolved = passed === total ? (currentPoints?.problems_solved || 0) + 1 : (currentPoints?.problems_solved || 0);

      const { error: pointsError } = await supabase
        .from("user_points")
        .upsert({
          user_id: user.id,
          total_points: newPoints,
          problems_solved: newSolved,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (pointsError) throw pointsError;

      // New Gamification API Call
      try {
        const { data: { session } } = await supabase.auth.getSession();
        fetch("/api/award_points", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            student_id: user.id,
            problem_id: problem.id,
            score: score
          })
        });
      } catch (e) { console.error("Gamification error: ", e); }

      // If this was an assignment and all tests passed, mark it as completed
      if (assignmentId && passed === total) {
        const { error: assignmentError } = await (supabase as any)
          .from("assignments")
          .update({ status: "completed" })
          .eq("id", assignmentId);

        if (assignmentError) throw assignmentError;
      }

      toast({
        title: passed === total ? "All tests passed! 🎉" : "Solution submitted",
        description: `${passed}/${total} tests passed. ${passed === total ? `Awarded ${score} points!` : "Keep trying!"}`,
      });
    } catch (e: any) {
      toast({
        title: "Submission failed",
        description: e.message || "Could not save your progress.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleNextTask = async () => {
    // If it's an assignment, navigate to the next problem in the assignment
    if (assignmentId && assignment) {
      const currentIdx = assignment.problem_ids?.indexOf(problemId);
      if (currentIdx !== -1 && currentIdx < assignment.problem_ids.length - 1) {
        const nextId = assignment.problem_ids[currentIdx + 1];
        navigate(`/practice/${nextId}?assignment_id=${assignmentId}&v=${Date.now()}`);
        return;
      } else {
        toast({ title: "Assignment complete!", description: "You've finished all problems in this assignment." });
        navigate("/student-dashboard");
        return;
      }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const resp = await fetch("/api/next_task", {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      const data = await resp.json();
      if (data.status === "success" && data.next_id) {
        navigate(`/practice/${data.next_id}?v=${Date.now()}`);
      } else {
        // Fallback: reload current or go to first problem
        navigate("/practice/1?v=" + Date.now());
      }
    } catch (e) {
      console.error("Next task error", e);
      navigate("/problems");
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
                <FileCode className="h-3 w-3" />
                {activeFile}
              </div>
            </div>
            {/* Tabs */}
            <div className="flex-1 flex overflow-x-auto no-scrollbar">
              {openFiles.map(filename => (
                <div 
                  key={filename}
                  onClick={() => setActiveFile(filename)}
                  className={`flex items-center gap-2 px-3 py-1 cursor-pointer border-r border-border/50 text-[10px] whitespace-nowrap transition-colors ${activeFile === filename ? 'bg-card text-foreground border-b-2 border-b-primary' : 'bg-background text-muted-foreground hover:bg-secondary/30'}`}
                >
                  <FileCode className="h-3 w-3" />
                  {filename}
                  <X 
                    className="h-2.5 w-2.5 hover:text-destructive" 
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = openFiles.filter(f => f !== filename);
                      if (next.length > 0) {
                        setOpenFiles(next);
                        if (activeFile === filename) setActiveFile(next[0]);
                      }
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  try {
                    const raw = (problem.default_code || "").replace(/\\n/g, "\n").replace(/\\t/g, "    ");
                    const parsed = JSON.parse(raw);
                    setFiles(parsed);
                    setActiveFile(Object.keys(parsed)[0] || "main.py");
                  } catch (e) {
                    const cleaned = (problem.default_code || "").replace(/\\n/g, "\n").replace(/\\t/g, "    ");
                    setFiles({ "main.py": cleaned });
                    setActiveFile("main.py");
                  }
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
                variant="outline"
                onClick={handleGetHint}
                disabled={isHintLoading || !problem}
                className={`gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5 ${hintLevel > 0 ? 'bg-primary/10' : ''}`}
              >
                {isHintLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lightbulb className="h-3 w-3" />}
                {hintLevel === 0 ? "Need a Hint?" : `Hint ${hintLevel}/3`}
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
                {serverResponse?.tests_passed === serverResponse?.tests_total && serverResponse?.tests_total > 0 && (
                  <Button
                    size="sm"
                    onClick={handleNextTask}
                    className="gap-1.5 text-xs gradient-primary text-primary-foreground ml-2 glow-primary"
                  >
                    Next Task <ChevronRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
          </div>

          {/* Code editor area */}
          <div className="flex-1 flex flex-col">
            {problem.task_type === "Code Comprehension" ? (
              <div className="flex-1 p-8 overflow-y-auto bg-card">
                 <h3 className="text-lg font-bold mb-4">Choose the correct answer:</h3>
                 <div className="space-y-3">
                    {problem.options?.map((opt: string) => (
                        <div key={opt} 
                          onClick={() => setSelectedOption(opt)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedOption === opt ? 'border-primary bg-primary/10' : 'border-border/50 hover:bg-secondary/50'}`}
                        >
                            <span className="font-mono text-sm">{opt}</span>
                        </div>
                    ))}
                 </div>
                 <Button 
                    className="mt-6 w-full gradient-primary text-primary-foreground"
                    disabled={!selectedOption}
                    onClick={() => {
                        const passed = selectedOption === problem.answer;
                        setHasRun(true);
                        setRunResults([{ input: 'MCQ', expected: problem.answer, actual: selectedOption || 'None', passed }]);
                        setServerResponse({ tests_passed: passed ? 1 : 0, tests_total: 1, score: passed ? 100 : 0, submission_id: 'mcq' });
                        setOutput(passed ? "✅ Correct answer! Click Submit to save points." : "❌ Incorrect. Try again.");
                    }}
                 >
                    Verify Answer
                 </Button>
                 <div className="mt-8 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                    <div className="text-xs text-primary font-bold mb-1">Why are you seeing this?</div>
                    <p className="text-xs text-muted-foreground">The Engine detected frustration or struggle in your logs and dynamically adjusted the difficulty to a Comprehension Task!</p>
                 </div>
              </div>
            ) : (
              <div className="flex-1 relative">
                {problem.task_type === "Debugging" && (
                  <div className="absolute top-0 right-0 m-4 z-10 px-3 py-1.5 text-xs font-bold bg-warning/20 text-warning border border-warning/30 rounded-md">
                    🐛 BUG SWARM! Fix the pre-filled code to pass.
                  </div>
                )}
                <div className="absolute inset-0 flex">
                  {/* File Explorer Sidebar */}
                  <div className="w-48 bg-muted/30 border-r border-border/50 flex flex-col">
                    <div className="p-3 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Explorer</span>
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => {
                        const name = prompt("Filename?");
                        if (name) {
                          setFiles({ ...files, [name]: "" });
                          if (!openFiles.includes(name)) setOpenFiles([...openFiles, name]);
                          setActiveFile(name);
                        }
                      }}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {Object.keys(files).map(filename => (
                        <div 
                          key={filename}
                          onClick={() => {
                            setActiveFile(filename);
                            if (!openFiles.includes(filename)) setOpenFiles([...openFiles, filename]);
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-secondary/50 transition-colors ${activeFile === filename ? 'text-primary bg-primary/5' : 'text-muted-foreground'}`}
                        >
                          <FileCode className="h-3.5 w-3.5" />
                          {filename}
                        </div>
                      ))}
                    </div>
                    <div className="p-2 border-t border-border/50">
                      <div className="flex items-center gap-2 p-2 bg-success/5 rounded border border-success/20 text-[10px] text-success font-medium">
                        <FolderCode className="h-3 w-3" /> Virtual Workspace
                      </div>
                    </div>
                  </div>

                  {/* Mono Editor */}
                  <div className="flex-1 relative bg-card">
                    <Textarea
                      value={files[activeFile] || ""}
                      onChange={(e) => setFiles({ ...files, [activeFile]: e.target.value })}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      className="absolute inset-0 resize-none rounded-none border-0 bg-transparent font-mono text-sm leading-relaxed p-4 focus-visible:ring-0 focus-visible:ring-offset-0"
                      spellCheck={false}
                      placeholder="Select a file to edit..."
                    />
                  </div>
                </div>
              </div>
            )}

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

                {showStuckIntervention && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 rounded-lg border border-warning/50 bg-warning/5 p-4"
                  >
                    <div className="flex items-center gap-2 text-sm font-bold text-warning mb-2">
                        <Zap className="h-4 w-4" />
                        You've got this!
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                        I noticed this problem is proving a bit tricky. Don't worry — everyone gets stuck! Would you like a nudge from our AI coach?
                    </p>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-8 text-xs border-warning/30 text-warning" onClick={handleGetHint}>
                            Get Hint
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowStuckIntervention(false)}>
                            Dismiss
                        </Button>
                    </div>
                  </motion.div>
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
