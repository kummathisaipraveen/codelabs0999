import requests
import os
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

payload = {
    "contents": [{"role": "user", "parts": [{"text": "Hello"}]}],
    "systemInstruction": {
        "parts": [{"text": "You are a Socratic tutor."}]
    },
    "generationConfig": {
        "temperature": 0.7,
        "maxOutputTokens": 300
    }
}

res = requests.post(
    f"{api_url}?key={api_key}",
    headers={"Content-Type": "application/json"},
    json=payload
)
print("Status:", res.status_code)
print(res.text)
