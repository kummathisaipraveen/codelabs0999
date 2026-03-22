import networkx as nx
import os
from typing import List, Dict, Set, Any, Optional
from supabase import create_client, Client

class OntologyService:
    def __init__(self):
        self.url = os.getenv("VITE_SUPABASE_URL")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.supabase: Optional[Client] = None
        if self.url and self.key:
            self.supabase = create_client(self.url, self.key)
        
        self.graph = nx.DiGraph()
        self._refresh_graph()

    def _refresh_graph(self):
        """Syncs the internal NetworkX graph with the Supabase concepts/prereqs tables."""
        if not self.supabase:
            return

        try:
            # 1. Fetch Concepts
            concepts_resp = self.supabase.table("concepts").select("id").execute()
            nodes = [c["id"] for c in concepts_resp.data]
            
            # 2. Fetch Prereqs
            prereqs_resp = self.supabase.table("prerequisites").select("concept_id, prerequisite_id").execute()
            edges = [(p["prerequisite_id"], p["concept_id"]) for p in prereqs_resp.data]
            
            # 3. Rebuild Graph
            self.graph.clear()
            self.graph.add_nodes_from(nodes)
            self.graph.add_edges_from(edges)
        except Exception as e:
            print(f"Failed to refresh graph from DB: {e}")

    def get_user_mastery(self, user_id: str) -> Dict[str, Any]:
        """Returns the mastery status of the user, pulling from Supabase."""
        self._refresh_graph() # Ensure graph is synced
        
        mastered = []
        if self.supabase:
            try:
                resp = self.supabase.table("user_mastery").select("concept_id").eq("user_id", user_id).eq("mastered", True).execute()
                mastered = [m["concept_id"] for m in resp.data]
            except Exception as e:
                print(f"Failed to fetch mastery for {user_id}: {e}")

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
            "mastered": mastered,
            "available": available,
            "locked": locked,
            "graph_structure": nx.node_link_data(self.graph)
        }

    def update_mastery(self, user_id: str, concept: str, success: bool):
        """Persists the user's mastery into Supabase."""
        if not self.supabase or not success:
            return
            
        try:
            # Upsert mastery status
            self.supabase.table("user_mastery").upsert({
                "user_id": user_id,
                "concept_id": concept,
                "mastered": True
            }, on_conflict="user_id, concept_id").execute()
        except Exception as e:
            print(f"Failed to update mastery in DB: {e}")
