import networkx as nx
from typing import List, Dict, Set, Any

class OntologyService:
    def __init__(self):
        self.graph = nx.DiGraph()
        self._initialize_graph()
        self.user_mastery: Dict[str, Set[str]] = {} # Simple in-memory storage for demo

    def _initialize_graph(self):
        # Define concepts and their prerequisites
        concepts = {
            "Variables": [],
            "Data Types": ["Variables"],
            "Conditionals": ["Data Types"],
            "Loops": ["Conditionals"],
            "Functions": ["Loops"],
            "Recursion": ["Functions"],
            "Lists": ["Data Types"],
            "Dictionaries": ["Lists"],
            "Classes": ["Functions", "Dictionaries"],
        }
        
        for concept, prereqs in concepts.items():
            self.graph.add_node(concept)
            for prereq in prereqs:
                self.graph.add_edge(prereq, concept)

    def get_user_mastery(self, user_id: str) -> Dict[str, Any]:
        """Returns the mastery status of the user."""
        mastered = self.user_mastery.get(user_id, set())
        
        # Calculate available concepts (prereqs met)
        available = []
        locked = []
        
        for node in self.graph.nodes():
            if node in mastered:
                continue
                
            prereqs = list(self.graph.predecessors(node))
            if all(p in mastered for p in prereqs):
                available.append(node)
            else:
                locked.append(node)
                
        return {
            "mastered": list(mastered),
            "available": available,
            "locked": locked,
            "graph_structure": nx.node_link_data(self.graph)
        }

    def update_mastery(self, user_id: str, concept: str, success: bool):
        if user_id not in self.user_mastery:
            self.user_mastery[user_id] = set()
            
        if success:
            self.user_mastery[user_id].add(concept)
