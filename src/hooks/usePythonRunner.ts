/**
 * usePythonRunner — Pyodide-based in-browser Python execution hook.
 *
 * Lazy-loads Pyodide from CDN on first use so it doesn't impact initial page load.
 * Runs Python code entirely in the browser (WebAssembly sandbox) — no Docker, no backend.
 */

import { useRef, useState, useCallback } from "react";

export interface TestCase {
    input: string;
    expected: string;
}

export interface TestResult {
    test_case: number;
    input: string;
    expected: string;
    actual: string;
    passed: boolean;
    error?: string;
    execution_time_ms: number;
}

export interface RunResult {
    status: "success" | "error" | "timeout";
    results: TestResult[];
    stdout: string;
    stderr: string;
    error?: string;
    total_time_ms: number;
}

// Track Pyodide load state outside React to prevent double-loading
let pyodideInstance: unknown = null;
let pyodideLoading: Promise<unknown> | null = null;

async function loadPyodideOnce(): Promise<unknown> {
    if (pyodideInstance) return pyodideInstance;
    if (pyodideLoading) return pyodideLoading;

    pyodideLoading = (async () => {
        // Dynamically inject the Pyodide script if not already present
        if (!document.getElementById("pyodide-script")) {
            await new Promise<void>((resolve, reject) => {
                const script = document.createElement("script");
                script.id = "pyodide-script";
                script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
                script.onload = () => resolve();
                script.onerror = () => reject(new Error("Failed to load Pyodide from CDN"));
                document.head.appendChild(script);
            });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const py = await (window as any).loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
        });
        pyodideInstance = py;
        return py;
    })();

    return pyodideLoading;
}

/**
 * Generates the test harness Python code injected after user's solution.
 * Captures stdout per test, measures execution time, and returns JSON results.
 */
function buildHarness(testCases: TestCase[]): string {
    const casesJson = JSON.stringify(testCases);
    return `
import json, sys, time, traceback
from io import StringIO

_test_cases = ${casesJson}
_results = []

for _i, _case in enumerate(_test_cases):
    _inp = _case.get("input", "")
    _exp = _case.get("expected", _case.get("output", ""))
    _start = time.time()
    _stdout_capture = StringIO()
    _old_stdout = sys.stdout
    sys.stdout = _stdout_capture
    try:
        # 1. Look for user-defined functions (only the ones in __main__ module)
        # Standard imports like json/sys/time etc. are modules and not part of __main__
        _funcs = [v for k, v in globals().items() 
                  if callable(v) and not k.startswith('_') 
                  and getattr(v, '__module__', '') == '__main__'
                  and k != 'buildHarness']
        
        if _funcs:
            _func = _funcs[0] # The FIRST user-defined function is almost always the solution
            try:
                # Handle inputs that are tuples/lists of args safely
                _args = eval("(" + str(_inp) + ",)")
                _got = _func(*_args)
            except TypeError:
                # Fallback: maybe input is a single arg not needing unpacking
                try:
                    _got = _func(eval(str(_inp)))
                except:
                    _got = eval(_inp)
        else:
            # Fallback for simple expressions or constant checks
            _got = eval(_inp)

        _elapsed = round((time.time() - _start) * 1000, 2)
        _actual = str(_got).strip()
        # Normalize whitespace for comparison to avoid false failures (e.g. [0, 1] vs [0,1])
        _passed = _actual.replace(" ", "").lower() == str(_exp).replace(" ", "").lower()
        _results.append({
            "test_case": _i + 1,
            "input": _inp,
            "expected": _exp,
            "actual": _actual,
            "passed": _passed,
            "execution_time_ms": _elapsed,
        })
    except Exception as _e:
        _elapsed = round((time.time() - _start) * 1000, 2)
        _results.append({
            "test_case": _i + 1,
            "input": _inp,
            "expected": _exp,
            "actual": "",
            "passed": False,
            "error": traceback.format_exc(),
            "execution_time_ms": _elapsed,
        })
    finally:
        sys.stdout = _old_stdout

print("__RESULTS__:" + json.dumps(_results))
`;
}

export function usePythonRunner() {
    const [isLoading, setIsLoading] = useState(false);
    const [isPyodideReady, setIsPyodideReady] = useState(!!pyodideInstance);
    const abortRef = useRef(false);

    const runCode = useCallback(async (code: string, testCases: TestCase[]): Promise<RunResult> => {
        setIsLoading(true);
        abortRef.current = false;
        const totalStart = performance.now();

        try {
            // Load Pyodide (cached after first load)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pyodide = await loadPyodideOnce() as any;
            setIsPyodideReady(true);

            if (abortRef.current) {
                return { status: "error", results: [], stdout: "", stderr: "", error: "Cancelled", total_time_ms: 0 };
            }

            // Capture stdout
            const stdoutLines: string[] = [];
            pyodide.setStdout({ batched: (s: string) => stdoutLines.push(s) });

            const stderrLines: string[] = [];
            pyodide.setStderr({ batched: (s: string) => stderrLines.push(s) });

            // Build & run the full program (user code + harness)
            const fullCode = code + "\n\n" + buildHarness(testCases);

            try {
                await pyodide.runPythonAsync(fullCode);
            } catch (pyErr) {
                // Syntax or top-level runtime error — not a per-test error
                const total_time_ms = Math.round(performance.now() - totalStart);
                return {
                    status: "error",
                    results: [],
                    stdout: stdoutLines.join("\n"),
                    stderr: stderrLines.join("\n"),
                    error: String(pyErr),
                    total_time_ms,
                };
            }

            // Extract structured results from stdout
            const allOutput = stdoutLines.join("\n");
            const resultLine = allOutput.split("\n").find(l => l.startsWith("__RESULTS__:"));
            if (!resultLine) {
                return {
                    status: "error",
                    results: [],
                    stdout: allOutput,
                    stderr: stderrLines.join("\n"),
                    error: "No results returned. Make sure your code defines a `solution(input)` function or uses the expected input format.",
                    total_time_ms: Math.round(performance.now() - totalStart),
                };
            }

            const results: TestResult[] = JSON.parse(resultLine.replace("__RESULTS__:", ""));
            const userOutput = allOutput.replace(resultLine, "").trim();

            return {
                status: "success",
                results,
                stdout: userOutput,
                stderr: stderrLines.join("\n"),
                total_time_ms: Math.round(performance.now() - totalStart),
            };

        } catch (err) {
            return {
                status: "error",
                results: [],
                stdout: "",
                stderr: "",
                error: err instanceof Error ? err.message : String(err),
                total_time_ms: Math.round(performance.now() - totalStart),
            };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const cancel = useCallback(() => { abortRef.current = true; }, []);

    return { runCode, isLoading, isPyodideReady, cancel };
}
