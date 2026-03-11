import requests
import json

data = {"messages":[{"role":"user","content":"test"}],"problem_context":"test"}
res = requests.post("http://localhost:8000/chat", json=data)
print("Status:", res.status_code)
print(res.text)
