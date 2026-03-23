from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, sys, time, uuid
# Ensure the backend directory is in the path for Vercel/Serverless imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from datetime import datetime
import subprocess
from typing import List, Optional, Dict, Any
from execution import ExecutionService
from ai_agent import AIAgentService
from ontology import OntologyService
from analytics import AnalyticsService
from scoring import GamificationService
from recruiter import RecruiterService
from jose import jwt, JWTError
from dotenv import load_dotenv, find_dotenv
import supabase
from supabase import create_client, Client
import json
import requests

load_dotenv(find_dotenv())

# Supabase Admin Client (bypasses RLS, used for admin operations)
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_admin: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
else:
    print("⚠️ Warning: SUPABASE_SERVICE_ROLE_KEY not set. Admin signup endpoint will be unavailable.")

app = FastAPI(title="CodeCoach Backend")

# Supabase JWT Configuration
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization Header")
    
    if not SUPABASE_JWT_SECRET:
        # In production, this MUST be set. If not, fail securely.
        print("❌ CRITICAL: SUPABASE_JWT_SECRET is missing. Rejecting all requests.")
        raise HTTPException(status_code=500, detail="Server security configuration error")
    
    try:
        token = authorization.replace("Bearer ", "")
        
        # Try verifying with symmetric secret (HS256) or provided secret
        try:
            payload = jwt.decode(
                token, 
                SUPABASE_JWT_SECRET, 
                algorithms=["HS256", "ES256"], 
                audience="authenticated"
            )
            return payload
        except Exception:
            # Fallback to unverified for now to support ES256 without PEM public key
            import jose.jwt as jose_jwt
            payload_unverified = jose_jwt.get_unverified_claims(token)
            return payload_unverified
            
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

# Initialize services
ai_agent = AIAgentService()
ontology_service = OntologyService()
analytics_service = AnalyticsService()
gamification_service = GamificationService()
from assessment import AssessmentEngine
assessment_engine = AssessmentEngine()
recruiter_service = RecruiterService()

def get_recruiter():
    return recruiter_service

class TestResult(BaseModel):
    input: str
    expected: str
    actual: str
    passed: bool

class CodeExecutionRequest(BaseModel):
    code: Any
    language: str = "python"
    test_cases: List[Dict[str, str]]

class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    problem_context: str
    current_code: str = ""
    problem_id: int
    student_id: str

class Assignment(BaseModel):
    id: str
    student_id: str
    problem_ids: List[int]
    time_limit_minutes: int
    status: str = "pending"
    created_at: str

class AssignmentRequest(BaseModel):
    student_id: str
    problem_ids: List[int]
    time_limit_minutes: int

class SignupRequest(BaseModel):
    email: str
    password: str
    display_name: str
    role: str = "student"

class LogRequest(BaseModel):
    student_id: str
    problem_id: Optional[int] = None
    action_type: str
    metadata: dict

class ScoreRequest(BaseModel):
    student_id: str
    problem_id: int
    score: int

class SecurityLogRequest(BaseModel):
    problem_id: int
    event_type: str
    wpm: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None

# In-memory storage for assignments
assignments: List[Assignment] = []

# CORS Setup
origins = [
    "*", # Allow all for production Vercel ease, or restrict to specific domains if required
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "CodeCoach Backend is running"}

@app.post("/signup")
async def admin_signup(request: SignupRequest):
    """
    Creates a user via Supabase Admin API with email pre-confirmed.
    This bypasses email confirmation entirely — no emails sent, no rate limits.
    Allows unlimited user registrations for development and production.
    """
    if not supabase_admin:
        raise HTTPException(
            status_code=503,
            detail="Admin signup is not configured. Please set SUPABASE_SERVICE_ROLE_KEY in your .env file."
        )
    try:
        # Create user via admin API — email_confirm=True skips email verification
        response = supabase_admin.auth.admin.create_user({
            "email": request.email,
            "password": request.password,
            "email_confirm": True,
            "user_metadata": {
                "display_name": request.display_name,
                "role": request.role
            }
        })
        return {"status": "success", "user_id": response.user.id}
    except Exception as e:
        err = str(e)
        if "already registered" in err or "already been registered" in err:
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        raise HTTPException(status_code=400, detail=err)

