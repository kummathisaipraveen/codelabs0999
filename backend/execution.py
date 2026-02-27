import subprocess
import tempfile
import os
import json
import uuid
import sys
from typing import List, Dict, Any

class ExecutionService:
    def __init__(self):
        self.docker_image = "codecoach-python"
        self.docker_available = self._check_docker()

    def _check_docker(self) -> bool:
        """Checks if Docker daemon is running."""
        try:
            subprocess.run(["docker", "info"], check=True, capture_output=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Warning: Docker is not running or not installed. Code execution will fail.")
            return False

    def build_image(self):
        """Ensures the docker image is built."""
        if not self.docker_available:
            print("Skipping Docker build: Docker not available.")
            return

        try:
            subprocess.run(
                ["docker", "build", "-f", "Dockerfile.python", "-t", self.docker_image, "."],
                check=True,
                capture_output=True
            )
            print(f"Docker image {self.docker_image} built successfully.")
        except subprocess.CalledProcessError as e:
            print(f"Failed to build docker image: {e.stderr.decode()}")
            # Don't raise, just log.
            
    def execute_code(self, code: str, test_cases: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Executes code against test cases securely in Docker, or locally if Docker is missing.
        """
        
        # 1. Create a temporary directory for the execution
        with tempfile.TemporaryDirectory() as temp_dir:
            # 2. Write the user's code to solution.py
            #    We append a test runner harness to the user's code
            
            harness = self._generate_harness(test_cases)
            full_code = code + "\n\n" + harness
            
            code_path = os.path.join(temp_dir, "solution.py")
            with open(code_path, "w") as f:
                f.write(full_code)
                
            # 3. Run Code (Docker or Local Fallback)
            try:
                if self.docker_available:
                    cmd = [
                        "docker", "run", "--rm",
                        "--memory", "128m",
                        "--cpus", "0.5",
                        "--network", "none",
                        "-v", f"{temp_dir}:/app",
                        self.docker_image,
                        "python3", "solution.py"
                    ]
                else:
                    return {
                        "status": "error",
                        "error": "Execution environment (Docker) is currently unavailable for security reasons.",
                        "results": []
                    }

                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    timeout=5  # Hard timeout
                )
                
                stdout = result.stdout.decode()
                stderr = result.stderr.decode()
                
                if result.returncode != 0:
                     return {
                        "status": "error", 
                        "error": stderr or stdout or "Runtime Error",
                        "results": []
                    }

                # 4. Parse JSON output from our harness
                try:
                    if "__RESULTS_START__" in stdout:
                        json_str = stdout.split("__RESULTS_START__")[1].split("__RESULTS_END__")[0]
                        results = json.loads(json_str)
                        return {"status": "success", "results": results, "logs": stdout}
                    else:
                        return {"status": "error", "error": "No results returned from harness", "logs": stdout}
                        
                except json.JSONDecodeError:
                    return {"status": "error", "error": "Failed to parse execution results", "logs": stdout}

            except subprocess.TimeoutExpired:
                 return {"status": "timeout", "error": "Execution timed out", "results": []}
            except Exception as e:
                return {"status": "system_error", "error": str(e), "results": []}

    def _generate_harness(self, test_cases: List[Dict[str, str]]) -> str:
        """
        Generates Python code that imports the user solution and runs tests.
        Assumes user code is already in the file/environment.
        """
        test_cases_json = json.dumps(test_cases)
        
        return f"""
import json
import sys
import traceback

# Define the test cases
test_cases = {test_cases_json}

results = []

def run_tests():
    try:
        # Check if 'solution' function exists
        if 'solution' not in globals():
            print("Error: Function 'solution' not found.")
            return

        for i, case in enumerate(test_cases):
            inp = case['input']
            exp = case['expected']
            
            # Simple input parsing (assuming string input for now, adjust for args)
            # If input is comma separated, might need to parse args. 
            # For now, let's assume single argument or string input.
            
            try:
                # Capture stdout
                # We want to separate user output from system output
                
                # Execute
                got = solution(inp)
                
                # Compare (loose comparison for strings/numbers)
                passed = str(got).strip() == str(exp).strip()
                
                results.append({{
                    "test_case": i + 1,
                    "input": inp,
                    "expected": exp,
                    "actual": str(got),
                    "passed": passed
                }})
            except Exception as e:
                 results.append({{
                    "test_case": i + 1,
                    "input": inp,
                    "expected": exp,
                    "error": str(e),
                    "passed": False
                }})

        print("__RESULTS_START__")
        print(json.dumps(results))
        print("__RESULTS_END__")

    except Exception as e:
        traceback.print_exc()

if __name__ == "__main__":
    run_tests()
"""
