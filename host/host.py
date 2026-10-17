import json
import os
import struct
import subprocess
import sys

# Native Messaging roda com PATH mínimo; yt-dlp/ffmpeg vêm do Homebrew.
os.environ["PATH"] = "/opt/homebrew/bin:/usr/local/bin:" + os.environ.get("PATH", "")

OUT = os.path.expanduser("~/Downloads/%(title).150B [%(id)s].%(ext)s")
BASE = [
    "yt-dlp", "--no-playlist", "--no-warnings",
    "-S", "vcodec:h264,res,acodec:m4a",  # h264+aac toca em qualquer player
    "--merge-output-format", "mp4",
    "-o", OUT, "--print", "after_move:filepath",
    "--progress", "--newline",
    "--progress-template", "PROGRESS %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s",
]


def parse_progress(line):
    """'PROGRESS baixado total estimado' -> porcentagem inteira, ou None."""
    p = line.split()
    if len(p) != 4 or p[0] != "PROGRESS":
        return None
    try:
        done = float(p[1])
        total = float(p[2]) if p[2] != "NA" else float(p[3])
    except ValueError:
        return None
    return min(100, int(done * 100 / total)) if total > 0 else None


def read_msg(stream):
    n = struct.unpack("=I", stream.read(4))[0]
    return json.loads(stream.read(n))


def write_msg(stream, obj):
    data = json.dumps(obj).encode()
    stream.write(struct.pack("=I", len(data)) + data)
    stream.flush()


def attempts(msg):
    """Comandos a tentar em ordem: URL da página, com cookies, URL direta."""
    opts = ["--playlist-items", str(msg["n"])] if msg.get("n") else []
    yield BASE + opts + [msg["url"]]
    if msg.get("browser"):
        yield BASE + opts + ["--cookies-from-browser", msg["browser"], msg["url"]]
    if msg.get("direct"):
        yield BASE + [msg["direct"]]


def download(msg, out):
    err = "nenhuma tentativa"
    for cmd in attempts(msg):
        p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        last, text = -1, []
        for line in p.stdout:
            pct = parse_progress(line)
            if pct is None:
                text.append(line.strip())
            elif pct != last:  # ponytail: ao mesclar vídeo+áudio a barra reinicia, sem % global
                last = pct
                write_msg(out, {"progress": pct})
        text = [t for t in text if t]
        if p.wait() == 0 and text:
            return {"ok": True, "file": text[-1]}
        err = "\n".join(text) or err
    return {"ok": False, "error": err}


if __name__ == "__main__":
    out = sys.stdout.buffer
    try:
        msg = read_msg(sys.stdin.buffer)
        if msg.get("reveal"):
            write_msg(out, {"ok": subprocess.run(["open", "-R", msg["reveal"]]).returncode == 0})
        else:
            write_msg(out, download(msg, out))
    except FileNotFoundError:
        write_msg(out, {"ok": False, "error": "yt-dlp não encontrado (rode install.sh)"})
