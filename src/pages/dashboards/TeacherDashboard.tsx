import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, TrendingUp, Plus, UserPlus, Brain } from "lucide-react";
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

    const fetchDashboardData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch roster basic info
        const { data: rosterData } = await supabase.from('teacher_students').select('student_id').eq('teacher_id', user.id);
        const studentIds = rosterData?.map((r: any) => r.student_id) || [];

        if (studentIds.length === 0) {
            setRoster([]);
            setGlobalCompletion(0);
            return;
        }

        // Fetch profiles
        const { data: profiles } = await supabase.from('profiles').select('user_id, display_name').in('user_id', studentIds);

        // Fetch recent assignments for these students
        const { data: assignments } = await supabase
            .from('assignments')
            .select('student_id, status')
            .in('student_id', studentIds);

        // Fetch AI Insights for these students
        const { data: insightsData } = await supabase
            .from('ai_insights')
            .select('*')
            .in('student_id', studentIds)
            .order('updated_at', { ascending: false });

        // Calculate global completion
        const allAssignments = assignments || [];
        const globalCompleted = allAssignments.filter((a: any) => a.status === 'completed').length;
        setGlobalCompletion(allAssignments.length > 0 ? Math.round((globalCompleted / allAssignments.length) * 100) : 0);

        // Map data together
        const mappedRoster = (profiles || []).map((p: any) => {
            const studentAssignments = allAssignments.filter((a: any) => a.student_id === p.user_id);
            const completed = studentAssignments.filter((a: any) => a.status === 'completed').length;
            const total = studentAssignments.length;
            const score = total > 0 ? Math.round((completed / total) * 100) : 0;

            // Grab the most recent insight for this student
            const studentInsights = (insightsData || []).filter((i: any) => i.student_id === p.user_id);
            const latestInsight = studentInsights.length > 0 ? studentInsights[0] : null;

            return {
                id: p.user_id,
                name: p.display_name || 'Unknown Student',
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
    };

    useEffect(() => {
        fetchDashboardData();

        const channel = supabase.channel('dashboard_updates')
            .on('postgres', { event: '*', schema: 'public', table: 'assignments' }, () => {
                fetchDashboardData();
            })
            .on('postgres', { event: '*', schema: 'public', table: 'submissions' }, () => {
                fetchDashboardData();
            })
            .on('postgres', { event: '*', schema: 'public', table: 'teacher_students' }, () => {
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
            const { error } = await supabase.from('teacher_students').insert({
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
                            <CardTitle className="text-sm font-medium">Class Performance</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Good</div>
                            <p className="text-xs text-muted-foreground">Based on recent activity</p>
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
                                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
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
                                                <div className="text-right">
                                                    <p className="font-bold text-lg">{s.score}% Match</p>
                                                    <p className="text-xs text-muted-foreground">{s.status}</p>
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
            </div>
        </div>
    );
};

export default TeacherDashboard;
