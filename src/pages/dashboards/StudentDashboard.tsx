import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Code2, Trophy, Copy, Lock, Unlock, CheckCircle } from "lucide-react";
import { LearningGraph } from "@/components/LearningGraph";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Assignment {
    id: string;
    student_id: string;
    problem_ids: number[];
    time_limit_minutes: number;
    status: string;
    created_at: string;
}

interface UserPoints {
    problems_solved: number;
    current_streak: number;
    total_points: number;
}

interface ActivityItem {
    id: string;
    problem_title: string;
    created_at: string;
    score: number;
}

interface GraphData {
    mastered: string[];
    available: string[];
    locked: string[];
    graph_structure: {
        nodes: any[];
        links: any[];
    };
}

const StudentDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();

    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [showAlert, setShowAlert] = useState(false);
    const [points, setPoints] = useState<UserPoints>({ problems_solved: 0, current_streak: 0, total_points: 0 });
    const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
    const [graphData, setGraphData] = useState<GraphData | null>(null);
    const [isGraphLoading, setIsGraphLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;

        const fetchDashboardData = async () => {
            try {
                // Fetch Active Assignments
                const { data: assignmentsData, error: assignmentsError } = await (supabase as any)
                    .from("assignments")
                    .select("*")
                    .eq("student_id", user.id)
                    .eq("status", "pending");

                if (!assignmentsError && assignmentsData && assignmentsData.length > 0) {
                    setAssignments(assignmentsData);
                    // Only show alert if it's new (simple heuristic: first load)
                    if (assignments.length === 0) setShowAlert(true);
                } else {
                    setAssignments([]);
                }

                // Fetch User Points
                const { data: pointsData } = await (supabase as any)
                    .from("user_points")
                    .select("*")
                    .eq("user_id", user.id)
                    .single();

                if (pointsData) {
                    setPoints({
                        problems_solved: pointsData.problems_solved || 0,
                        current_streak: pointsData.current_streak || 0,
                        total_points: pointsData.total_points || 0
                    });
                }

                // Fetch Recent Submissions
                const { data: submissionsData } = await (supabase as any)
                    .from("submissions")
                    .select("id, created_at, score, problems(title)")
                    .eq("user_id", user.id)
                    .order("created_at", { ascending: false })
                    .limit(5);

                if (submissionsData) {
                    setRecentActivity(submissionsData.map((s: any) => ({
                        id: s.id,
                        problem_title: s.problems?.title || "Code Challenge",
                        created_at: new Date(s.created_at).toLocaleString(),
                        score: s.score || 0
                    })));
                }

                // Fetch Learning Graph
                const { data: { session } } = await supabase.auth.getSession();
                const graphResp = await fetch("/api/graph", {
                    headers: { Authorization: `Bearer ${session?.access_token}` }
                });
                if (graphResp.ok) {
                    const gData = await graphResp.json();
                    setGraphData(gData);
                }
                setIsGraphLoading(false);

            } catch (e) {
                console.error("Failed to fetch dashboard data:", e);
                setIsGraphLoading(false);
            }
        };

        fetchDashboardData();

        // Setup Realtime Listeners
        const channel = supabase.channel('student_updates')
            .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'assignments', filter: `student_id=eq.${user.id}` }, () => fetchDashboardData())
            .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'submissions', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData())
            .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'user_points', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData())
            .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'user_mastery', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);


    const copyId = () => {
        if (user?.id) {
            navigator.clipboard.writeText(user.id);
            toast({ title: "ID Copied", description: "Student ID copied to clipboard." });
        }
    };

    return (
        <div className="min-h-screen pt-20 px-4 md:px-6">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Student Dashboard</h1>
                        <p className="text-muted-foreground">Continue your learning journey</p>
                        {user && (
                            <div className="flex items-center gap-2 mt-2">
                                <code className="bg-muted px-2 py-1 rounded text-xs">{user.id}</code>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyId}>
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>
                    <Button onClick={() => navigate("/problems")} className="gap-2">
                        <Code2 className="h-4 w-4" />
                        Practice Problems
                    </Button>
                </div>

                <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>New Assignment Received!</AlertDialogTitle>
                            <AlertDialogDescription>
                                Your teacher has assigned you {assignments.length} new problem set(s).
                                Time limit: {assignments[0]?.time_limit_minutes || 30} minutes.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogAction onClick={() => setShowAlert(false)}>Got it</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <div className="grid gap-4 md:grid-cols-4">
                    {assignments.length > 0 && (
                        <Card className="md:col-span-4 border-primary/50 bg-primary/5">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-primary" />
                                    Active Assignments
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {assignments.map((a) => (
                                        <div key={a.id} className="flex items-center justify-between p-3 bg-background rounded border">
                                            <div>
                                                <p className="font-semibold">Problems: {a.problem_ids.join(", ")}</p>
                                                <p className="text-xs text-muted-foreground">{a.time_limit_minutes} min time limit</p>
                                            </div>
                                            <Button size="sm" onClick={() => navigate(`/practice/${a.problem_ids[0]}?assignment_id=${a.id}`)}>
                                                Start Now
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Problems Solved</CardTitle>
                            <Code2 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{points.problems_solved}</div>
                            <p className="text-xs text-muted-foreground">Keep at it!</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Points</CardTitle>
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{points.total_points}</div>
                            <p className="text-xs text-muted-foreground">XP Earned</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Mastery Progress</CardTitle>
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {graphData ? `${graphData.mastered.length} / ${graphData.graph_structure.nodes.length}` : "0 / 0"}
                            </div>
                            <Progress 
                                value={graphData ? (graphData.mastered.length / graphData.graph_structure.nodes.length) * 100 : 0} 
                                className="mt-2" 
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* Learning Path Section */}
                <Card className="border-primary/20 bg-card/50 backdrop-blur-sm shadow-xl overflow-hidden">
                    <CardHeader className="border-b border-border/50 bg-muted/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Trophy className="h-5 w-5 text-warning" />
                                    Your Learning Path
                                </CardTitle>
                                <CardDescription>Unlock new concepts by mastering prerequisites</CardDescription>
                            </div>
                            <div className="flex gap-4 text-xs">
                                <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-success" /> Mastered</span>
                                <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-primary" /> Available</span>
                                <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-muted-foreground" /> Locked</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        <LearningGraph 
                            data={graphData} 
                            isLoading={isGraphLoading} 
                            onNodeClick={(id) => graphData?.available.includes(id) && navigate("/problems")}
                        />
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4">
                        <CardHeader>
                            <CardTitle>Recent Activity</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {recentActivity.length === 0 ? (
                                    <div className="text-sm text-center py-6 text-muted-foreground border rounded-lg">
                                        No recent practice activity yet. Go solve a problem!
                                    </div>
                                ) : recentActivity.map((activity) => (
                                    <div key={activity.id} className="flex items-center gap-4 border-b pb-4 last:border-0 last:pb-0">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Code2 className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium">Solved "{activity.problem_title}"</p>
                                            <p className="text-sm text-muted-foreground">{activity.created_at}</p>
                                        </div>
                                        <div className="ml-auto font-medium text-green-500">+{activity.score} XP</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="col-span-3">
                        <CardHeader>
                            <CardTitle>Recommended for You</CardTitle>
                            <CardDescription>Based on your recent performance</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate("/practice/3")}>
                                    <h3 className="font-semibold">Binary Search Trees</h3>
                                    <p className="text-sm text-muted-foreground">Hard • Data Structures</p>
                                </div>
                                <div className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate("/practice/4")}>
                                    <h3 className="font-semibold">Dynamic Programming</h3>
                                    <p className="text-sm text-muted-foreground">Medium • Algorithms</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;
