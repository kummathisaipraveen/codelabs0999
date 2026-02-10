import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Brain, Code2, Gamepad2, Sparkles, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Brain,
    title: "Ontology-Driven Learning",
    description: "Adaptive problem selection powered by knowledge graphs that understand your skill gaps.",
  },
  {
    icon: Sparkles,
    title: "AI Assessment Agent",
    description: "Get intelligent feedback that detects conceptual vs syntactic errors in real-time.",
  },
  {
    icon: Gamepad2,
    title: "Gamified Progress",
    description: "Earn badges, maintain streaks, and climb leaderboards as you master concepts.",
  },
  {
    icon: Zap,
    title: "Socratic Chatbot",
    description: "A guided assistant that helps through reflective questioning, not just answers.",
  },
  {
    icon: Code2,
    title: "Sandboxed Execution",
    description: "Write, run, and debug code in a secure, isolated environment with instant feedback.",
  },
  {
    icon: Users,
    title: "Recruiter Insights",
    description: "Competency profiles and behavioral analytics for data-driven hiring decisions.",
  },
];

const stats = [
  { value: "500+", label: "Coding Challenges" },
  { value: "12", label: "Programming Concepts" },
  { value: "50K+", label: "Active Learners" },
  { value: "95%", label: "Mastery Rate" },
];

const LandingPage = () => {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Grid background */}
      <div className="fixed inset-0 grid-pattern opacity-40" />
      
      {/* Gradient orbs */}
      <div className="fixed top-20 left-1/4 h-96 w-96 rounded-full bg-primary/5 blur-[120px] animate-pulse-glow" />
      <div className="fixed bottom-20 right-1/4 h-96 w-96 rounded-full bg-accent/5 blur-[120px] animate-pulse-glow" style={{ animationDelay: "1.5s" }} />

      {/* Hero */}
      <section className="relative pt-32 pb-20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mx-auto max-w-4xl text-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Powered by AI & Knowledge Graphs
            </motion.div>

            <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight md:text-7xl">
              Learn to Code{" "}
              <span className="gradient-text glow-text">Through Discovery</span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground leading-relaxed">
              An intelligent coding platform that adapts to how you think. Master programming
              concepts through guided practice, AI feedback, and gamified challenges.
            </p>

            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link to="/problems">
                <Button size="lg" className="gradient-primary text-primary-foreground font-semibold glow-primary gap-2 px-8 h-12 text-base">
                  Start Practicing
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/leaderboard">
                <Button size="lg" variant="outline" className="gap-2 h-12 text-base border-border/50 hover:bg-secondary">
                  View Leaderboard
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Code preview card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="mx-auto mt-16 max-w-3xl"
          >
            <div className="glass rounded-xl overflow-hidden glow-primary">
              <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-destructive/60" />
                <div className="h-3 w-3 rounded-full bg-warning/60" />
                <div className="h-3 w-3 rounded-full bg-success/60" />
                <span className="ml-2 text-xs text-muted-foreground font-mono">fibonacci.py</span>
              </div>
              <pre className="p-6 text-sm font-mono leading-relaxed overflow-x-auto">
                <code>
                  <span className="text-primary/70">def</span>{" "}
                  <span className="text-accent">fibonacci</span>
                  <span className="text-foreground">(n):</span>{"\n"}
                  <span className="text-muted-foreground">    """Return the nth Fibonacci number."""</span>{"\n"}
                  <span className="text-primary/70">    if</span>
                  <span className="text-foreground"> n {"<="} 1:</span>{"\n"}
                  <span className="text-primary/70">        return</span>
                  <span className="text-foreground"> n</span>{"\n"}
                  <span className="text-primary/70">    return</span>
                  <span className="text-foreground"> fibonacci(n - 1) + fibonacci(n - 2)</span>{"\n"}
                  {"\n"}
                  <span className="text-muted-foreground"># ✓ All test cases passed</span>{"\n"}
                  <span className="text-success">{">>>"} fibonacci(10)  # Output: 55</span>
                </code>
              </pre>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative py-16 border-y border-border/30">
        <div className="container">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl font-bold gradient-text">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative py-24">
        <div className="container">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Built for <span className="gradient-text">Deep Learning</span>
            </h2>
            <p className="mx-auto max-w-lg text-muted-foreground">
              Every feature is designed to help you understand concepts, not just memorize solutions.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group glass rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:glow-primary"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-12 text-center glow-primary"
          >
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Ready to Level Up?
            </h2>
            <p className="mx-auto mb-8 max-w-md text-muted-foreground">
              Join thousands of developers mastering programming through intelligent, adaptive practice.
            </p>
            <Link to="/problems">
              <Button size="lg" className="gradient-primary text-primary-foreground font-semibold glow-primary gap-2 px-8 h-12 text-base">
                Start Your Journey
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
