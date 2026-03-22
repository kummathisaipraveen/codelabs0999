# Sequence Diagram: CodeCoach Core Flow

This diagram illustrates the dynamic interaction between the student, the browser-side execution environment, and the backend AI services during a typical coding session.

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant FE as PracticePage (Frontend)
    participant PY as Pyodide (WebWorker)
    participant SB as Supabase (Database)
    participant BE as FastAPI Backend
    participant AI as Gemini AI Service
    participant AE as Assessment Engine

    Student->>FE: Writes Code & Clicks "Run"
    FE->>PY: runCode(student_code, test_cases)
    activate PY
    PY-->>FE: Return Execution Results & Logs
    deactivate PY
    FE->>Student: Display Test Results (Success/Failure)

    Student->>FE: Clicks "Submit Solution"
    FE->>SB: Insert Submission (code, score, tests)
    FE->>SB: Update user_points (XP, streaks)
    FE->>BE: POST /api/chat (problem_context, code, results)
    
    activate BE
    BE->>AI: get_socratic_response()
    AI-->>BE: Socratic Path + Teacher Insights
    BE->>AE: recommend_next_task(student_id)
    AE->>SB: Query interaction_logs (frustration check)
    SB-->>AE: Last 50 events (tab switches, pastes)
    AE-->>BE: Recommended Difficulty (Easy/Med/Hard)
    BE-->>FE: AI Chat Reply + Assessment Recommendation
    deactivate BE

    FE->>Student: Display AI Guidance & "Next Task" Button

    Student->>FE: Clicks "Next Task"
    FE->>BE: GET /api/next_task (difficulty_req)
    BE->>SB: SELECT random problem FROM problems WHERE difficulty=X
    SB-->>BE: Problem Metadata
    BE-->>FE: next_id: 123
    FE->>FE: Navigate to /practice/123
    FE->>Student: Load new challenge
```

## Description of Interactions

### 1. Real-Time Execution (Steps 1-4)
- Unlike traditional platforms, CodeCoach performs initial verification entirely in the user's browser via **Pyodide**. 
- This ensures zero latency and offline capability for basic syntax and logic checks.

### 2. Submission & Feedback Loop (Steps 5-9)
- Upon submission, the frontend synchronizes with **Supabase** to persist progress.
- It then triggers the backend **Socratic Loop**. The `AIAgentService` uses Gemini to generate conversational guidance *without* giving away the solution.
- Simultaneously, the `AssessmentEngine` calculates a **frustration index** by analyzing behavioral logs (e.g., if the user was switching tabs or pasting code), which informs the next task's difficulty.

### 3. Adaptive Path Navigation (Steps 10-16)
- The backend's recommendation is translated into a dynamic navigation event.
- The platform automatically steers the student toward a challenge that matches their current cognitive load and frustration level, ensuring a "Flow" state.
