#!/usr/bin/env python3
"""
DOLPHLINK static-site builder
=============================
Assembles `index.html` (the deployable artifact) from the modular
templates under `templates/` plus the section ordering in
`build/manifest.json`. Designed to be reusable for any project
following the same engine + render + module structure: drop in your
own `content/content.json` + `content/seo.json`, swap your section
markup in `templates/`, edit `manifest.json`, and run
`python3 build/build.py`.

Two substitution passes:

1. File-include pass — `{{ TOKEN_NAME }}` (UPPERCASE) on its own line
   gets replaced with the contents of the file mapped to that token
   in `manifest.json`. Used for layout composition (head, nav, hero,
   footer, etc.).

2. SEO substitution pass — `{{ key.path }}` (lowercase, dotted)
   anywhere in the rendered output gets replaced with the value at
   that path in `content/seo.json`. The special `{{ jsonld }}` token
   expands to one or more `<script type="application/ld+json">`
   blocks, one per entry in `seo.json[jsonld]`. Used for brand SEO
   metadata (title, description, OG tags, structured data).

Usage:
    python3 build/build.py             # build to ../index.html
    python3 build/build.py --check     # build to a temp file and diff against ../index.html
    python3 build/build.py --out path  # build to a specific path

Why so minimal?
    The site is already SSR-baked (each section's HTML is fully
    rendered into the template) plus client-side hydrated from
    `content/content.json` at runtime. The build's only job is
    structural composition + brand metadata baking.
"""
from __future__ import annotations
import argparse
import html
import json
import re
import sys
import tempfile
from pathlib import Path


THIS = Path(__file__).resolve()
BUILD_DIR = THIS.parent
PROJECT_ROOT = BUILD_DIR.parent
TEMPLATES_DIR = PROJECT_ROOT / "templates"
MANIFEST_PATH = BUILD_DIR / "manifest.json"
SEO_PATH = PROJECT_ROOT / "content" / "seo.json"
# Optional supplementary data files. If present, they're merged into the
# substitution scope under their stem name (e.g. content/sme.json → "sme").
EXTRA_DATA_FILES = ["sme.json"]


def load_manifest() -> dict:
    with MANIFEST_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def read_template(name: str) -> str:
    path = TEMPLATES_DIR / name
    if not path.is_file():
        raise FileNotFoundError(f"template not found: {path}")
    return path.read_text(encoding="utf-8")


# --- Pass 1: file-include substitution -----------------------------------
# Match `{{ TOKEN_NAME }}` on its own line (with optional leading
# whitespace). Consume the trailing newline so the substituted block
# lines up flush with the surrounding markup.
TOKEN_RE = re.compile(r"^[ \t]*\{\{\s*([A-Z_]+)\s*\}\}[ \t]*\r?\n", re.M)


def render(layout: str, tokens: dict) -> str:
    """Replace each `{{ TOKEN }}` in `layout` with `tokens[TOKEN]`."""
    def sub(m: re.Match) -> str:
        name = m.group(1)
        if name not in tokens:
            raise KeyError(
                f"layout references unknown token {{{{ {name} }}}}"
                f" — add it to manifest.json[tokens]"
            )
        block = tokens[name]
        if not block.endswith("\n"):
            block += "\n"
        return block

    return TOKEN_RE.sub(sub, layout)


# --- Pass 2: data substitution -------------------------------------------
# Match `{{ a.b.c }}` (lowercase, dotted) anywhere in the rendered
# output. Substitutes against the merged data scope (seo.json + any
# extra namespaced files like content/sme.json).
#
# Two flavours, à la Mustache:
#   {{  a.b  }}   — HTML-escaped (default; safe for any text)
#   {{{ a.b }}}   — raw (use only for trusted markup like fineprint
#                  copy that intentionally contains an <a>).
JSON_PATH_RE = re.compile(r"\{\{\s*([a-z][\w.]*)\s*\}\}")
JSON_PATH_RAW_RE = re.compile(r"\{\{\{\s*([a-z][\w.]*)\s*\}\}\}")

