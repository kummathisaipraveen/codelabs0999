
import os
import requests
import json

def check_models():
    from dotenv import load_dotenv, find_dotenv
    load_dotenv(find_dotenv())
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not set.")
        return

    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            models = response.json().get("models", [])
            print("Available Models:")
            for m in models:
                if "generateContent" in m.get("supportedGenerationMethods", []):
                    print(f"- {m['name']}")
        else:
            print(f"Error: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    import sys
    # Redirect stdout to a file with utf-8 encoding
    with open("models_utf8.txt", "w", encoding="utf-8") as f:
        sys.stdout = f
        check_models()
