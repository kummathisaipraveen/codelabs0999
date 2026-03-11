import asyncio
import sys
import os

# Add backend directory to sys.path so we can import
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from ai_agent import AIAgentService

async def test_agent():
    service = AIAgentService()
    print("Agent initialized. Testing get_socratic_response...")
    
    messages = [
        {"role": "user", "content": "Hello, I need help with this code."}
    ]
    
    try:
        resp = await service.get_socratic_response(
            messages=messages,
            problem_context="Testing context",
            current_code="def test():\n    pass",
            user_level="Beginner"
        )
        print("Response received:", resp)
    except Exception as e:
        print("Exception occurred:", type(e).__name__, str(e))

if __name__ == "__main__":
    asyncio.run(test_agent())
