from typing import List, Dict
import os
import json
import requests
from dotenv import load_dotenv, find_dotenv
import typing

# Load environment variables from .env file
load_dotenv(find_dotenv())

class AIAgentService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        # Fallback to gemini-2.5-flash which was found in the user's available models list
        self.api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
        
        if not self.api_key:
            print("⚠️ Warning: GEMINI_API_KEY (or GOOGLE_API_KEY) not found. AI Chat will use mock responses.")

    async def get_socratic_response(self, messages: List[Dict[str, str]], problem_context: str, current_code: str = "", user_level: typing.Optional[str] = None) -> Dict[str, str]:
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
1. Ask a conceptual question (1 at a time) to gauge their understanding of the problem or algorithms.
2. Wait for their answer. Do not give the code.
3. If this is their 3rd answer, you MUST define their level as Beginner, Intermediate, or Advanced.
4. Output strict JSON with keys: "response" (your chat reply), and optionally "level" (only if you have assessed them).
"""
        else:
            system_prompt = f"""You are a Socratic coding tutor.
Problem Context:
{problem_context}
Student Level: {user_level or 'Unknown'}
Student's Current Code:
```python
{current_code}
```

Rules for Guidance Phase:
1. Guide the student based on their Current Code and Level. Never give the answer directly.
2. Output strict JSON with keys: 
   - "response" (your conversational reply to the student)
   - "lacking_areas" (short note for the teacher on what the student is struggling with based on their code)
   - "teacher_suggestions" (actionable advice for the teacher to help this student)
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
