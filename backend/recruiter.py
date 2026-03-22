import os
import json
from typing import List, Dict, Any, Optional
from supabase import create_client, Client
from ai_agent import AIAgentService

class RecruiterService:
    def __init__(self):
        self.url = os.getenv("VITE_SUPABASE_URL")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.supabase: Optional[Client] = None
        if self.url and self.key:
            self.supabase = create_client(self.url, self.key)
        self.ai = AIAgentService()

    def get_top_candidates(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Ranks candidates by total points and problem solving history."""
        if not self.supabase:
            return []

        try:
            # Join user_points with profiles
            resp = self.supabase.table("user_points")\
                .select("total_points, problems_solved, profiles(user_id, display_name, avatar_url)")\
                .order("total_points", { "ascending": False })\
                .limit(limit)\
                .execute()
            
            candidates = []
            for item in resp.data:
                profile = item.get("profiles", {})
                user_id = profile.get("user_id")
                if not user_id: continue

                # Get mastered concepts count
                mastery_resp = self.supabase.table("user_mastery")\
                    .select("id")\
                    .eq("user_id", user_id)\
                    .eq("mastered", True)\
                    .execute()
                
                mastery_count = len(mastery_resp.data)

                candidates.append({
                    "id": user_id,
                    "name": profile.get("display_name", "Anonymous User"),
                    "points": item["total_points"],
                    "solved": item["problems_solved"],
                    "mastery_level": mastery_count,
                    "avatar": profile.get("avatar_url")
                })
            
            return candidates
        except Exception as e:
            print(f"Recruiter error: {e}")
            return []

    async def get_talent_insights(self, student_id: str) -> Dict[str, str]:
        """Uses AI to generate a professional summary of a student's strengths."""
        if not self.supabase:
            return {"summary": "Service unavailable."}

        try:
            # 1. Fetch recent submissions and mastered concepts
            submissions = self.supabase.table("submissions")\
                .select("score, problems(title, concepts)")\
                .eq("user_id", student_id)\
                .limit(10)\
                .execute()
            
            mastery = self.supabase.table("user_mastery")\
                .select("concepts(name)")\
                .eq("user_id", student_id)\
                .eq("mastered", True)\
                .execute()
            
            skills = [m["concepts"]["name"] for m in mastery.data if m.get("concepts")]
            sub_titles = [s["problems"]["title"] for s in submissions.data if s.get("problems")]

            # 2. Ask AI to summarize
            prompt = f"""You are a technical talent scout. Analyze this student's progress:
            Mastered Skills: {", ".join(skills)}
            Recently Solved: {", ".join(sub_titles)}
            
            Task: Provide a 2-sentence professional recruiter summary highlighting their core strengths. 
            Format: {{"summary": "your text"}}
            """
            
            # Reusing get_socratic_response mechanism for a simple summary
            # (In a real system, we'd have a specific method, but this works for now)
            result = await self.ai.get_socratic_response([], prompt, "")
            return {"summary": result.get("response", "Showing strong growth across data structures.")}

        except Exception as e:
            print(f"Insight error: {e}")
            return {"summary": "Unable to generate insights at this time."}
