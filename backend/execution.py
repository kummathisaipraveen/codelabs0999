"""
execution.py — Fallback Python execution service for the backend.

Primary execution path: Pyodide in the browser (no backend needed).
This module handles the /execute endpoint as a LOCAL-ONLY fallback
when a server-side execution is needed (e.g. future grading service).

NOTE: This runs code via subprocess directly — suitable for local dev only.
For production, rely on the browser-side Pyodide executor in usePythonRunner.ts.
"""

import subprocess
import tempfile
import os
import json
import sys
from typing import List, Dict, Any


class ExecutionService:
    def __init__(self):
        pass

    def execute_code(self, code_data: Any, test_cases: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Executes Python code against test cases securely inside a Docker container.
        Supports single string (Legacy) or Dict[filename, content] (Multi-file).
        """
        files = {}
        if isinstance(code_data, str):
            files["solution.py"] = code_data
        elif isinstance(code_data, dict):
            files = code_data
        else:
            return {"status": "error", "error": f"Invalid code format: {type(code_data)}", "results": []}

        with tempfile.TemporaryDirectory() as temp_dir:
            # 1. Write user files
            for filename, content in files.items():
                file_path = os.path.join(temp_dir, filename)
                # Ensure subdirectories exist if any
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)

            # 2. Determine target module and generate harness
            # If main.py exists, use it. Otherwise use solution.py or the first .py file.
            target_file = "main.py" if "main.py" in files else ("solution.py" if "solution.py" in files else next((f for f in files.keys() if f.endswith(".py")), "solution.py"))
            target_module = target_file.replace(".py", "").replace("/", ".")
            
            harness = self._generate_harness(test_cases, target_module)
            with open(os.path.join(temp_dir, "_runner.py"), "w", encoding="utf-8") as f:
                f.write(harness)

            try:
                docker_cmd = [
                    "docker", "run", "--rm",
                    "-v", f"{temp_dir}:/app",
                    "-w", "/app",
                    "--network", "none",     # Block internet access
                    "--memory", "128m",      # Limit RAM to 128MB
                    "--cpus", "0.5",         # Limit CPU to half a core
                    "python:3.10-slim",
                    "python", "_runner.py"
                ]

                result = subprocess.run(
                    docker_cmd,
                    capture_output=True,
                    timeout=15,  # Slightly longer timeout to account for docker boot time
                )

                stdout = result.stdout.decode("utf-8", errors="replace")
                stderr = result.stderr.decode("utf-8", errors="replace")

                if result.returncode != 0:
                    return {
                        "status": "error",
                        "error": stderr or stdout or "Runtime Error",
                        "results": [],
                    }

                # Parse JSON results from harness output
                result_line = next(
                    (l for l in stdout.split("\n") if l.startswith("__RESULTS__:")),
                    None,
                )
                if not result_line:
                    return {
                        "status": "error",
                        "error": "No results returned from harness. Make sure your code defines a solution() function.",
                        "results": [],
                        "logs": stdout,
                    }

                results = json.loads(result_line.replace("__RESULTS__:", ""))
                user_output = "\n".join(
                    l for l in stdout.split("\n") if not l.startswith("__RESULTS__:")
                ).strip()

                return {
                    "status": "success",
                    "results": results,
                    "logs": user_output,
                }

            except subprocess.TimeoutExpired:
                return {"status": "timeout", "error": "Execution timed out (10s limit)", "results": []}
            except Exception as e:
                return {"status": "system_error", "error": str(e), "results": []}

    def _generate_harness(self, test_cases: List[Dict[str, str]], target_module: str) -> str:
        """
        Generates a separate test runner that imports the user's module.
        """
        cases_json = json.dumps(test_cases)
        return f"""
import json, sys, time, traceback, importlib
from io import StringIO

_target_module_name = "{target_module}"
_test_cases = {cases_json}
_results = []

try:
    _module = importlib.import_module(_target_module_name)
    # Re-import to ensure fresh state if needed, though docker is fresh anyway
except Exception:
    print("__RESULTS__:" + json.dumps([{{
        "test_case": 0,
        "input": "Import",
        "expected": "Success",
        "actual": "Failed",
        "passed": False,
        "error": traceback.format_exc()
    }}]))
    sys.exit(0)

for _i, _case in enumerate(_test_cases):
    _inp = _case.get("input", "")
    _exp = _case.get("expected", _case.get("output", ""))
    _start = time.time()
    try:
        # Try to find a function in the module
        _funcs = [v for k, v in vars(_module).items() if callable(v) and not k.startswith('_')]
        if _funcs:
            _func = _funcs[-1] # Usually the last defined function is the solution
            # Handle list/dict inputs safely
            _args = eval("(" + str(_inp) + ",)")
            _got = _func(*_args)
        else:
            # Fallback to eval if no functions found (e.g. constant check)
            _got = eval(_inp, vars(_module))
            
        _elapsed = round((time.time() - _start) * 1000, 2)
        _actual = json.dumps(_got) if _got is not None else "None"
        _passed = _actual.replace(" ", "").lower() == str(_exp).replace(" ", "").lower()
        _results.append({{
            "test_case": _i + 1,
            "input": _inp,
            "expected": _exp,
            "actual": _actual,
            "passed": _passed,
            "execution_time_ms": _elapsed,
        }})
    except Exception as _e:
        _elapsed = round((time.time() - _start) * 1000, 2)
        _results.append({{
            "test_case": _i + 1,
            "input": _inp,
            "expected": _exp,
            "actual": "",
            "passed": False,
            "error": traceback.format_exc(),
            "execution_time_ms": _elapsed,
        }})

print("__RESULTS__:" + json.dumps(_results))
"""
