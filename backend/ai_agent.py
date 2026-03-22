from typing import List, Dict, Optional
import os
import json
import requests
from dotenv import load_dotenv, find_dotenv

# Load environment variables from .env file
load_dotenv(find_dotenv())

class AIAgentService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        # Fallback to gemini-2.5-flash which was found in the user's available models list
        self.api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
        
        if not self.api_key:
            print("⚠️ Warning: GEMINI_API_KEY (or GOOGLE_API_KEY) not found. AI Chat will use mock responses.")

    async def get_socratic_response(self, messages: List[Dict[str, str]], problem_context: str, current_code: str = "", user_level: Optional[str] = None, test_results: Optional[str] = None) -> Dict[str, str]:
        """
        Generates a Socratic response using Google Gemini API.
        Returns a dict with 'response', and optionally 'level', 'lacking_areas', 'teacher_suggestions'.
        """
        
        # Determine Phase
        is_assessment = len(messages) <= 6 # 3 user messages + 3 bot messages
        
        if is_assessment:
            system_prompt = f"""You are a Socratic coding tutor assessing a student.
Problem Context:
{problem_context}

Rules for Assessment Phase:
1. Ask a SINGLE conceptual question to gauge their understanding of the problem or algorithms.
2. Wait for their answer. NEVER give the code or direct solution.
3. Keep your response very concise, encouraging, and format code or variable names using markdown backticks.
4. If this is their 3rd answer, you MUST define their level as Beginner, Intermediate, or Advanced.
5. Output strict JSON format: {{"response": "your conversational reply to the student", "level": "optional level"}}
"""
        else:
            system_prompt = f"""You are a Socratic coding tutor.
Problem Context:
{problem_context}
Student Level: {user_level or 'Unknown'}
Test Results (Recent Execution):
{test_results or 'No recent run.'}

Student's Current Code:
```python
{current_code}
```

Rules for Guidance Phase:
1. Guide the student based on their Current Code, Level, and specific Test Failures. NEVER give the exact code solution.
2. Ask leading questions that address the root cause of the failures (e.g. "I notice test 2 failed because it expected 5 but got 4. What happens when the input is 0?").
3. Provide small, precise hints using markdown for code elements.
4. Keep your response conversational, encouraging, and concise.
5. Output strict JSON format with these exact keys: 
   - "response": your conversational reply to the student, properly formatting any code snippets in markdown.
   - "lacking_areas": short note for the teacher on what the student is struggling with based on their code.
   - "teacher_suggestions": actionable advice for the teacher to help this student.
"""

        # If no API key, return mock JSON
        if not self.api_key:
            return {
                "response": "I see you're asking about that. Set GEMINI_API_KEY to get real Socratic guidance!",
                "level": "Beginner",
                "lacking_areas": "Needs API Key",
                "teacher_suggestions": "Add an API key to the .env file."
            }

        contents = [
            {"role": "user", "parts": [{"text": system_prompt}]},
            {"role": "model", "parts": [{"text": '{"response": "Understood. I will strictly output JSON."}'}]}
        ]
        
        for m in messages:
            role = "model" if m["role"] == "assistant" else "user"
            contents.append({
                "role": role,
                "parts": [{"text": m["content"]}]
            })

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 400,
                "responseMimeType": "application/json"
            }
        }

        try:
            response = requests.post(
                f"{self.api_url}?key={self.api_key}",
                headers={"Content-Type": "application/json"},
                json=payload
            )
            
            response.raise_for_status()
            data = response.json()
            
            # Extract text from response
            text_resp = data["candidates"][0]["content"]["parts"][0]["text"]
            
            # Parse JSON from Gemini
            try:
                result = json.loads(text_resp)
                return result
            except json.JSONDecodeError:
                print(f"Failed to parse Gemini JSON: {text_resp}")
                return {"response": text_resp}
                
        except requests.exceptions.HTTPError as e:
            err_txt = e.response.text if hasattr(e, 'response') and hasattr(e.response, 'text') else str(e)
            print(f"Gemini API Error: {err_txt}")
            return {"response": f"I'm having trouble connecting to my brain right now. (Error details: {err_txt})"}
        except Exception as e:
            print(f"AI Service Error: {e}")
            return {"response": "Sorry, something went wrong with the AI service."}

    async def get_progressive_hint(self, level: int, problem_context: str, current_code: str, test_results: Optional[str] = None) -> Dict[str, str]:
        """
        Generates a level-specific hint (1: Conceptual, 2: Logic, 3: Snippet).
        """
        prompts = {
            1: "Goal: Conceptual. Ask a question about the algorithm or approach. Do not mention code specifics.",
            2: "Goal: Logic. Point out a specific logical flaw or missing edge case in their code. Very brief.",
            3: "Goal: Snippet Pattern. Suggest a specific built-in function or a 1-2 line pattern (e.g. a list comprehension structure) that might help. No solution."
        }
        
        goal = prompts.get(level, prompts[1])
        
        system_prompt = f"""You are an efficient coding coach.
Problem Context: {problem_context}
Student Code:
```python
{current_code}
```
Test Results: {test_results or 'None'}

Your Task: {goal}
Rules:
1. Be extremely concise (MAX 2 sentences).
2. Never give the full code solution.
3. Format specifically as JSON: {{"hint": "your 1-2 sentence hint text"}}
"""
        
        if not self.api_key:
            return {"hint": f"Level {level} hint: Look at the problem again! (Set API key for real hints)"}

        try:
            payload = {
                "contents": [{"role": "user", "parts": [{"text": system_prompt}]}],
                "generationConfig": { "temperature": 0.4, "maxOutputTokens": 100, "responseMimeType": "application/json" }
            }
            response = requests.post(f"{self.api_url}?key={self.api_key}", json=payload)
            response.raise_for_status()
            data = response.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text)
        except Exception as e:
            print(f"Hint Service Error: {e}")
            return {"hint": "I'm stumped on this one. Try running your code again to see if you can debug it!"}
