from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from execution import ExecutionService
from ai_agent import AIAgentService
from ontology import OntologyService
import uuid
from datetime import datetime
from jose import jwt as jose_jwt, JWTError
import os
from dotenv import load_dotenv, find_dotenv
from supabase import create_client, Client

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
    # Dev mode: if JWT secret is not configured, skip auth entirely
    if not SUPABASE_JWT_SECRET:
        return {"id": "demo_user", "sub": "demo_user"}
    
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization Header")
    
    try:
        token = authorization.replace("Bearer ", "")
        payload = jose_jwt.decode(
            token, 
            SUPABASE_JWT_SECRET, 
            algorithms=["HS256"], 
            audience="authenticated"
        )
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# Initialize services (Singleton pattern for this simple demo)
ai_agent = AIAgentService()
ontology_service = OntologyService()

class TestResult(BaseModel):
    input: str
    expected: str
    actual: str
    passed: bool

class CodeExecutionRequest(BaseModel):
    code: str
    language: str = "python"
    test_cases: List[Dict[str, str]]

class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    problem_context: str

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

# In-memory storage for assignments
assignments: List[Assignment] = []

# CORS Setup
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
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


@app.post("/chat")
async def chat_agent(request: ChatRequest, user: dict = Depends(get_current_user)):
    try:
        response = await ai_agent.get_socratic_response(request.messages, request.problem_context)
        return {"role": "assistant", "content": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graph")
async def get_graph(user: dict = Depends(get_current_user)):
    try:
        # Use the real user ID from the token
        user_id = user.get("sub", "demo_user")
        data = ontology_service.get_user_mastery(user_id)
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
