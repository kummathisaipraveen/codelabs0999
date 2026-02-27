
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Code2, Trophy, Copy } from "lucide-react";
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

interface Assignment {
    id: string;
    student_id: string;
    problem_ids: number[];
    time_limit_minutes: number;
    status: string;
    created_at: string;
}

const StudentDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [showAlert, setShowAlert] = useState(false);

    useEffect(() => {
        if (!user?.id) {
            console.log("No user ID found");
            return;
        }

        console.log("Fetching assignments for user:", user.id);

        const fetchAssignments = async () => {
            try {
                const res = await fetch(`/api/assignments/${user.id}`);
                console.log("Fetch status:", res.status);
                const data = await res.json();
                console.log("Assignments data:", data);

                if (data && data.length > 0) {
                    setAssignments(data);
                    setShowAlert(true);
                } else {
                    console.log("No assignments found in response");
                }
            } catch (e) {
                console.error("Failed to fetch assignments:", e);
            }
        };

        fetchAssignments();
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
                                Time limit: {assignments[0]?.time_limit_minutes} minutes.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogAction onClick={() => setShowAlert(false)}>Got it</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <div className="grid gap-4 md:grid-cols-3">
                    {assignments.length > 0 && (
                        <Card className="md:col-span-3 border-primary/50 bg-primary/5">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-primary" />
                                    Active Assignments
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {assignments.map((a) => (
                                        <div key={a.id} className="flex items-center justify-between p-3 bg-card rounded border">
                                            <div>
                                                <p className="font-semibold">Problems: {a.problem_ids.join(", ")}</p>
                                                <p className="text-xs text-muted-foreground">{a.time_limit_minutes} min time limit</p>
                                            </div>
                                            <Button size="sm" onClick={() => navigate(`/practice/${a.problem_ids[0]}?assignment=true`)}>
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
                            <div className="text-2xl font-bold">12</div>
                            <p className="text-xs text-muted-foreground">+2 from last week</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
                            <Trophy className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">5 Days</div>
                            <p className="text-xs text-muted-foreground">Keep it up!</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Concepts Mastered</CardTitle>
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">85%</div>
                            <Progress value={85} className="mt-2" />
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4">
                        <CardHeader>
                            <CardTitle>Recent Activity</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center gap-4 border-b pb-4 last:border-0 last:pb-0">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Code2 className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium">Solved "Two Sum"</p>
                                            <p className="text-sm text-muted-foreground">2 hours ago</p>
                                        </div>
                                        <div className="ml-auto font-medium text-green-500">+10 XP</div>
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
