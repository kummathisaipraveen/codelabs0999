
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, TrendingUp, Plus } from "lucide-react";
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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const TeacherDashboard = () => {
    const { toast } = useToast();
    const [studentId, setStudentId] = useState("");
    const [problemIds, setProblemIds] = useState("");
    const [timeLimit, setTimeLimit] = useState("30");
    const [isOpen, setIsOpen] = useState(false);

    const handleAssign = async () => {
        if (!studentId || !problemIds) {
            toast({ title: "Error", description: "Please enter Student ID and Problem IDs", variant: "destructive" });
            return;
        }

        try {
            const pIds = problemIds.split(",").map(id => parseInt(id.trim())).filter(n => !isNaN(n));
            console.log("Sending assignment:", { student_id: studentId, problem_ids: pIds, time_limit_minutes: parseInt(timeLimit) });

            const resp = await fetch("/api/assignments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    student_id: studentId,
                    problem_ids: pIds,
                    time_limit_minutes: parseInt(timeLimit)
                })
            });

            console.log("Response status:", resp.status);

            if (resp.ok) {
                toast({ title: "Assignment Sent", description: `Test assigned to student ${studentId.slice(0, 8)}...` });
                setIsOpen(false);
                setStudentId("");
                setProblemIds("");
            } else {
                const errorText = await resp.text();
                console.error("Backend error:", errorText);
                toast({ title: "Error", description: `Failed: ${resp.status} - ${errorText.substring(0, 50)}`, variant: "destructive" });
            }

        } catch (e) {
            console.error("Network/Fetch error:", e);
            toast({ title: "Error", description: `Network Error: ${e}`, variant: "destructive" });
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
                                    Enter the unique Student ID to assign a specific test module.
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

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">142</div>
                            <p className="text-xs text-muted-foreground">Across 3 classes</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Assignment Completion</CardTitle>
                            <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">89%</div>
                            <p className="text-xs text-muted-foreground">Average completion rate</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Class Performance</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">+12%</div>
                            <p className="text-xs text-muted-foreground">Improvement this week</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4">
                        <CardHeader>
                            <CardTitle>Student Performance</CardTitle>
                            <CardDescription>Recent test scores</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {[
                                    { name: "Alice Johnson", id: "a1b2...", score: 92, status: "Completed" },
                                    { name: "Bob Smith", id: "c3d4...", score: 78, status: "In Progress" },
                                    { name: "Charlie Brown", id: "e5f6...", score: 85, status: "Completed" },
                                    { name: "Diana Prince", id: "g7h8...", score: 95, status: "Completed" },
                                ].map((s, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                                {s.name[0]}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold">{s.name}</h3>
                                                <p className="text-xs text-muted-foreground font-mono">ID: {s.id}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg">{s.score}%</p>
                                            <p className="text-xs text-muted-foreground">{s.status}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="col-span-3">
                        <CardHeader>
                            <CardTitle>Class Overview</CardTitle>
                            <CardDescription>Recent performance by class</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {["CS101 - Intro to Python", "CS202 - Data Structures", "CS305 - Algorithms"].map((cls, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                                        <div>
                                            <h3 className="font-semibold">{cls}</h3>
                                            <p className="text-sm text-muted-foreground">32 Students • 4 Assignments active</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg">{(85 + i * 2)}%</p>
                                            <p className="text-xs text-muted-foreground">Avg Score</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default TeacherDashboard;
