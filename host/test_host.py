import io
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from host import attempts, parse_progress, read_msg, write_msg

assert parse_progress("PROGRESS 50 200 NA") == 25
assert parse_progress("PROGRESS 50 NA 100") == 50
assert parse_progress("PROGRESS 5 NA NA") is None
assert parse_progress("/Users/x/video.mp4") is None

buf = io.BytesIO()
write_msg(buf, {"url": "x", "n": 2})
buf.seek(0)
assert read_msg(buf) == {"url": "x", "n": 2}

a = list(attempts({"url": "U", "n": 2, "browser": "firefox", "direct": "D"}))
assert len(a) == 3
assert a[0][-3:] == ["--playlist-items", "2", "U"][-3:] and a[0][-1] == "U"
assert a[1][-3:] == ["--cookies-from-browser", "firefox", "U"]
assert a[2][-1] == "D" and "--playlist-items" not in a[2]
assert len(list(attempts({"url": "U"}))) == 1
print("ok")
