import os
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from supabase import create_client, Client
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

class GamificationService:
    def __init__(self):
        self.supabase: Optional[Client] = None
        if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
            self.supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            
    def award_points(self, user_id: str, points: int) -> Dict[str, Any]:
        """Awards points and updates the user's streak in the leaderboard table."""
        if not self.supabase:
            return {"status": "error", "message": "Supabase not configured for gamification."}
            
        try:
            # 1. Fetch current user stats
            result = self.supabase.table("leaderboard").select("*").eq("user_id", user_id).execute()
            
            today_str = date.today().isoformat()
            
            if not result.data:
                # First time user is getting points
                new_entry = {
                    "user_id": user_id,
                    "total_score": points,
                    "current_streak": 1,
                    "last_activity_date": today_str,
                    "badges": ["First Execution!"]
                }
                self.supabase.table("leaderboard").insert(new_entry).execute()
                return new_entry
            
            # 2. Update existing stats
            user_data = result.data[0]
            current_score = user_data.get("total_score", 0)
            current_streak = user_data.get("current_streak", 0)
            last_activity_date = user_data.get("last_activity_date")
            badges = user_data.get("badges", [])
            
            new_score = current_score + points
            
            # Date logic for streaks
            last_date = date.fromisoformat(last_activity_date) if last_activity_date else None
            today = date.today()
            
            if last_date == today:
                # Already active today, streak doesn't increase, just update score
                pass
            elif last_date == today - timedelta(days=1):
                current_streak += 1
            else:
                current_streak = 1 # Reset streak
                
            update_payload = {
                "total_score": new_score,
                "current_streak": current_streak,
                "last_activity_date": today_str,
                "badges": badges
            }
            
            self.supabase.table("leaderboard").update(update_payload).eq("user_id", user_id).execute()
            update_payload["user_id"] = user_id
            return update_payload
            
        except Exception as e:
            print(f"Error awarding points: {e}")
            return {"status": "error", "message": str(e)}

    def get_leaderboard(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetches the top users ordered by score."""
        if not self.supabase:
             return []
        try:
            result = self.supabase.table("leaderboard").select("*").order("total_score", desc=True).limit(limit).execute()
            return result.data
        except Exception as e:
            print(f"Error fetching leaderboard: {e}")
            return []
            
    def log_interaction(self, student_id: str, action_type: str, metadata: dict, problem_id: Optional[int] = None):
        """Logs frontend metrics (keystrokes, tab blurs, copy/paste limit hits)."""
        if not self.supabase:
            return
        try:
            payload = {
                "student_id": student_id,
                "action_type": action_type,
                "metadata": metadata
            }
            if problem_id is not None:
                payload["problem_id"] = problem_id
            self.supabase.table("interaction_logs").insert(payload).execute()
        except Exception as e:
            print(f"Error logging interaction: {e}")
