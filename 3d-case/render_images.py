"""Render the README images of the case. Needs the FreeCAD GUI (it saves screenshots).

Run in the FreeCAD Python console:
    p = "/path/to/3d-case/render_images.py"; exec(open(p).read(), {"__file__": p})

Builds the model with formguard_case.py (no export), copies the parts into a clean scene and
writes images/case_*.png.
"""
import os

import FreeCAD as App
import FreeCADGui as Gui
import Part

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else \
    "/Users/lehangajanayake/Projects/formguard-booth/3d-case"
IMAGES = os.path.join(HERE, "images")
SIZE = (1600, 1100)
BACKGROUND = "#F2EDE4"                    # FormGuard Chalk (design system --ground)

# case in dark greys (it prints in black or dark grey PETG), the battery plug in Plate Red
COLORS = {"Base": (0.27, 0.26, 0.24), "Lid": (0.46, 0.44, 0.41),
          "Battery": (0.74, 0.73, 0.70), "Socket": (0.93, 0.92, 0.88), "Plug": (0.78, 0.17, 0.13),
          "Screw": (0.55, 0.55, 0.57)}

_case = os.path.join(HERE, "formguard_case.py")
exec(open(_case).read(), {"__file__": _case, "NO_EXPORT": True})   # build only, no export
src = App.getDocument("FormGuardCase")


# the XIAO STEP has no colours, so colour its parts by their labels
XIAO_COLORS = [("Shield", (0.76, 0.77, 0.79)), ("CHAMFER", (0.76, 0.77, 0.79)),   # RF shield, USB-C shell
               ("MIRROR", (0.76, 0.77, 0.79)), ("CUT-EXTRUDE", (0.76, 0.77, 0.79)),
               ("BOSS-EXTRUDE", (0.70, 0.62, 0.40)), ("Pins", (0.76, 0.77, 0.79)),
               ("Silkscreen", (0.93, 0.92, 0.88)), ("LED", (0.95, 0.95, 0.95)), ("USR", (0.95, 0.95, 0.95)),
               ("CAP", (0.72, 0.60, 0.42)), ("ANT", (0.90, 0.89, 0.85)), ("Body", (0.20, 0.20, 0.21))]
PCB_COLOR, PAD_COLOR = (0.13, 0.13, 0.14), (0.83, 0.66, 0.30)


def xiao_parts():
    """The board's leaf parts in case coordinates, coloured."""
    leaves = []
    for o in src.Objects:
        if o.TypeId != "Part::Feature" or o.Name in ("Base", "Lid") or o.Name.endswith("_ref") \
                or o.Name.startswith("Screw_ref") or not o.Shape.Solids:
            continue
        s = o.Shape.copy()
        s.Placement = o.getGlobalPlacement()
        leaves.append((o.Label, s))
    pcb = max((s for label, s in leaves if label.startswith("COMPOUND")), key=lambda s: s.Volume)
    out = []
    for label, s in leaves:
        color = next((c for prefix, c in XIAO_COLORS if label.startswith(prefix)), None)
        if color is None:
            color = PCB_COLOR if s is pcb else PAD_COLOR      # the other COMPOUNDs are pads
        out.append((s, color))
    return out


def scene(name, items, clip=None, turn=0):
    """items: [(label, shape, colour, offset vector)]; clip: a box to cut away;
    turn: degrees about Z, to choose which end faces the camera."""
    if App.listDocuments().get(name):
        App.closeDocument(name)
    doc = App.newDocument(name)
    for i, (label, shape, color, offset) in enumerate(items):
        s = shape.copy()
        if offset:
            s.translate(offset)
        if turn:
            s.rotate(App.Vector(), App.Vector(0, 0, 1), turn)
        if clip is not None:
            s = s.cut(clip)
            if s.isNull() or s.Volume < 1e-6:
                continue
        o = doc.addObject("Part::Feature", f"{label}{i}")
        o.Shape = s
        o.ViewObject.ShapeColor = color
        o.ViewObject.LineColor = (0.1, 0.1, 0.1)
    doc.recompute()
    return doc


def autocrop(path, margin=50):
    """Crop the image to what isn't background, plus a margin."""
    from PySide import QtGui
    img = QtGui.QImage(path)
    bg = img.pixel(0, 0)
    xs, ys = [], []
    for y in range(0, img.height(), 2):
        for x in range(0, img.width(), 2):
            if img.pixel(x, y) != bg:
                xs.append(x); ys.append(y)
    x0, y0 = max(min(xs) - margin, 0), max(min(ys) - margin, 0)
    x1, y1 = min(max(xs) + margin, img.width()), min(max(ys) + margin, img.height())
    img.copy(x0, y0, x1 - x0, y1 - y0).save(path)


def shoot(doc, filename, view):
    Gui.ActiveDocument = Gui.getDocument(doc.Name)
    v = Gui.ActiveDocument.ActiveView
    v.setAnimationEnabled(False)
    getattr(v, view)()
    v.fitAll()
    os.makedirs(IMAGES, exist_ok=True)
    path = os.path.join(IMAGES, filename)
    v.saveImage(path, SIZE[0], SIZE[1], BACKGROUND)
    autocrop(path)
    App.closeDocument(doc.Name)


def case_items(offsets=None, lid=True, screws=True):
    offsets = offsets or {}
    sh = lambda n: src.getObject(n).Shape
    items = [("Base", sh("Base"), COLORS["Base"], offsets.get("Base")),
             ("Battery", sh("Battery_ref"), COLORS["Battery"], offsets.get("Base"))]
    board_off = offsets.get("Board")
    items += [("Board", s, c, board_off) for s, c in xiao_parts()]
    items += [("Socket", sh("Socket_ref"), COLORS["Socket"], board_off),
              ("Plug", sh("Plug_ref"), COLORS["Plug"], board_off)]
    if lid:
        items.append(("Lid", sh("Lid"), COLORS["Lid"], offsets.get("Lid")))
    if screws:
        items += [("Screw", src.getObject(f"Screw_ref{i}").Shape, COLORS["Screw"], offsets.get("Screw"))
                  for i in range(4)]
    return items


V = App.Vector
# 1. assembled, turned so the USB-C end faces the camera
shoot(scene("R_assembled", case_items(), turn=180), "case_assembled.png", "viewIsometric")

# 2. exploded: base + battery, board, lid, screws
shoot(scene("R_exploded", case_items({"Board": V(0, 0, 22), "Lid": V(0, 0, 38), "Screw": V(0, 0, 50)}),
            turn=180), "case_exploded.png", "viewIsometric")

# 3. cut-away through the socket and plug, seen from the front (-Y)
cut = Part.makeBox(200, 100, 100, V(-100, -100 + 2.0, -10))
shoot(scene("R_section", case_items(screws=False), clip=cut), "case_section.png", "viewFront")

# 4. lid upside down with the board clipped in
flip = App.Placement(V(0, 0, 0), App.Rotation(V(1, 0, 0), 180)).toMatrix()
items = [("Lid", src.getObject("Lid").Shape.transformGeometry(flip), COLORS["Lid"], None)]
items += [("Board", s.transformGeometry(flip), c, None) for s, c in xiao_parts()]
items += [(n, src.getObject(f"{n}_ref").Shape.transformGeometry(flip), COLORS[n], None)
          for n in ("Socket", "Plug")]
shoot(scene("R_lid", items), "case_lid_board.png", "viewIsometric")

print("wrote", sorted(f for f in os.listdir(IMAGES) if f.startswith("case_")))
