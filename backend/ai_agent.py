from typing import List, Dict
import os
import json
import requests
from dotenv import load_dotenv, find_dotenv

# Load environment variables from .env file
load_dotenv(find_dotenv())

class AIAgentService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        # Using gemini-2.0-flash as it is available in the user's plan
        self.api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
        
        if not self.api_key:
            print("⚠️ Warning: GEMINI_API_KEY (or GOOGLE_API_KEY) not found. AI Chat will use mock responses.")

    async def get_socratic_response(self, messages: List[Dict[str, str]], problem_context: str) -> str:
        """
        Generates a Socratic response using Google Gemini API.
        """
        
        system_prompt = f"""You are a Socratic coding tutor.
Validation Context:
{problem_context}

Rules:
1. Never give the answer directly.
2. Ask probing questions to guide the student.
3. If the student is stuck, give a small hint.
4. Be encouraging but firm on not writing code for them.
5. Keep responses concise and conversational.
"""
        
        # If no API key, return mock
        if not self.api_key:
            last_user_msg = messages[-1]['content'] if messages else ""
            return f"[MOCK AI] I see you're asking about '{last_user_msg}'. Set GEMINI_API_KEY to get real Socratic guidance!"

        # Prepare payload for Gemini API
        # Gemini expects: { "contents": [ { "parts": [ {"text": "..."} ] } ], "systemInstruction": ... }
        
        # We'll construct a chat session
        contents = []
        
        # Add conversation history
        for m in messages:
            role = "model" if m["role"] == "assistant" else "user"
            contents.append({
                "role": role,
                "parts": [{"text": m["content"]}]
            })

        payload = {
            "contents": contents,
            "systemInstruction": {
                "parts": [{"text": system_prompt}]
            },
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 300
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
            return data["candidates"][0]["content"]["parts"][0]["text"]
                
        except requests.exceptions.HTTPError as e:
            print(f"Gemini API Error: {e.response.text}")
            return f"I'm having trouble connecting to my brain right now. (Error: {e})"
        except Exception as e:
            print(f"AI Service Error: {e}")
            return "Sorry, something went wrong with the AI service."
