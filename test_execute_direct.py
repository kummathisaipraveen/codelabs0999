import sys
sys.path.append('.')
from backend.execution import ExecutionService

service = ExecutionService()
res = service.execute_code(
    "def twoSum(nums, target):\n    return [0, 1]",
    [{"input": "[2,7,11,15],9", "output": "[0,1]"}]
)
import json
print(json.dumps(res, indent=2))
