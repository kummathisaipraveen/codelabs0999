import { useState } from "react";
import { motion } from "framer-motion";
import { Play, RotateCcw, Send, MessageCircle, ChevronRight, CheckCircle2, XCircle, Clock, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const defaultCode = `def two_sum(nums, target):
    """
    Given an array of integers nums and an integer target,
    return indices of the two numbers that add up to target.
    """
    # Write your solution here
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []`;

const testResults = [
  { input: "nums = [2,7,11,15], target = 9", expected: "[0, 1]", got: "[0, 1]", passed: true },
  { input: "nums = [3,2,4], target = 6", expected: "[1, 2]", got: "[1, 2]", passed: true },
  { input: "nums = [3,3], target = 6", expected: "[0, 1]", got: "[0, 1]", passed: true },
];

const PracticePage = () => {
  const [code, setCode] = useState(defaultCode);
  const [output, setOutput] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [hasRun, setHasRun] = useState(false);

  const handleRun = () => {
    setHasRun(true);
    setOutput("Running tests...\n\n✓ Test 1 passed: two_sum([2,7,11,15], 9) → [0, 1]\n✓ Test 2 passed: two_sum([3,2,4], 6) → [1, 2]\n✓ Test 3 passed: two_sum([3,3], 6) → [0, 1]\n\nAll 3 tests passed! 🎉");
  };

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
              <Badge variant="easy">Easy</Badge>
              <Badge variant="concept" className="text-[10px]">Arrays</Badge>
              <Badge variant="concept" className="text-[10px]">Hash Maps</Badge>
            </div>
            <h2 className="text-xl font-bold mb-4">1. Two Sum</h2>
            <div className="prose prose-sm prose-invert text-sm text-muted-foreground space-y-3">
              <p>
                Given an array of integers <code className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded">nums</code> and
                an integer <code className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded">target</code>, return indices
                of the two numbers such that they add up to target.
              </p>
              <p>
                You may assume that each input would have exactly one solution, and you may not use the same element twice.
              </p>

              <div className="glass rounded-lg p-4 space-y-2">
                <div className="text-xs font-semibold text-foreground">Example 1:</div>
                <div className="font-mono text-xs space-y-1">
                  <div><span className="text-muted-foreground">Input:</span> nums = [2,7,11,15], target = 9</div>
                  <div><span className="text-muted-foreground">Output:</span> <span className="text-success">[0, 1]</span></div>
                  <div className="text-muted-foreground">Because nums[0] + nums[1] == 9</div>
                </div>
              </div>

              <div className="glass rounded-lg p-4 space-y-2">
                <div className="text-xs font-semibold text-foreground">Constraints:</div>
                <ul className="font-mono text-xs space-y-1 list-none p-0">
                  <li>• 2 ≤ nums.length ≤ 10⁴</li>
                  <li>• -10⁹ ≤ nums[i] ≤ 10⁹</li>
                  <li>• Only one valid answer exists</li>
                </ul>
              </div>
            </div>

            {/* Hints */}
            <div className="mt-6 glass rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-warning mb-2">
                <Lightbulb className="h-4 w-4" />
                Hint
              </div>
              <p className="text-xs text-muted-foreground">
                Think about what data structure lets you look up values in O(1) time. Can you store what you've already seen?
              </p>
            </div>
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
                onClick={() => { setCode(defaultCode); setOutput(null); setHasRun(false); }}
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
                className="gap-1.5 text-xs bg-success text-success-foreground hover:bg-success/90"
              >
                <Send className="h-3 w-3" />
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
                className="absolute inset-0 resize-none rounded-none border-0 bg-card font-mono text-sm leading-relaxed p-4 focus-visible:ring-0 focus-visible:ring-offset-0"
                spellCheck={false}
              />
            </div>

            {/* Output console */}
            <div className="h-64 border-t border-border/50">
              <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2">
                <span className="text-xs font-semibold">Output</span>
                {hasRun && (
                  <Badge variant="easy" className="text-[10px]">3/3 Passed</Badge>
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
                    {testResults.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-mono">
                        {t.passed ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                        )}
                        <div>
                          <span className="text-muted-foreground">{t.input}</span>
                          <span className="text-success ml-2">→ {t.got}</span>
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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowChat(false)}
                  className="h-6 w-6 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                <div className="glass rounded-lg p-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 text-primary font-semibold mb-1">
                    <Lightbulb className="h-3 w-3" />
                    Socratic Guide
                  </div>
                  I see you're working on Two Sum. Before looking at solutions — what's the brute force approach, and why might it be slow?
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