# `{% each path %} ... {% endeach %}` — iterate over an array, expanding
# the body once per item. Inside the body, `this.X` refers to the
# current item's fields. Bodies are matched non-greedily so nested
# constructs work; nesting same-type loops is supported.
EACH_RE = re.compile(
    r"\{%\s*each\s+([a-z][\w.]*)\s*%\}(.*?)\{%\s*endeach\s*%\}",
    re.DOTALL
)

# `{% if path %} ... {% endif %}` — render body only when `path`
# resolves to a truthy value (non-empty string, true, non-empty array,
# non-zero number). No `else` branch. Use for optional flags / badges
# that only appear on some items in a loop (e.g. the "featured" plan
# in pricing).
IF_RE = re.compile(
    r"\{%\s*if\s+([a-z][\w.]*)\s*%\}(.*?)\{%\s*endif\s*%\}",
    re.DOTALL
)


def render_jsonld(blocks: list) -> str:
    """Emit each JSON-LD block as a <script type='application/ld+json'>
    element. Defends against </script> closure by escaping '</' inside
    the JSON payload."""
    out = []
    for block in blocks:
        text = json.dumps(block, indent=2, ensure_ascii=False)
        text = text.replace("</", "<\\/")
        # Indent inside <script> to match the surrounding head.html
        # leading-space style.
        indented = "\n".join(" " + line for line in text.splitlines())
        out.append(' <script type="application/ld+json">\n' + indented + "\n </script>")
    return "\n".join(out)


def _get_path(scope, path: str):
    """Walk a dotted path through nested dicts. Returns None if any
    segment is missing or the parent isn't a dict."""
    cur = scope
    for k in path.split("."):
        if isinstance(cur, dict):
            cur = cur.get(k)
        else:
            return None
    return cur


def _substitute_paths(text: str, scope) -> str:
    """Replace placeholders against `scope`:
      - `{{{ a.b }}}` (triple-brace) — RAW value, no HTML escape.
        Use only for trusted inline markup (e.g. fineprint with <a>).
      - `{{ a.b }}` (double-brace) — HTML-escaped (default; safe).
        Special token `{{ jsonld }}` expands to multiple <script> blocks.
    Triple-brace MUST be expanded first since `{{ ... }}` would
    otherwise greedily consume the inner part of `{{{ ... }}}`."""
    def sub_raw(m: re.Match) -> str:
        path = m.group(1)
        v = _get_path(scope, path)
        return "" if v is None else str(v)
    text = JSON_PATH_RAW_RE.sub(sub_raw, text)

    def sub(m: re.Match) -> str:
        path = m.group(1)
        if path == "jsonld":
            return render_jsonld(scope.get("jsonld", []) if isinstance(scope, dict) else [])
        v = _get_path(scope, path)
        if v is None:
            raise KeyError(
                f"data scope missing path: {path} "
                f"(referenced as {{{{ {path} }}}} in a template)"
            )
        return html.escape(str(v), quote=True)
    return JSON_PATH_RE.sub(sub, text)


def _expand_if(text: str, scope) -> str:
    """Expand `{% if path %} BODY {% endif %}`. Renders BODY only when
    `path` resolves to a truthy value in `scope`. Recurses to handle
    nested ifs."""
    def sub(m: re.Match) -> str:
        path, body = m.group(1), m.group(2)
        v = _get_path(scope, path)
        return _expand_if(body, scope) if v else ""
    return IF_RE.sub(sub, text)


def _expand_each(text: str, scope) -> str:
    """Expand `{% each path %} BODY {% endeach %}` blocks. For each
    item in the array at `path`, render BODY with `this` aliased to the
    item. Bodies may contain `{{ this.x }}` references, further
    `{{ a.b }}` references to top-level scope, nested `{% each %}` /
    `{% if %}` blocks. Non-array paths are treated as empty."""
    def sub(m: re.Match) -> str:
        path, body = m.group(1), m.group(2)
        items = _get_path(scope, path)
        if not isinstance(items, list):
            return ""
        out = []
        for item in items:
            inner_scope = dict(scope) if isinstance(scope, dict) else {}
            inner_scope["this"] = item
            # Order matters: ifs first (drop disabled blocks), then nested
            # eaches, then scalar substitutions.
            expanded = _expand_if(body, inner_scope)
            expanded = _expand_each(expanded, inner_scope)
            out.append(_substitute_paths(expanded, inner_scope))
        return "".join(out)
    return EACH_RE.sub(sub, text)


