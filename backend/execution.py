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
        # Detect Python binary available on this system
        self.python_bin = self._find_python()

    def _find_python(self) -> str:
        """Finds the Python executable available on the system."""
        candidates = ["python3", "python", sys.executable]
        for candidate in candidates:
            try:
                result = subprocess.run(
                    [candidate, "--version"],
                    check=True,
                    capture_output=True,
                    timeout=3,
                )
                if result.returncode == 0:
                    print(f"✅ Execution service using: {candidate}")
                    return candidate
            except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
                continue
        print("⚠️ Warning: No Python binary found. Execution will fail.")
        return "python"

    def execute_code(self, code: str, test_cases: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Executes Python code against test cases.
        Uses direct subprocess execution (no Docker required).
        """
        with tempfile.TemporaryDirectory() as temp_dir:
            harness = self._generate_harness(test_cases)
            full_code = code + "\n\n" + harness

            code_path = os.path.join(temp_dir, "solution.py")
            with open(code_path, "w", encoding="utf-8") as f:
                f.write(full_code)

            try:
                result = subprocess.run(
                    [self.python_bin, code_path],
                    capture_output=True,
                    timeout=10,
                    cwd=temp_dir,
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

    def _generate_harness(self, test_cases: List[Dict[str, str]]) -> str:
        """
        Generates the test runner harness injected after user code.
        Captures stdout, measures execution time, and outputs JSON results.
        """
        cases_json = json.dumps(test_cases)
        return f"""
import json, sys, time, traceback
from io import StringIO

_test_cases = {cases_json}
_results = []

for _i, _case in enumerate(_test_cases):
    _inp = _case.get("input", "")
    _exp = _case.get("expected", _case.get("output", ""))
    _start = time.time()
    try:
        import inspect
        _funcs = [v for k, v in locals().items() if callable(v) and type(v).__name__ == 'function' and not k.startswith('_')]
        if _funcs:
            _func = _funcs[-1]
            _args = eval("(" + _inp + ",)")
            _got = _func(*_args)
        else:
            try:
                _got = eval(_inp)
            except SyntaxError:
                _ns = {{}}
                exec(_inp, _ns)
                _got = _ns.get("result", None)
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
