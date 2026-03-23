import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Users, GraduationCap, TrendingUp, Plus, UserPlus, Brain, Search, Zap, CheckCircle2 } from "lucide-react";
import { LearningGraph } from "@/components/LearningGraph";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface StudentData {
    id: string;
    name: string;
    score: number;
    status: string;
    insights?: {
        level: string;
        lacking_areas: string;
        suggestions: string;
    };
}

interface ConceptStat {
    id: string;
    name: string;
    percentage: number;
    mastery_count: number;
    total_students: number;
}

interface SecurityLog {
    id: string;
    event_type: string;
    wpm?: number;
    created_at: string;
    metadata: any;
}

interface FeedItem {
    id: string;
    created_at: string;
    score: number;
    student_id: string;
    problems: {
        title: string;
        concepts: string[];
    };
}

const TeacherDashboard = () => {
    const { toast } = useToast();
    const [studentId, setStudentId] = useState("");
    const [problemIds, setProblemIds] = useState("");
    const [timeLimit, setTimeLimit] = useState("30");
    const [isOpen, setIsOpen] = useState(false);

    const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
    const [newStudentId, setNewStudentId] = useState("");

    const [roster, setRoster] = useState<StudentData[]>([]);
    const [globalCompletion, setGlobalCompletion] = useState(0);
    const [classStats, setClassStats] = useState<ConceptStat[]>([]);
    const [liveFeed, setLiveFeed] = useState<FeedItem[]>([]);
    const [isStatsLoading, setIsStatsLoading] = useState(true);

    const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
    const [studentGraph, setStudentGraph] = useState<any>(null);
    const [isStudentGraphLoading, setIsStudentGraphLoading] = useState(false);
    const [securityLogs, setSecurityLogs] = useState<Record<string, SecurityLog[]>>({});

    const fetchDashboardData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch roster basic info
        const { data: rosterData } = await (supabase as any).from('teacher_students').select('student_id').eq('teacher_id', user.id);
        const studentIds = rosterData?.map((r: any) => r.student_id) || [];

        if (studentIds.length === 0) {
            setRoster([]);
            setGlobalCompletion(0);
            return;
        }

        // Fetch profiles — use LEFT JOIN logic by fetching all then matching
        const { data: profiles } = await (supabase as any).from('profiles').select('user_id, display_name').in('user_id', studentIds);

        // Fetch recent assignments for these students
        const { data: assignments } = await (supabase as any)
            .from('assignments')
            .select('student_id, status')
            .in('student_id', studentIds);

        // Fetch AI Insights for these students
        const { data: insightsData } = await (supabase as any)
            .from('ai_insights')
            .select('*')
            .in('student_id', studentIds)
            .order('updated_at', { ascending: false });

        // Calculate global completion
        const allAssignments = assignments || [];
        const globalCompleted = allAssignments.filter((a: any) => a.status === 'completed').length;
        setGlobalCompletion(allAssignments.length > 0 ? Math.round((globalCompleted / allAssignments.length) * 100) : 0);

        // Map data together — use student ID as fallback if no profile exists
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        const mappedRoster = studentIds.map((sid: string) => {
            const profile = profileMap.get(sid);
            const studentAssignments = allAssignments.filter((a: any) => a.student_id === sid);
            const completed = studentAssignments.filter((a: any) => a.status === 'completed').length;
            const total = studentAssignments.length;
            const score = total > 0 ? Math.round((completed / total) * 100) : 0;

            // Grab the most recent insight for this student
            const studentInsights = (insightsData || []).filter((i: any) => i.student_id === sid);
            const latestInsight = studentInsights.length > 0 ? studentInsights[0] : null;

            return {
                id: sid,
                name: profile?.display_name || `Student ${sid.slice(0, 8)}`,
                score: score,
                status: total > 0 && completed === total ? 'Completed All' : (total > 0 ? `${completed}/${total} Completed` : 'No Assignments'),
                insights: latestInsight ? {
                    level: latestInsight.user_level,
                    lacking_areas: latestInsight.lacking_areas,
                    suggestions: latestInsight.teacher_suggestions
                } : undefined
            };
        });

        setRoster(mappedRoster);

        // 2. Fetch Class Statistics & Live Feed
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const sidString = studentIds.join(",");
            const statsResp = await fetch(`/api/teacher/class_stats?student_ids=${sidString}`, {
                headers: { Authorization: `Bearer ${session?.access_token}` }
            });
            if (statsResp.ok) {
                const data = await statsResp.json();
                setClassStats(data.stats || []);
                setLiveFeed(data.feed || []);
            }
        } catch (e) {
            console.error("Failed to fetch class stats:", e);
        }

        // Fetch security logs for these students
        const { data: logs } = await (supabase as any)
            .from('security_logs')
            .select('*')
            .in('user_id', studentIds)
            .order('created_at', { ascending: false });

        const mappedLogs: Record<string, SecurityLog[]> = {};
        (logs || []).forEach((l: any) => {
            if (!mappedLogs[l.user_id]) mappedLogs[l.user_id] = [];
            mappedLogs[l.user_id].push(l);
        });
        setSecurityLogs(mappedLogs);

        setIsStatsLoading(false);
    };

    useEffect(() => {
        fetchDashboardData();

        const channel = supabase.channel('dashboard_updates')
            .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'assignments' }, () => {
                fetchDashboardData();
            })
            .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'submissions' }, () => {
                fetchDashboardData();
            })
            .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'teacher_students' }, () => {
                fetchDashboardData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleAssign = async () => {
        if (!studentId || !problemIds) {
            toast({ title: "Error", description: "Please enter Student ID and Problem IDs", variant: "destructive" });
            return;
        }

        // Validate student is in roster
        if (!roster.find(s => s.id === studentId)) {
            toast({ title: "Error", description: "This student is not in your roster. Please add them first.", variant: "destructive" });
            return;
        }

        try {
            const pIds = problemIds.split(",").map(id => parseInt(id.trim())).filter(n => !isNaN(n));
            const { error } = await (supabase as any)
                .from("assignments")
                .insert({
                    student_id: studentId,
                    problem_ids: pIds,
                    time_limit_minutes: parseInt(timeLimit),
                    status: "pending",
                    created_at: new Date().toISOString(),
                });

            if (error) throw error;

            toast({ title: "Assignment Sent", description: `Test assigned to student ${studentId.slice(0, 8)}...` });
            setIsOpen(false);
            setStudentId("");
            setProblemIds("");

        } catch (e) {
            console.error("Assignment error:", e);
            toast({ title: "Error", description: `Failed to assign: ${e instanceof Error ? e.message : e}`, variant: "destructive" });
        }
    };

    const handleAddStudent = async () => {
        if (!newStudentId) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            const { error } = await (supabase as any).from('teacher_students').insert({
                teacher_id: user.id,
                student_id: newStudentId
            });
            if (error) throw error;
            toast({ title: "Student Added", description: `Successfully added ${newStudentId.slice(0, 8)} to your roster.` });
            setNewStudentId("");
            setIsAddStudentOpen(false);
            fetchDashboardData();
        } catch (error: any) {
            toast({ title: "Error adding student", description: error.message, variant: "destructive" });
        }
    };

    const fetchStudentGraph = async (sid: string) => {
        setIsStudentGraphLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const resp = await fetch(`/api/teacher/student_graph/${sid}`, {
                headers: { Authorization: `Bearer ${session?.access_token}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                setStudentGraph(data);
            }
        } catch (e) {
            console.error("Failed to fetch student graph:", e);
        }
        setIsStudentGraphLoading(false);
    };

    const openStudentProfile = (student: StudentData) => {
        setSelectedStudent(student);
        fetchStudentGraph(student.id);
    };


    return (
        <div className="min-h-screen pt-20 px-4 md:px-6">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Teacher Dashboard</h1>
                        <p className="text-muted-foreground">Manage your classes and track student progress</p>
                    </div>

                    <div className="flex gap-4">
                        <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <UserPlus className="h-4 w-4" />
                                    Add Student
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Add Student to Roster</DialogTitle>
                                    <DialogDescription>
                                        Enter the unique Student ID to add them to your class.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="new_sid" className="text-right">
                                            Student ID
                                        </Label>
                                        <Input id="new_sid" value={newStudentId} onChange={(e) => setNewStudentId(e.target.value)} className="col-span-3" placeholder="UUID from student dashboard" />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleAddStudent}>Add Student</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <Dialog open={isOpen} onOpenChange={setIsOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Assign Test
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Assign Test to Student</DialogTitle>
                                    <DialogDescription>
                                        Enter the unique Student ID from your roster to assign a specific test module.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="sid" className="text-right">
                                            Student ID
                                        </Label>
                                        <Input id="sid" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="col-span-3" placeholder="UUID from student dashboard" />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="module" className="text-right">
                                            Problems
                                        </Label>
                                        <Input id="module" value={problemIds} onChange={(e) => setProblemIds(e.target.value)} className="col-span-3" placeholder="e.g., 1, 2, 5" />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="time" className="text-right">
                                            Time (min)
                                        </Label>
                                        <Input id="time" type="number" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} className="col-span-3" />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleAssign}>Assign Now</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{roster.length}</div>
                            <p className="text-xs text-muted-foreground">In your current roster</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Assignment Completion</CardTitle>
                            <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{globalCompletion}%</div>
                            <p className="text-xs text-muted-foreground">Average completion rate</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Critical Concepts</CardTitle>
                            <Brain className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {classStats.filter(s => s.percentage < 40).length} Needs Focus
                            </div>
                            <p className="text-xs text-muted-foreground">Concepts below 40% mastery</p>
                        </CardContent>
                    </Card>
                </div>

                {/* New Analytics Row: Heatmap and Live Feed */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-7 lg:col-span-4">
                        <CardHeader>
                            <CardTitle>Class Mastery Heatmap</CardTitle>
                            <CardDescription>Aggregate concept mastery across all students</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {isStatsLoading ? (
                                    <div className="col-span-2 py-10 text-center animate-pulse text-muted-foreground">Loading group analytics...</div>
                                ) : classStats.map((stat) => (
                                    <div key={stat.id} className="p-3 border rounded-lg bg-muted/20">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-semibold">{stat.name}</span>
                                            <span className="text-xs font-mono">{stat.percentage}%</span>
                                        </div>
                                        <Progress 
                                            value={stat.percentage} 
                                            className={`h-2 ${stat.percentage < 40 ? "bg-destructive/20" : ""}`} 
                                        />
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            {stat.mastery_count} / {stat.total_students} students mastered
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="col-span-7 lg:col-span-3">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                Live Submission Feed
                            </CardTitle>
                            <CardDescription>Real-time class activity ticker</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {liveFeed.length === 0 ? (
                                    <div className="text-xs text-center py-10 text-muted-foreground border border-dashed rounded-lg">
                                        Waiting for class activity...
                                    </div>
                                ) : liveFeed.map((item) => (
                                    <div key={item.id} className="flex gap-3 items-start p-2 border-b last:border-0 border-border/50">
                                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${item.score >= 100 ? "bg-success shadow-success" : "bg-warning"}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold truncate">
                                                Student {item.student_id.slice(0, 6)}... solved "{item.problems?.title}"
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded uppercase font-bold text-muted-foreground">
                                                    {item.problems?.concepts?.[0] || "General"}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-xs font-bold text-success">+{item.score}</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-7 lg:col-span-4">
                        <CardHeader>
                            <CardTitle>Student Performance</CardTitle>
                            <CardDescription>Real-time assignment progress</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {roster.length === 0 ? (
                                    <div className="text-sm border py-8 text-center rounded-lg text-muted-foreground">
                                        Your roster is empty. Add a student to get started.
                                    </div>
                                ) : roster.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg hover:border-primary/50 transition-colors group">
                                        <div className="flex w-full flex-col gap-2">
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                                        {s.name[0]?.toUpperCase() || "?"}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold">{s.name}</h3>
                                                        <p className="text-xs text-muted-foreground font-mono">ID: {s.id.slice(0, 8)}...</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <p className="font-bold text-lg">{s.score}% Match</p>
                                                        <p className="text-xs text-muted-foreground">{s.status}</p>
                                                    </div>
                                                    <Button variant="ghost" size="icon" onClick={() => openStudentProfile(s)}>
                                                        <Search className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {s.insights && (
                                                <Accordion type="single" collapsible className="w-full mt-2">
                                                    <AccordionItem value="item-1" className="border-none">
                                                        <AccordionTrigger className="py-2 hover:no-underline text-xs bg-muted/50 rounded-md px-3 text-muted-foreground">
                                                            <div className="flex items-center gap-2">
                                                                <Brain className="h-3 w-3" />
                                                                AI Copilot Assessment: {s.insights.level}
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="pt-3 px-3">
                                                            <div className="space-y-3">
                                                                <div>
                                                                    <p className="text-xs font-semibold text-destructive mb-1">Struggling With</p>
                                                                    <p className="text-xs text-muted-foreground">{s.insights.lacking_areas || "No data yet."}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-semibold text-primary mb-1">Recommendations for Teacher</p>
                                                                    <p className="text-xs text-muted-foreground">{s.insights.suggestions || "No data yet."}</p>
                                                                </div>
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                </Accordion>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="col-span-7 lg:col-span-3">
                        <CardHeader>
                            <CardTitle>Class Overview</CardTitle>
                            <CardDescription>Recent performance by class</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div>
                                        <h3 className="font-semibold">Main Roster</h3>
                                        <p className="text-sm text-muted-foreground">{roster.length} Students</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-lg">{globalCompletion}%</p>
                                        <p className="text-xs text-muted-foreground">Completion</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Student Profile Dialog */}
                <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-2xl flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                    {selectedStudent?.name[0]?.toUpperCase()}
                                </div>
                                {selectedStudent?.name}'s Progress
                            </DialogTitle>
                            <DialogDescription>Detailed mastery graph and AI analysis</DialogDescription>
                        </DialogHeader>
                        
                        <div className="grid gap-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="border-primary/20 bg-muted/5">
                                    <CardHeader className="py-3 px-4 bg-muted/30">
                                        <CardTitle className="text-sm">Knowledge Graph</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0 overflow-hidden">
                                        <div className="transform scale-90 origin-top">
                                            <LearningGraph 
                                                data={studentGraph} 
                                                isLoading={isStudentGraphLoading} 
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-destructive/20 bg-destructive/5">
                                    <CardHeader className="py-3 px-4 bg-destructive/10">
                                        <div className="flex justify-between items-center">
                                            <CardTitle className="text-sm flex items-center gap-2">
                                                <Zap className="h-4 w-4 text-destructive" />
                                                Security Monitor
                                            </CardTitle>
                                            <Badge variant="destructive" className="h-5">{securityLogs[selectedStudent?.id || ""]?.length || 0} Alerts</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
                                        {securityLogs[selectedStudent?.id || ""]?.length > 0 ? (
                                            securityLogs[selectedStudent?.id || ""].map((log, idx) => (
                                                <div key={idx} className="text-xs p-2 bg-background border rounded-md">
                                                    <div className="flex justify-between font-bold mb-1">
                                                        <span className="text-destructive uppercase">{log.event_type.replace('_', ' ')}</span>
                                                        <span className="text-muted-foreground">{new Date(log.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-muted-foreground leading-relaxed">
                                                        {log.event_type === 'PASTE_ATTEMPT' ? 
                                                            `Student attempted to paste into the editor (Attempt #${log.metadata.total_attempts}).` :
                                                            `Inhuman typing speed detected: ${log.wpm} WPM (Peak Burst).`
                                                        }
                                                    </p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground opacity-50">
                                                <CheckCircle2 className="h-8 w-8 mb-2 text-success" />
                                                <p className="text-xs">No integrity alerts detected.</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader className="py-3 px-4">
                                        <CardTitle className="text-xs text-destructive">Struggle Areas</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-sm text-muted-foreground">
                                        {selectedStudent?.insights?.lacking_areas || "No significant struggle areas identified yet."}
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="py-3 px-4">
                                        <CardTitle className="text-xs text-primary">AI Recommendation</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-sm text-muted-foreground">
                                        {selectedStudent?.insights?.suggestions || "Keep encouraging practice in foundational concepts."}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSelectedStudent(null)}>Close</Button>
                            <Button onClick={() => {
                                setStudentId(selectedStudent?.id || "");
                                setSelectedStudent(null);
                                setIsOpen(true);
                            }}>
                                Assign Targeted Task
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default TeacherDashboard;
