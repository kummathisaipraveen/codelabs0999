import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TestCase {
  input: string;
  expected: string;
}

interface TestResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
}

function executeUserCode(code: string, input: string, timeoutMs = 5000): string {
  // The user code is expected to define a function called `solution`
  // We wrap it and call solution(input)
  const wrappedCode = `
    ${code}
    if (typeof solution !== 'function') {
      throw new Error('Your code must define a function called "solution"');
    }
    return String(solution(${input}));
  `;

  try {
    const fn = new Function(wrappedCode);
    // Simple timeout via synchronous execution (Deno edge functions are single-threaded)
    const start = Date.now();
    const result = fn();
    if (Date.now() - start > timeoutMs) {
      return "__TIMEOUT__";
    }
    return String(result);
  } catch (err) {
    return `__ERROR__: ${err instanceof Error ? err.message : "Runtime error"}`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseAuth.auth.getClaims(token);
    if (authError || !data?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = data.claims.sub as string;

    // Parse request
    const { problem_id, code } = await req.json();

    if (!problem_id || typeof problem_id !== "number") {
      return new Response(
        JSON.stringify({ error: "Invalid problem_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!code || typeof code !== "string" || code.length > 50000) {
      return new Response(
        JSON.stringify({ error: "Invalid or too large code submission" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch test cases using service role (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: problem, error: problemError } = await supabaseAdmin
      .from("problems")
      .select("test_cases, difficulty")
      .eq("id", problem_id)
      .single();

    if (problemError || !problem) {
      return new Response(
        JSON.stringify({ error: "Problem not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const testCases = (problem.test_cases as unknown as TestCase[]) || [];

    if (testCases.length === 0) {
      return new Response(
        JSON.stringify({ error: "No test cases configured for this problem" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute code against each test case
    const results: TestResult[] = testCases.map((tc) => {
      const actual = executeUserCode(code, tc.input);
      const passed =
        !actual.startsWith("__ERROR__") &&
        actual !== "__TIMEOUT__" &&
        actual.trim() === tc.expected.trim();

      return {
        input: tc.input,
        expected: tc.expected,
        actual: actual.startsWith("__ERROR__") ? actual.replace("__ERROR__: ", "") : actual === "__TIMEOUT__" ? "Timeout" : actual,
        passed,
      };
    });

    const testsPassed = results.filter((r) => r.passed).length;
    const testsTotal = results.length;

    // Calculate points
    const points = (() => {
      const base = problem.difficulty === "Easy" ? 10 : problem.difficulty === "Medium" ? 20 : problem.difficulty === "Hard" ? 30 : 10;
      return testsPassed < testsTotal ? Math.floor((base * testsPassed) / Math.max(testsTotal, 1)) : base;
    })();

    // Check if already solved
    const { data: existingSolve } = await supabaseAdmin
      .from("submissions")
      .select("id")
      .eq("user_id", userId)
      .eq("problem_id", problem_id)
      .eq("tests_passed", testsTotal)
      .limit(1);

    const alreadySolved = (existingSolve?.length ?? 0) > 0;

    // Insert submission
    const { data: submission, error: subError } = await supabaseAdmin
      .from("submissions")
      .insert({
        user_id: userId,
        problem_id,
        code,
        score: points,
        tests_passed: testsPassed,
        tests_total: testsTotal,
      })
      .select("id")
      .single();

    if (subError) {
      console.error("Submission insert error:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to save submission" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update points for new full solves
    if (testsPassed === testsTotal && !alreadySolved) {
      const { data: userPoints } = await supabaseAdmin
        .from("user_points")
        .select("current_streak, last_solved_at")
        .eq("user_id", userId)
        .single();

      let streak = 1;
      if (userPoints?.last_solved_at) {
        const gap = Date.now() - new Date(userPoints.last_solved_at).getTime();
        if (gap < 48 * 60 * 60 * 1000) {
          streak = (userPoints.current_streak || 0) + 1;
        }
      }

      await supabaseAdmin.rpc("submit_solution", {
        p_problem_id: problem_id,
        p_code: code,
        p_tests_passed: testsPassed,
        p_tests_total: testsTotal,
      });
    }

    return new Response(
      JSON.stringify({
        results,
        tests_passed: testsPassed,
        tests_total: testsTotal,
        score: points,
        submission_id: submission.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("execute-code error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