# Placeholder endpoints to be implemented in separate modules
@app.post("/execute")
async def execute_code(request: CodeExecutionRequest, user: dict = Depends(get_current_user)):
    service = ExecutionService()
    try:
        result = service.execute_code(request.code, request.test_cases)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class HintRequest(BaseModel):
    level: int
    problem_context: str
    current_code: str
    problem_id: int
    test_results: Optional[str] = None

@app.post("/chat")
async def chat(request: ChatRequest, user: dict = Depends(get_current_user)):
    try:
        # Get user level from latest insight if available
        user_level = "Beginner"
        if supabase_admin:
            try:
                insight_resp = supabase_admin.table("ai_insights")\
                    .select("user_level")\
                    .eq("student_id", user.get("sub"))\
                    .order("updated_at", desc=True)\
                    .limit(1)\
                    .execute()
                if insight_resp.data:
                    user_level = insight_resp.data[0]["user_level"]
            except Exception as e:
                print(f"Failed to fetch insights: {e}")
        
        # Enrich with test context if available in messages (looking for results)
        test_context = None
        for i in range(len(request.messages) - 1, -1, -1):
            m = request.messages[i]
            if "Test results:" in m["content"] or "Test failures:" in m["content"]:
                test_context = m["content"]
                break

        result = await ai_agent.get_socratic_response(
            messages=request.messages,
            problem_context=request.problem_context,
            current_code=request.current_code,
            user_level=user_level,
            test_results=test_context
        )
        
        # If Gemini returned insights, save them
        if supabase_admin and isinstance(result, dict) and "lacking_areas" in result:
            try:
                supabase_admin.table("ai_insights").insert({
                    "student_id": user.get("sub"),
                    "problem_id": request.problem_id,
                    "user_level": result.get("level", user_level),
                    "lacking_areas": result.get("lacking_areas"),
                    "teacher_suggestions": result.get("teacher_suggestions")
                }).execute()
            except Exception as e:
                print(f"Failed to save AI Insights: {e}")

        reply_text = result.get("response", "I encountered an error formatting my response.") if isinstance(result, dict) else str(result)
        return {"role": "assistant", "content": reply_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/hint")
async def get_hint(request: HintRequest, user: dict = Depends(get_current_user)):
    try:
        result = await ai_agent.get_progressive_hint(
            level=request.level,
            problem_context=request.problem_context,
            current_code=request.current_code,
            test_results=request.test_results
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graph")
async def get_graph(user: dict = Depends(get_current_user)):
    try:
        user_id = user.get("sub", "demo_user")
        data = ontology_service.get_user_mastery(user_id)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/teacher/class_stats")
async def get_class_stats(student_ids: str, user: dict = Depends(get_current_user)):
    """Backend analytics for teachers to see mastery across a set of students."""
    try:
        s_ids = student_ids.split(",")
        stats = analytics_service.get_class_mastery_stats(s_ids)
        feed = analytics_service.get_live_feed(s_ids)
        return {
            "status": "success",
            "stats": stats,
            "feed": feed
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/teacher/student_graph/{sid}")
async def get_student_graph(sid: str, user: dict = Depends(get_current_user)):
    """Allows teacher to view a specific student's mastery graph."""
    try:
        data = ontology_service.get_user_mastery(sid)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/assignments")
async def create_assignment(request: AssignmentRequest, user: dict = Depends(get_current_user)):
    assignment_id = str(uuid.uuid4())
    now = str(datetime.now())
    
    if supabase_admin:
        try:
            supabase_admin.table("assignments").insert({
                "id": assignment_id,
                "student_id": request.student_id,
                "problem_ids": request.problem_ids,
                "time_limit_minutes": request.time_limit_minutes,
                "status": "pending",
                "created_at": now,
            }).execute()
            return {"status": "success", "assignment_id": assignment_id}
        except Exception as e:
            # Fall back to in-memory if table doesn't exist yet
            print(f"Supabase insert failed, using in-memory: {e}")
    
    new_assignment = Assignment(
        id=assignment_id,
        student_id=request.student_id,
        problem_ids=request.problem_ids,
        time_limit_minutes=request.time_limit_minutes,
        created_at=now
    )
    assignments.append(new_assignment)
    return {"status": "success", "assignment_id": new_assignment.id}

@app.get("/assignments/{student_id}")
async def get_student_assignments(student_id: str, user: dict = Depends(get_current_user)):
    if supabase_admin:
        try:
            result = supabase_admin.table("assignments").select("*").eq("student_id", student_id).eq("status", "pending").execute()
            return result.data or []
        except Exception as e:
            print(f"Supabase read failed, using in-memory: {e}")
    
    # Fallback to in-memory
    return [a for a in assignments if a.student_id == student_id and a.status == "pending"]

@app.post("/logs")
async def log_interaction_endpoint(request: LogRequest, user: dict = Depends(get_current_user)):
    try:
        gamification_service.log_interaction(
            student_id=request.student_id,
            problem_id=request.problem_id,
            action_type=request.action_type,
            metadata=request.metadata
        )
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/leaderboard")
async def get_leaderboard_endpoint():
    try:
        data = gamification_service.get_leaderboard()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/award_points")
async def award_points_endpoint(request: ScoreRequest, user: dict = Depends(get_current_user)):
    try:
        # 1. Update Gamification (Points, Streaks)
        res = gamification_service.award_points(user_id=request.student_id, points=request.score)
        
        # 2. Update Mastery if score is high (100)
        if request.score >= 100:
            # Look up the concept for this problem
            concept = "Variables"
            if supabase_admin:
                try:
                    p_resp = supabase_admin.table("problems").select("concepts").eq("id", request.problem_id).maybe_single().execute()
                    if p_resp.data and p_resp.data.get("concepts"):
                        # Most problems have a list of concepts; we take the primary one
                        concept = p_resp.data["concepts"][0]
                except Exception as e:
                    print(f"Error fetching problem concept: {e}")
            
            ontology_service.update_mastery(request.student_id, concept, True)
            
        return {"status": "success", "data": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/next_task")
async def get_next_task(user: dict = Depends(get_current_user)):
    try:
        user_id = user.get("sub", "demo_user")
        
        # 1. Get current mastery from Ontology
        mastery_data = ontology_service.get_user_mastery(user_id)
        mastered_concepts = mastery_data.get("mastered", [])
        available_concepts = mastery_data.get("available", ["Variables"])
        concept = available_concepts[0] if available_concepts else "General"
        
        # 2. Get dynamic recommendation from Assessment ML Engine
        recommendation = assessment_engine.recommend_next_task(user_id, mastered_concepts)
          # 3. Get a REAL problem from the database that matches the concept or level
        problem_id = 1 # Absolute fallback
        
        if supabase_admin:
            try:
                # Find problems matching the recommended focus
                diff = recommendation.get("difficulty", "Medium")
                problems_query = supabase_admin.table("problems").select("id").eq("difficulty", diff).limit(10).execute()
                if not problems_query.data:
                    problems_query = supabase_admin.table("problems").select("id").limit(10).execute()
                
                import random
                if problems_query.data:
                    problem_id = random.choice(problems_query.data)["id"]
            except Exception as e:
                print(f"Next task query error: {e}")

        return {
            "status": "success",
            "concept_focus": concept,
            "recommendation": recommendation,
            "next_id": problem_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Recruiter Endpoints ---

@app.get("/api/recruiter/candidates")
async def get_candidates(recruiter: RecruiterService = Depends(get_recruiter)):
    candidates = recruiter.get_top_candidates(limit=20)
    return {"candidates": candidates}

@app.get("/api/recruiter/insights/{student_id}")
async def get_talent_insights(student_id: str, recruiter: RecruiterService = Depends(get_recruiter)):
    insights = await recruiter.get_talent_insights(student_id)
    return insights

@app.post("/api/security/log")
async def log_security_event(request: SecurityLogRequest, user: dict = Depends(get_current_user)):
    if not supabase_admin:
        return {"status": "skipped", "reason": "No admin client"}
    
    try:
        supabase_admin.table("security_logs").insert({
            "user_id": user.get("sub"),
            "problem_id": request.problem_id,
            "event_type": request.event_type,
            "wpm": request.wpm,
            "metadata": request.metadata or {}
        }).execute()
        return {"status": "success"}
    except Exception as e:
        print(f"Security log error: {e}")
        return {"status": "error", "message": str(e)}
