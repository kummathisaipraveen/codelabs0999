import os
from typing import List, Dict, Any, Optional
from supabase import create_client, Client

class AnalyticsService:
    def __init__(self):
        self.url = os.getenv("VITE_SUPABASE_URL")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.supabase: Optional[Client] = None
        if self.url and self.key:
            self.supabase = create_client(self.url, self.key)

    def get_class_mastery_stats(self, student_ids: List[str]) -> List[Dict[str, Any]]:
        """Calculates what percentage of students in the list have mastered each concept."""
        if not self.supabase or not student_ids:
            return []

        try:
            # 1. Fetch all concepts
            concepts_resp = self.supabase.table("concepts").select("id, name").execute()
            concepts = concepts_resp.data

            # 2. Fetch all mastery records for these students
            mastery_resp = self.supabase.table("user_mastery")\
                .select("concept_id")\
                .in_("user_id", student_ids)\
                .eq("mastered", True)\
                .execute()
            mastery_data = mastery_resp.data

            # 3. Aggregate
            total_students = len(student_ids)
            stats = []
            for c in concepts:
                concept_id = c["id"]
                count = len([m for m in mastery_data if m["concept_id"] == concept_id])
                percentage = round((count / total_students) * 100) if total_students > 0 else 0
                stats.append({
                    "id": concept_id,
                    "name": c["name"],
                    "mastery_count": count,
                    "total_students": total_students,
                    "percentage": percentage
                })
            
            return stats
        except Exception as e:
            print(f"Analytics error: {e}")
            return []

    def get_live_feed(self, student_ids: List[str], limit: int = 10) -> List[Dict[str, Any]]:
        """Fetches the most recent submissions across the given students."""
        if not self.supabase or not student_ids:
            return []

        try:
            resp = self.supabase.table("submissions")\
                .select("id, created_at, score, student_id:user_id, problems(title, concepts)")\
                .in_("user_id", student_ids)\
                .order("created_at", { "ascending": False })\
                .limit(limit)\
                .execute()
            return resp.data
        except Exception as e:
            print(f"Live feed error: {e}")
            return []
