# Logos

The FormGuard logo is **A · Rack F**. The F is a power rack seen side-on: upright, J-hook, safety arm. It holds the bar, in **Plate Red**, in a socket. In the horizontal lockup that F is also the first letter of FORMGUARD. All files are outlined shapes, so no font is needed.

These files are copied from the brand kit (`/brand` in the website repo, exported by `logo/tools/export_brand.py`). On the website every logo renders through the one `<Logo>` component. **Never redraw, retype, re-space or "improve" the logo.**

## The files

| Files | Use |
| --- | --- |
| `formguard-lockup-{primary,reversed,iron,chalk}.svg` | Horizontal lockup (drop-cap). The default: headers, footers, documents. |
| `formguard-stacked-{…}.svg` | Stacked lockup. Square-ish spaces: posters, splash screens. |
| `formguard-symbol-{…}.svg` | Symbol, master artwork. Avatars, the suit's chest, app icons. **48px and up.** |
| `formguard-symbol-32-{…}.svg` | Symbol, 32px cut, for 32–47px. Pixel-drawn: stem 6, arms 5, bar ⌀8. |
| `formguard-symbol-16-{…}.svg` | Symbol, 16px cut, for 16–31px. Pixel-drawn: stem 3, arms 2, bar ⌀4. |
| `formguard-favicon.svg` | Browser tab: the 32px cut, Iron on light tabs, Chalk on dark. |
| `formguard-app-icon.svg`, `formguard-apple-touch-icon.svg` | App icon and home-screen icon. |

## Colourways

| Colourway | Use it on | Colours |
| --- | --- | --- |
| `primary` | Light backgrounds | Iron Black `#1B1A17` + Plate Red `#C62B22` bar |
| `reversed` | Dark backgrounds | Chalk `#F2EDE4` + Plate Red bar |
| `iron` | One-colour jobs on light: print, engraving | Iron Black only |
| `chalk` | One-colour jobs on dark or on Plate Red: embroidery on the suit, screen print | Chalk only |

Plate Red is **only ever the bar**. The F, the word and the clear space are never red, and no version of the logo is all red.

## Size

| Rendered symbol height | Use |
| --- | --- |
| 48px and up | master |
| 32–47px | 32px cut |
| 16–31px | 16px cut |
| under 16px | don't |

Minimums: horizontal lockup 24px tall on screen (about 190px wide) or 8mm in print; stacked lockup 72px tall (20mm); symbol 16px with the 16px cut.

## Clear space

The unit is the bar's diameter, **0.32 × the symbol's height** (in the lockup, measured on the drop-cap F). Keep at least one unit clear on every side.

## Don't

- Redraw, re-kern, retype or re-space anything, or separate the drop-cap F from ORMGUARD.
- Put the symbol next to the horizontal lockup ("F FORMGUARD"). Use one or the other.
- Use the master symbol below 48px; use the cuts.
- Recolour: red is only the bar; one-colour versions are Iron or Chalk.
- Stretch, rotate or outline the logo, or add shadows, glows, gradients or textures.
- Put the logo in a container shape. The app icon's square is the only exception.

## Deprecated

The earlier F-with-a-dot-in-a-halo logo is retired. Its files are in `deprecated/` for reference only.
