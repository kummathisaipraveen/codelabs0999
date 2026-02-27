
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Briefcase, UserCheck, Star } from "lucide-react";
import { Input } from "@/components/ui/input";

const RecruiterDashboard = () => {
    return (
        <div className="min-h-screen pt-20 px-4 md:px-6">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Recruiter Dashboard</h1>
                        <p className="text-muted-foreground">Find top talent based on verified skills</p>
                    </div>
                    <Button className="gap-2">
                        <Briefcase className="h-4 w-4" />
                        Post Job
                    </Button>
                </div>

                <div className="flex items-center space-x-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="search" placeholder="Search candidates by skill..." className="pl-8" />
                    </div>
                    <Button variant="outline">Filter</Button>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Candidates</CardTitle>
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">1,204</div>
                            <p className="text-xs text-muted-foreground">Matching your criteria</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Interviews Scheduled</CardTitle>
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">8</div>
                            <p className="text-xs text-muted-foreground">For this week</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
                            <Star className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Alex Chen</div>
                            <p className="text-xs text-muted-foreground">DSA Master (Top 1%)</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Top Candidates</CardTitle>
                        <CardDescription>Candidates with highest competency matches</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                { name: "Sarah Jones", skills: ["Python", "Algorithms", "React"], score: 98 },
                                { name: "Michael Lee", skills: ["Java", "System Design", "SQL"], score: 95 },
                                { name: "Emily Wang", skills: ["C++", "Graphs", "Low-level Systems"], score: 92 }
                            ].map((candidate, i) => (
                                <div key={i} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                            {candidate.name[0]}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">{candidate.name}</h3>
                                            <p className="text-sm text-muted-foreground">{candidate.skills.join(" • ")}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="font-bold text-lg text-green-600">{candidate.score}%</p>
                                            <p className="text-xs text-muted-foreground">Match</p>
                                        </div>
                                        <Button variant="outline" size="sm">View Profile</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default RecruiterDashboard;
