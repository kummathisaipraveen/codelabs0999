import { motion } from "framer-motion";
import { Code2, Lock, Unlock, CheckCircle } from "lucide-react";

interface GraphNode {
    id: string;
    label: string;
}

interface GraphLink {
    source: string;
    target: string;
}

interface GraphData {
    mastered: string[];
    available: string[];
    locked: string[];
    graph_structure: {
        nodes: GraphNode[];
        links: GraphLink[];
    };
}

interface LearningGraphProps {
    data: GraphData | null;
    isLoading: boolean;
    onNodeClick?: (id: string) => void;
}

export const LearningGraph = ({ data, isLoading, onNodeClick }: LearningGraphProps) => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground animate-pulse">Mapping neural network...</p>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-16 relative py-10">
            {data.graph_structure.nodes.map((node, i) => {
                const isMastered = data.mastered.includes(node.id);
                const isAvailable = data.available.includes(node.id);
                const status = isMastered ? "mastered" : isAvailable ? "available" : "locked";
                
                return (
                    <motion.div
                        key={node.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => onNodeClick?.(node.id)}
                        className={`
                            relative group w-28 h-28 rounded-3xl flex flex-col items-center justify-center gap-2
                            border-2 transition-all cursor-pointer shadow-lg
                            ${status === 'mastered' ? 'border-success/50 bg-success/10 text-success' : 
                                status === 'available' ? 'border-primary/50 bg-primary/10 text-primary animate-pulse-subtle' : 
                                'border-border/50 bg-muted/50 text-muted-foreground opacity-60 grayscale cursor-not-allowed'}
                        `}
                    >
                        {/* Status Badge */}
                        <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border-2 border-inherit flex items-center justify-center shadow-md">
                            {status === 'mastered' ? <CheckCircle className="h-3 w-3" /> : 
                                status === 'available' ? <Unlock className="h-3 w-3" /> : 
                                <Lock className="h-3 w-3" />}
                        </div>
                        
                        <div className="p-2 rounded-2xl bg-background/50 border border-inherit">
                            <Code2 className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-bold text-center px-1 truncate w-full">{node.id}</span>
                        
                        {/* Interactive Hover Tooltip */}
                        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-32 p-1.5 rounded bg-popover text-popover-foreground border opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none text-[8px] text-center shadow-xl">
                            {status === 'mastered' ? `Mastered!` :
                                status === 'available' ? `Ready to start.` :
                                `Locked.`}
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
};
