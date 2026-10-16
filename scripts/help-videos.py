#!/usr/bin/env python3
"""Refreshes the Ajuda's tutorial videos from the video projects (videos/tutorial-*).

Usage, from the repository root of a checkout that has the videos/ folder:
    python3 scripts/help-videos.py [path/to/videos]

For each tutorial that has a render (videos/<proj>/renders/<proj>.mp4) it writes a light
version to public/ajuda/videos/<id>-<hash>.mp4 (the same settings as
videos/central-tutoriais/gerar.py) and regenerates src/lib/help/tutorials.ts with the
chapters and the narration. Old files of the same tutorial are removed. Review the diff,
run the tests (tests/help-content.test.ts) and commit.
"""
import hashlib, importlib.util, json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "videos"
OUT = ROOT / "public" / "ajuda" / "videos"
spec = importlib.util.spec_from_file_location("gerar", V / "central-tutoriais" / "gerar.py")
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)
OUT.mkdir(parents=True, exist_ok=True)

# Hints from gerar.py that the Console contradicts (checked in the code); fixed here so a refresh keeps them right.
HINT_FIXES = {"No menu das suas iniciais.": "No menu da sua conta, na sua foto no fim da barra."}

items = []
page = (V / "tutorial-assinatura" / "pagina" / "assinatura-no-console.html").read_text()
for t in [*g.TUTORIAIS, g.ASSINATURA]:
    proj, slug = t["proj"], t["slug"]
    src = V / proj / "renders" / f"{proj}.mp4"
    if not src.exists():
        continue
    cap = json.loads((V / proj / "capitulos.json").read_text())
    if slug == "assinatura":
        steps = [dict(title=tt, hint=h, start=float(s)) for _, tt, h, s in re.findall(r'\{ n: (\d+), title: "([^"]+)", hint: "([^"]+)", start: ([\d.]+) \}', page)]
        script = [[float(a), x] for a, x in re.findall(r'\[([\d.]+), "([^"]+)"\]', page)]
    else:
        sc, vt = g.script_of(proj), g.voice_times(proj)
        steps = [dict(title=c["title"], hint=HINT_FIXES.get(t["hints"][c["step"] - 1], t["hints"][c["step"] - 1]), start=c["start"]) for c in cap["chapters"]]
        script = [[round(vt[k], 1), sc[k]] for k in sorted(sc) if k in vt]
    tmp = OUT / f"{slug}.tmp.mp4"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-maxrate", "650k", "-bufsize", "1300k",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", str(tmp)], check=True)
    digest = hashlib.sha256(tmp.read_bytes()).hexdigest()[:10]
    for old in OUT.glob(f"{slug}-*.mp4"):
        old.unlink()
    tmp.rename(OUT / f"{slug}-{digest}.mp4")
    items.append(dict(id=slug, title=t["title"], description=t["desc"], src=f"/ajuda/videos/{slug}-{digest}.mp4", duration=cap["duration"], chapters=steps, transcript=script))

q = lambda s: json.dumps(s, ensure_ascii=False)
entries = []
for it in items:
    chapters = ",\n      ".join(f"{{ title: {q(c['title'])}, hint: {q(c['hint'])}, start: {c['start']} }}" for c in it["chapters"])
    transcript = ",\n      ".join(f"[{a}, {q(x)}]" for a, x in it["transcript"])
    entries.append(f"""  {{
    id: {q(it['id'])},
    title: {q(it['title'])},
    description: {q(it['description'])},
    src: {q(it['src'])},
    duration: {it['duration']},
    chapters: [
      {chapters},
    ],
    transcript: [
      {transcript},
    ],
  }}""")
target = ROOT / "src" / "lib" / "help" / "tutorials.ts"
text = target.read_text()
start = text.index("export const TUTORIALS: Tutorial[] = [")
end = text.index("\n];", start) + 3
target.write_text(text[:start] + "export const TUTORIALS: Tutorial[] = [\n" + ",\n".join(entries) + ",\n];" + text[end:])
print("\n".join(f"{i['id']}: {i['src']}" for i in items))
