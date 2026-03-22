import os
from typing import Dict, Any, Optional
from supabase import create_client, Client
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

class AssessmentEngine:
    def __init__(self):
        self.supabase: Optional[Client] = None
        if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
            self.supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            
    def calculate_frustration_index(self, student_id: str) -> float:
        """
        Analyzes recent logs to determine how frustrated or stuck the student is.
        Returns a float: 0.0 = Totally fine, 1.0 = Highly frustrated.
        """
        if not self.supabase:
            return 0.0
            
        try:
            # Fetch last 50 interactions
            result = self.supabase.table("interaction_logs") \
                .select("*") \
                .eq("student_id", student_id) \
                .order("created_at", desc=True) \
                .limit(50).execute()
                
            logs = result.data or []
            
            frustration_points = 0.0
            for log in logs:
                action = log.get("action_type")
                
                # Tab switching often means looking for answers (confusion or cheating)
                if action == "tab_switch":
                    frustration_points += 0.1
                # Copying/Pasting is a strong indicator of giving up and finding external code
                elif action in ["copy_attempt", "paste_attempt"]:
                    frustration_points += 0.2
                # High execution errors or timeouts
                elif action == "execution_failed":
                    frustration_points += 0.15
                    
            # Normalize to max 1.0 limit
            return min(frustration_points, 1.0)
            
        except Exception as e:
            print(f"Error calculating frustration: {e}")
            return 0.0
            
    def recommend_next_task(self, student_id: str, current_mastery: list) -> Dict[str, Any]:
        """
        Dynamically recommends the type and difficulty of the NEXT task based on the student's emotional state.
        """
        frustration = self.calculate_frustration_index(student_id)
        
        if frustration > 0.7:
            # Highly frustrated: Drop them to a reading or simple MCQ to rebuild confidence
            recommended_type = "Code Comprehension"
            difficulty = "Easy"
            reason = "High frustration detected (many tab switches/paste attempts in logs). Recommending stepping back to comprehension tasks."
        elif frustration > 0.4:
            # Moderately stuck: Give them a debugging task where the structure is already there
            recommended_type = "Debugging"
            difficulty = "Medium"
            reason = "Moderate struggle detected. Recommending a Debugging task to build targeted skills without blank-page syndrome."
        else:
            # Doing great: Full code writing
            recommended_type = "Code Writing"
            difficulty = "Hard" if len(current_mastery) > 3 else "Medium"
            reason = "Student is engaged and performing well. Recommending standard implementation task."
            
        return {
            "recommended_type": recommended_type,
            "difficulty": difficulty,
            "frustration_index": round(frustration, 2),
            "reason": reason
        }