def substitute_seo(text: str, seo) -> str:
    """Apply pass 2: expand control blocks (`{% if %}`, `{% each %}`)
    then substitute `{{ x.y }}` scalar placeholders. The function is
    named `substitute_seo` for backward compatibility — the scope is
    now the merged seo + extra data."""
    if seo is None:
        return text
    text = _expand_if(text, seo)
    text = _expand_each(text, seo)
    return _substitute_paths(text, seo)


def load_seo():
    """Load content/seo.json as the substitution scope, then merge each
    file in EXTRA_DATA_FILES under its stem name (e.g. sme.json → key
    'sme'). Result: a single dict where templates can reference
    {{ sme.hero.h1 }} alongside {{ meta.title }}."""
    scope = {}
    if SEO_PATH.is_file():
        with SEO_PATH.open(encoding="utf-8") as f:
            scope.update(json.load(f))
    for fname in EXTRA_DATA_FILES:
        path = PROJECT_ROOT / "content" / fname
        if not path.is_file():
            continue
        with path.open(encoding="utf-8") as f:
            scope[Path(fname).stem] = json.load(f)
    return scope or None


def build_one(page_cfg: dict, seo) -> tuple[str, Path]:
    """Build a single page from its layout + tokens. Returns (rendered_html,
    absolute_output_path)."""
    layout = read_template(page_cfg["layout"])
    token_files = page_cfg.get("tokens", {})
    tokens = {name: read_template(fn) for name, fn in token_files.items()}
    out = render(layout, tokens) if tokens else layout
    out = substitute_seo(out, seo)
    out_path = (BUILD_DIR / page_cfg["output"]).resolve()
    return out, out_path


def build() -> str:
    """Backward-compat single-page build. Returns rendered HTML for the
    homepage; use build_all() for multi-page manifests."""
    manifest = load_manifest()
    seo = load_seo()
    if "pages" in manifest:
        # New multi-page format — return the FIRST page's render
        rendered, _ = build_one(manifest["pages"][0], seo)
        return rendered
    # Legacy single-output format
    return build_one(manifest, seo)[0]


def build_all() -> list:
    """Build every page declared in the manifest. Returns a list of
    (rendered_html, output_path) tuples — one per page."""
    manifest = load_manifest()
    seo = load_seo()
    if "pages" in manifest:
        return [build_one(p, seo) for p in manifest["pages"]]
    # Legacy single-output format — wrap as a single page
    return [build_one(manifest, seo)]


def main() -> int:
    ap = argparse.ArgumentParser(description="Build pages from templates/")
    ap.add_argument(
        "--out",
        default=None,
        help="Override output path of the FIRST page (default: from manifest.json)",
    )
    ap.add_argument(
        "--check",
        action="store_true",
        help="Build to temp files and diff against the existing outputs; exit non-zero on any diff",
    )
    args = ap.parse_args()

    pages = build_all()

    # If --out is set, only build the first page and write to that path.
    if args.out and not args.check:
        rendered, _ = pages[0]
        out_path = Path(args.out).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(rendered, encoding="utf-8")
        print(f"[build] wrote {out_path} ({len(rendered)} bytes)")
        return 0

    if args.check:
        any_diff = False
        for rendered, out_path in pages:
            existing = out_path.read_text(encoding="utf-8") if out_path.is_file() else ""
            if existing == rendered:
                print(f"[build] OK   — {out_path} matches templates ({len(rendered)} bytes)")
                continue
            any_diff = True
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", suffix=".html", delete=False
            ) as tf:
                tf.write(rendered)
                tmp_path = tf.name
            print(f"[build] DIFF — {out_path}", file=sys.stderr)
            print(
                f"           existing: {len(existing)} bytes / {existing.count(chr(10))} lines",
                file=sys.stderr,
            )
            print(
                f"           rebuilt:  {len(rendered)} bytes / {rendered.count(chr(10))} lines",
                file=sys.stderr,
            )
            print(f"           rebuilt written to: {tmp_path}", file=sys.stderr)
        return 1 if any_diff else 0

    # Normal mode — write every page to its declared output path.
    for rendered, out_path in pages:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(rendered, encoding="utf-8")
        print(f"[build] wrote {out_path} ({len(rendered)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
