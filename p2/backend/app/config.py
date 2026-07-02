import os

# 数据源模式:
#   auto    - 优先 akshare,失败自动降级 mock(响应 source 字段标注实际来源)
#   akshare - 只用 akshare,失败返回 502
#   mock    - 只用内置模拟数据(离线开发/演示)
DATA_SOURCE = os.getenv("P2_DATA_SOURCE", "auto").lower()

assert DATA_SOURCE in ("auto", "akshare", "mock"), f"非法 P2_DATA_SOURCE: {DATA_SOURCE}"
