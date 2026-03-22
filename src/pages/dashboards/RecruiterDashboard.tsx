import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Briefcase, UserCheck, Star, Brain, Filter, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Candidate {
    id: string;
    name: string;
    points: number;
    solved: number;
    mastery_level: number;
    avatar?: string;
    skills?: string[];
    insight?: string;
}

const RecruiterDashboard = () => {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [loadingInsight, setLoadingInsight] = useState<string | null>(null);

    useEffect(() => {
        fetchCandidates();
    }, []);

    const fetchCandidates = async () => {
        try {
            const resp = await fetch("/api/recruiter/candidates");
            const data = await resp.json();
            setCandidates(data.candidates || []);
        } catch (error) {
            toast.error("Failed to load candidates");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchInsight = async (id: string) => {
        setLoadingInsight(id);
        try {
            const resp = await fetch(`/api/recruiter/insights/${id}`);
            const data = await resp.json();
            setCandidates(prev => prev.map(c => 
                c.id === id ? { ...c, insight: data.summary } : c
            ));
            toast.success("Talent insight generated!");
        } catch (error) {
            toast.error("AI service currently unavailable");
        } finally {
            setLoadingInsight(null);
        }
    };

    const filtered = candidates.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen pt-20 px-4 md:px-6">
            <div className="max-w-6xl mx-auto space-y-8 pb-20">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Recruiter Dashboard</h1>
                        <p className="text-muted-foreground">Find top talent based on verified skill mastery</p>
                    </div>
                    <Button className="gap-2 gradient-primary">
                        <Briefcase className="h-4 w-4" />
                        Post Job
                    </Button>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search" 
                            placeholder="Search candidates..." 
                            className="pl-8" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" className="gap-2">
                        <Filter className="h-4 w-4" />
                        Skills
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="grid gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Top Talent Pool</CardTitle>
                                <CardDescription>Verified candidates ranked by total mastery and performance</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {filtered.map((candidate) => (
                                        <div key={candidate.id} className="group flex flex-col p-4 border rounded-xl hover:border-primary/50 hover:bg-muted/30 transition-all">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-bold text-primary border border-primary/20">
                                                        {candidate.name[0]}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-semibold text-lg">{candidate.name}</h3>
                                                            {candidate.points > 1000 && <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Elite</Badge>}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                                                            <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {candidate.points} pts</span>
                                                            <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" /> {candidate.solved} solved</span>
                                                            <span className="flex items-center gap-1 font-medium text-primary/80">{candidate.mastery_level} Concepts</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="gap-2 text-xs"
                                                        onClick={() => fetchInsight(candidate.id)}
                                                        disabled={loadingInsight === candidate.id}
                                                    >
                                                        {loadingInsight === candidate.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                                                        Generate Insight
                                                    </Button>
                                                    <Button variant="outline" size="sm">View Profile</Button>
                                                </div>
                                            </div>

                                            {candidate.insight && (
                                                <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/10 flex gap-3 items-start animate-in fade-in slide-in-from-top-1 duration-300">
                                                    <Brain className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                                    <p className="text-sm italic text-muted-foreground leading-relaxed">
                                                        "{candidate.insight}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {filtered.length === 0 && (
                                        <div className="text-center py-12 text-muted-foreground">
                                            No candidates found matching your search.
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecruiterDashboard;
