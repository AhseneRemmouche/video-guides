#!/usr/bin/env python3
"""Tiny local server for the 30-day study plan.

Serves this folder (the plan + both course guides) at http://127.0.0.1:8777/
and mounts the Udemy video folder at /videos/ so the plan's Watch links play
in Edge/Chrome (which refuse to follow file:// links).

Just run it (or double-click study.bat). Leave the window open while you study.
"""
import os, re, sys, socket, mimetypes, urllib.parse, webbrowser
import http.server, socketserver

PORT = 8777
DOC = os.path.dirname(os.path.abspath(__file__))
VIDEO_ROOT = r"C:\NOW\AI"          # edit this if your courses move
PLAN = "one-month-plan.html"

mimetypes.add_type("video/mp4", ".mp4")


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = path.split("?", 1)[0].split("#", 1)[0]
        path = urllib.parse.unquote(path)
        if path.startswith("/videos/"):
            base, rel = VIDEO_ROOT, path[len("/videos/"):]
        else:
            base, rel = DOC, path.lstrip("/")
        parts = [p for p in rel.split("/") if p not in ("", ".", "..")]
        return os.path.join(base, *parts)

    # --- send_head with HTTP Range support (so you can seek in a lecture) ---
    def send_head(self):
        self._remaining = None
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None
        size = os.fstat(f.fileno()).st_size
        ctype = self.guess_type(path)
        rng = self.headers.get("Range")
        if rng:
            m = re.match(r"bytes=(\d*)-(\d*)", rng.strip())
            if m:
                start = int(m.group(1)) if m.group(1) else 0
                end = int(m.group(2)) if m.group(2) else size - 1
                end = min(end, size - 1)
                if start > end or start >= size:
                    self.send_error(416, "Requested Range Not Satisfiable")
                    f.close()
                    return None
                self.send_response(206)
                self.send_header("Content-Type", ctype)
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                self.send_header("Content-Length", str(end - start + 1))
                self.end_headers()
                f.seek(start)
                self._remaining = end - start + 1
                return f
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(size))
        self.end_headers()
        self._remaining = size
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "_remaining", None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        while remaining > 0:
            chunk = source.read(min(256 * 1024, remaining))
            if not chunk:
                break
            try:
                outputfile.write(chunk)
            except (BrokenPipeError, ConnectionResetError):
                break  # browser closed/seeked away — normal for video
            remaining -= len(chunk)

    def log_message(self, *a):
        pass  # keep the window quiet


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    if not os.path.isdir(VIDEO_ROOT):
        print("!! Video folder not found:", VIDEO_ROOT)
        print("   Edit VIDEO_ROOT at the top of serve-study.py to point at your courses.")
    url = f"http://127.0.0.1:{PORT}/{PLAN}"
    try:
        httpd = Server(("127.0.0.1", PORT), Handler)
    except OSError as e:
        # already running? just open the page.
        print("Could not start server on port", PORT, "-", e)
        print("If it's already running, your plan is at:", url)
        webbrowser.open(url)
        input("Press Enter to close...")
        return
    print("=" * 60)
    print(" Study plan ready:")
    print("   ", url)
    print(" Videos mounted at /videos/  ->", VIDEO_ROOT)
    print(" Keep this window open while you study. Close it to stop.")
    print("=" * 60)
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
