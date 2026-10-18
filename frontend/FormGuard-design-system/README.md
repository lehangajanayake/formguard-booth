**Coaching, without the coach.**

FormGuard helps lifters fix their form without a personal trainer. A full-body sensor suit tracks every joint and learns each lifter's own normal movement. It flags mistakes like knees caving, a rounding back, partial reps and form slipping with fatigue. Then it coaches mid-set: the suit buzzes at the joint that's off, and the earbuds say how to fix it.

It's built for everyday lifters who train alone and can't pay $70–120 a session for a trainer. They're serious about lifting, but they aren't influencers.

## Logo

The logo is **A · Rack F**: a power rack seen side-on (upright, J-hook, safety arm) that holds the bar, in **Plate Red**, in a socket. In the horizontal lockup that F is also the first letter of FORMGUARD.

- **Horizontal lockup (drop-cap):** the default. Headers, footers, documents.
- **Stacked lockup:** square-ish spaces: posters, splash screens.
- **Symbol:** avatars, the suit's chest, app icons. The master artwork is for 48px and up; use the pixel-drawn 32px cut for 32–47px and the 16px cut for 16–31px.
- **Primary** (Iron Black + red bar) on light, **reversed** (Chalk + red bar) on dark; **iron** and **chalk** one-colour versions for single-ink print, embroidery and engraving.
- **Clear space:** the bar's diameter (0.32 × the symbol's height) on every side. **Minimum size:** horizontal lockup 24px tall on screen (8mm in print); stacked 72px tall; symbol 16px with the 16px cut.
- Plate Red is only ever the bar. Never recolour, redraw or retype the logo.

All files and the full rules are in **Logos**. The earlier F-with-a-dot-in-a-halo logo is **deprecated** and kept for reference in `logos/deprecated/`.

## Personality

FormGuard is **precise, strong, honest and a bit understated**. It's a tool you trust, like a good barbell or a calibrated instrument. It is not hype, and it is not "AI magic".

| We are | We are not |
| --- | --- |
| Measured: we give the number, then the fix | Hype: "Crush your PRs!!" |
| Plain: "Your left knee caved on rep 6" | Mystical: "Our AI senses your energy" |
| Calm when something's wrong | Alarmed: red screens and warning sirens |
| Honest about what we don't know yet | Overclaiming certainty |

## Voice

- **Name the joint, the rep, and the fix.** "Left knee caved on rep 6. Push it out over your toes."
- **Short enough to hear mid-set.** Earbud cues are five words or fewer: "Knees out." "Chest up." "Full depth."
- **Judge against the lifter, not a textbook.** Say "Deeper than your normal." Don't say "Incorrect depth."
- **Reward with words and numbers, not colour.** A good set is "Clean set. 8/8 in range.", set in neutral `ink`.
- **Numbers in mono, words in sans.** A reading is a measurement, so set it like one: `12°`, `rep 6`, `−8%`.
- **Sentence case** everywhere except the `label` style, which is uppercase.
- **No exclamation marks, no emoji, no "revolutionary".**
- **Call to action:** "Become a test lifter." Explain it as helping build the form database, because that's what it is.

## Colour

The palette is the brand sheet's: **Chalk**, **Iron Black** and **Plate Red**, the colours of a chalked bar, iron plates and the one red plate on the rack. **Red is the only colour that means anything.** Everything else is neutral, so a fault is impossible to miss when you glance at your phone mid-set.

- **Neutral by default.** Build screens from `ground`, `ground-raised`, `ink`, `ink-muted` and `line`: Chalk and warm greys on light, Iron Black and warm greys on dark. A rep, a joint or a set within the lifter's normal range stays neutral. Good form is the expected state, so it gets no colour.
- **Plate Red (`signal`, `#C62B22`) marks the fault**: the joint that's off and the rep that slipped. It's also the logo's bar and the fill of the one primary button on a screen. It's the same red in both themes.
- **Text on a red fill** is always Chalk (`on-signal`, 4.8:1), never Iron Black.
- **Red text** uses `signal-ink`: Plate Red itself on light (4.8:1), and a lighter matched red on dark (`#EC6157`, 5.3:1), because Plate Red is too dark to read as text on Iron Black.
- **Red shapes on dark cards** (`ground-raised`) get a `signal-ink` edge, because Plate Red alone is just under 3:1 there.
- **Never colour alone.** A fault also gets its word ("Knees caving") and a shape: a filled dot for a fault, a hollow dot for in range.
- **Dark is the default in-app theme**, because the phone sits on a bench in a dim gym. Marketing pages default to light.

## Type

- **Archivo** (`display` family) for everything a person reads: it's sturdy and slightly industrial, with no flourish.
- **IBM Plex Mono** (`mono` family) for everything that's measured: angles, depth, tempo, rep counts. It makes readings look like instrument output.
- Both are free Google Fonts. Load them from Google Fonts at weights 400, 600, 700 and 800 (Archivo) and 400 and 500 (Plex Mono).

## Shape, space and states

- **Small radii** (`radius-sm` 2px, `radius-md` 4px): machined, not soft. Round shapes (`radius-full`) are reserved for dots, echoing the logo's round red bar: the joint marker and the Flag marker.
- **Hairlines, not shadows.** Separate layers with a `line` border.
- Spacing runs on a 4px base: `space-1` 4, `space-2` 8, `space-4` 16, `space-8` 32.
- **Big touch targets.** Controls are at least 48px tall: lifters tap with chalky, shaking hands between sets.
- **Focus ring:** 2px solid `ink`, offset 2px from the control. That's at least 15:1 on `ground` in both themes.
- **Disabled:** 40% opacity, no pointer.
- **No motion for its own sake.** The suit's buzz is the alert; the screen doesn't flash or pulse.

## Iconography

No icon set is chosen yet. When one is, use a 1.5px stroke, square ends and geometric shapes, drawn in `ink`. A fault icon switches to `signal-ink`. The logo's dot-in-a-halo is the one brand motif: use it only to mean "tracked" (see JointMarker).

## Components

- **Button:** `primary` (Plate Red) at most once per screen, for the one thing the screen is for. `secondary` (Iron Black on light, Chalk on dark) for other main actions, `quiet` for everything else.
- **Flag:** the status label. `fault` names the problem in red with a filled dot; `clear` says "In range" in neutral with a hollow dot.
- **Reading:** one measured value with its joint label, like a gauge. Turns `fault` only when the value is outside the lifter's normal range.
- **RepStrip:** every rep in a set as a bar of its depth. Clean reps are neutral; fault reps are red and numbered.
- **CueCard:** the coaching cue: the joint, the five-word cue, and the fix in one sentence.
- **JointMarker:** a joint on the body map: `idle`, `tracked` (a dot in a halo ring, like the logo) or `fault` (red).
