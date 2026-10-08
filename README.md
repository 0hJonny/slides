# Slides — 0hJonny

All talks in one repository, in two themes: AI News light / AI News navy.
Colors are taken from the AI News Platform site (`frontend/src/src/assets/base.css`).

```
themes/ainews-light.css      white background, violet accent #6941c6
themes/ainews-navy.css       navy background #090d1f, accent #9365ff
talks/
  2026-10-20-tamachi-go/     one folder per talk
    slides.md
    img/
  _template/slides.md        starting point for a new talk
  _shared/                   files used by every talk (avatar.png)
new.sh                       creates a new talk from the template
build.sh                     builds all talks in both themes + index page
package.json                 pins the Marp CLI version
.github/workflows/           CI: builds HTML + PDF and publishes to GitHub Pages
.vscode/settings.json        registers the themes for the Marp preview in VS Code
```

## New talk

```bash
./new.sh 2026-11-05-localboast
```

Then edit `talks/2026-11-05-localboast/slides.md` and put its images in `img/`.
Put your avatar once in `talks/_shared/avatar.png`; every talk uses it.

## Preview in VS Code

1. Install the Marp for VS Code extension.
2. Open the whole repository folder so `.vscode/settings.json` is picked up.
3. Pick the theme with one line at the top of `slides.md`:

```yaml
theme: ainews-light   # or ainews-navy
```

If the preview still shows an old version of a theme, run
`Developer: Reload Window` from the command palette.

## Build locally

```bash
npm ci                                 # once, installs the local Marp CLI
./build.sh                             # all talks as HTML
./build.sh pdf                         # all talks as PDF (needs Chrome)
./build.sh all                         # HTML + PDF
./build.sh html 2026-10-20-tamachi-go  # one talk only
```

Output goes to `dist/`: `dist/index.html` lists every talk, and each talk
gets `light.html`, `navy.html` (and `.pdf`). `build.sh` sets the theme
itself and overrides the `theme:` line in the file.

On the day, open whichever version suits the room:
bright office with a projector -> light, dark room -> navy.

## Theme elements

```markdown
<!-- _class: title -->      title slide
<!-- _class: section -->    section divider
<!-- _class: profile -->    profile slide with a round avatar

<span class="pill">PR #5774</span>   pill, same as the tags on the site
*text*                               highlight in the accent color
```

## GitHub Actions and Pages

Every push to `main` runs `.github/workflows/slides.yml`:

1. installs Japanese fonts and the Marp CLI,
2. runs `./build.sh all` — every talk, both themes, HTML and PDF, plus the index,
3. publishes `dist/` to GitHub Pages,
4. also keeps the PDFs as a `slides-pdf` artifact on the run.

One-time setup: in the repository go to Settings -> Pages and set
Source to "GitHub Actions". You can also start the build by hand
from the Actions tab (Run workflow).
