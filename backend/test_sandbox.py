import sys
from execution import ExecutionService

service = ExecutionService()

# 1. Test Network Access (Should fail due to --network none)
code_network = """
import urllib.request
try:
    urllib.request.urlopen("http://google.com", timeout=2)
    result = "NETWORK_SUCCESS"
except Exception as e:
    result = "NETWORK_FAIL"
"""

print("Testing Network Constraint...")
res_net = service.execute_code(code_network, [{"input": "None", "expected": "NETWORK_FAIL"}])
print(res_net)

# 2. Test File System Access (Should see only the container's isolated FS, not the host's C:\)
code_fs = """
import os
try:
    # Look at root
    files = os.listdir('/')
    result = "ISOLATED_FS_SUCCESS" if "app" in files and "bin" in files else "HOST_FS_DETECTED"
except Exception as e:
    result = f"FS_ERROR: {str(e)}"
"""

print("Testing FS Constraint...")
res_fs = service.execute_code(code_fs, [{"input": "None", "expected": "ISOLATED_FS_SUCCESS"}])
print(res_fs)
