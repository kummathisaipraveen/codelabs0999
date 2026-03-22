# Class Diagram: CodeCoach

This diagram illustrates the primary classes, services, and their relationships within the CodeCoach platform.

```mermaid
classDiagram
    direction TB

    %% Backend Services
    class AIAgentService {
        +string api_key
        +string api_url
        +get_socratic_response(messages, context, code, level, test_results) Dict
        +get_progressive_hint(level, context, code, test_results) Dict
    }

    class AssessmentEngine {
        +SupabaseClient supabase
        +calculate_frustration_index(student_id) float
        +recommend_next_task(student_id, current_mastery) Dict
    }

    class OntologyService {
        +SupabaseClient supabase
        +DiGraph graph
        +get_user_mastery(user_id) Dict
        +update_mastery(user_id, concept, success) void
        -_refresh_graph() void
    }

    class ExecutionService {
        +bool has_docker
        +execute_code(code_data, test_cases) Dict
        -_check_docker() bool
        -_generate_harness(test_cases, module) string
    }

    %% Main Application
    class FastAPI_App {
        <<Entry Point>>
        +AssessmentEngine assessment
        +OntologyService ontology
        +AIAgentService ai
        +ExecutionService execution
    }

    %% Frontend Components/Hooks
    class PracticePage {
        +string problemId
        +string assignmentId
        +handleRun() void
        +handleSubmit() void
        +handleNextTask() void
    }

    class usePythonRunner {
        <<Hook>>
        +bool isLoading
        +runCode(code, testCases) Promise
    }

    class AntiCheatMonitor {
        <<Component>>
        +keystrokeTimes ref
        +pasteCount ref
        +logEvent(type, metadata) void
    }

    %% Relationships
    FastAPI_App ..> AIAgentService : uses
    FastAPI_App ..> AssessmentEngine : uses
    FastAPI_App ..> OntologyService : uses
    FastAPI_App ..> ExecutionService : uses

    PracticePage ..> usePythonRunner : uses
    PracticePage ..> AntiCheatMonitor : uses
    PracticePage --> FastAPI_App : calls API
```

## Description of Key Classes

### Backend Services
- **`AIAgentService`**: Interfaces with Google Gemini to provide Socratic guidance and hints. It handles the prompt engineering and JSON parsing for AI responses.
- **`AssessmentEngine`**: The "brain" of the platform. It analyzes behavioral logs from Supabase to track student frustration and recommend the next task.
- **`OntologyService`**: Manages the knowledge graph of coding concepts using `NetworkX`. It calculates mastery, available topics, and locked prerequisites.
- **`ExecutionService`**: A legacy backend runner that provides Docker-based sandboxing. Note: Main production execution is now handled on the frontend.

### Frontend Components/Hooks
- **`PracticePage`**: The main IDE component. It orchestrates code editing, execution (via `usePythonRunner`), and AI chat.
- **`usePythonRunner`**: A custom hook that wraps **Pyodide**. It loads the Python runtime into a WebWorker and executes student code against test cases in the browser.
- **`AntiCheatMonitor`**: Tracks fine-grained student interactions (keystrokes, tab blurs, copy/paste) and persists them to the `security_logs` and `interaction_logs` tables for teacher review.
