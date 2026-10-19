"""FormGuard sensor case: XIAO nRF52840 Sense + 400 mAh LiPo, stacked, 3 parts.

Run inside FreeCAD (GUI or freecadcmd):
    exec(open("/path/to/3d-case/formguard_case.py").read())

Parts, bottom to top:
  Base - battery tray; 4 screws come up through it into the deck
  Deck - frame with a fitted pocket for the XIAO; its floor keeps the battery down
  Lid  - clamps the board onto the deck ledge with ribs; LED window + reset hole;
         4 screws go down through it into the deck

Hardware: 8x M2x8 machine screws (button, pan or socket head) that thread straight
into printed pilot holes in the deck. No inserts or nuts.
Source dimensions are in reference/README.md.

Frame: origin at the centre of the case footprint, Z up, base bottom at z = 0.
The USB-C end of the board points to -X.
"""
import os

import FreeCAD as App
import Part

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else \
    "/Users/lehangajanayake/Projects/formguard-booth/3d-case"
OUT = os.path.join(HERE, "output")
XIAO_STEP = os.path.join(HERE, "reference", "xiao-nrf52840", "XIAO-nRF52840.step")

# ---------------------------------------------------------------- parameters
FIT = 0.35          # FDM clearance per side for parts that drop into pockets
WALL = 2.0
FLOOR = 2.0

# battery (Core Electronics CE04375), 1 mm room per side for pouch tolerance/foam
BAT_L, BAT_W, BAT_H = 38.0, 25.0, 6.0
BAT_ROOM = 1.0
CAV_L, CAV_W = BAT_L + 2 * BAT_ROOM, BAT_W + 2 * BAT_ROOM      # 40 x 27
CAV_H = BAT_H + BAT_ROOM                                         # 7
CAV_R = 2.0

# outer shell
OUT_L, OUT_W, OUT_R = 50.0, 37.0, 4.0

# XIAO (measured from the STEP)
PCB_L, PCB_W, PCB_T = 20.95, 17.78, 1.25
USB_OVERHANG = 1.53          # USB-C shell past the PCB edge
USB_W, USB_TOP = 8.94, 4.46  # shell width; top above PCB bottom
USB_FACE_INSET = 0.2         # USB-C face sits this far inside the outer wall

# stack heights
BASE_TOP = FLOOR + CAV_H                         # 9.0
DECK_FLOOR = 1.2
PCB_Z = BASE_TOP + DECK_FLOOR                    # 10.2  PCB bottom
LID_Z = PCB_Z + USB_TOP + 0.4                    # 15.06 lid underside
LID_T = 2.4
LEDGE = 1.0                                      # deck ledge under the PCB edges
POCKET_WALL = 1.6

# screws: all M2x8, threading into pilot holes in the deck
SCREW_L = 8.0
PILOT_D = 1.7                                    # M2 self-threading into PLA/PETG
CLEAR_D = 2.4
HEAD_D = 4.4                                     # lid counterbore: ISO 7380 (3.5), DIN 912 (3.8), DIN 7985 (4.0)
BASE_HEAD_D = 4.2                                # base recess, kept smaller: corner wall to the battery cavity
SCREW_X, SCREW_Y = 21.5, 15.0                    # bottom screws (base -> deck), corners
LID_SCREW_X, LID_SCREW_Y = 10.0, 15.3            # top screws (lid -> deck), long sides
DECK_ENGAGE = 4.0                                # thread length of the bottom screws in the deck
LID_CBORE_DEPTH = 1.2

# board placement: USB end toward -X
USB_FACE_X = -OUT_L / 2 + USB_FACE_INSET
PCB_X0 = USB_FACE_X + USB_OVERHANG               # PCB edge at USB end
PCB_X1 = PCB_X0 + PCB_L

# features on the board top, in case coordinates (from the STEP, see place_xiao)
LED_WIN = (PCB_X0 - 0.1, PCB_X0 + 3.6, 4.6, 6.9)     # x0, x1, y0, y1 over CHG + USR LEDs
RESET_XY = (PCB_X0 + 1.88, -5.72)
RESET_D = 1.8
RIB_W, RIB_Y_IN = 1.3, 7.6                            # lid clamp ribs over the pin rows

# RF shield can (flat metal top) - the lid pad tapes to it
SHIELD_X = (PCB_X0 + 6.96, PCB_X0 + 17.56)
SHIELD_HW = 6.3                                       # half width
SHIELD_TOP = 3.25                                     # above PCB bottom
TAPE_T = 1.0                                          # double-sided foam tape thickness
TAPE_SQUEEZE = 0.2                                    # how much the lid compresses it
PAD_INSET = 0.5                                       # pad edge inside the shield edge


# ---------------------------------------------------------------- helpers
def rbox(l, w, h, r, cx=0.0, cy=0.0, z=0.0):
    """Box centred on (cx, cy), bottom at z, vertical edges filleted to r."""
    b = Part.makeBox(l, w, h, App.Vector(cx - l / 2, cy - w / 2, z))
    if r > 0:
        b = b.makeFillet(r, [e for e in b.Edges
                             if abs(e.Vertexes[0].Point.z - e.Vertexes[1].Point.z) > 1e-6])
    return b


def box(x0, x1, y0, y1, z0, z1):
    return Part.makeBox(x1 - x0, y1 - y0, z1 - z0, App.Vector(x0, y0, z0))


def cyl(d, z0, z1, x, y):
    return Part.makeCylinder(d / 2, z1 - z0, App.Vector(x, y, z0))


def screw_points():
    return [(sx * SCREW_X, sy * SCREW_Y) for sx in (-1, 1) for sy in (-1, 1)]


def lid_screw_points():
    return [(sx * LID_SCREW_X, sy * LID_SCREW_Y) for sx in (-1, 1) for sy in (-1, 1)]


def outline(z0, z1):
    return rbox(OUT_L, OUT_W, z1 - z0, OUT_R, z=z0)


# ---------------------------------------------------------------- parts
def make_base():
    s = outline(0, BASE_TOP)
    s = s.cut(rbox(CAV_L, CAV_W, CAV_H + 1, CAV_R, z=FLOOR))
    # bottom screws: head recessed into the underside so 4 mm of thread reaches the deck
    head_z = BASE_TOP - (SCREW_L - DECK_ENGAGE)
    for x, y in screw_points():
        s = s.cut(cyl(BASE_HEAD_D, -1, head_z, x, y))
        s = s.cut(cyl(CLEAR_D, head_z - 0.01, BASE_TOP + 1, x, y))
    # clearance for the tips of the lid screws, which pass through the deck
    lid_tip_z = LID_Z + LID_T - LID_CBORE_DEPTH - SCREW_L
    for x, y in lid_screw_points():
        s = s.cut(cyl(CLEAR_D, lid_tip_z - 0.5, BASE_TOP + 1, x, y))
    return s.removeSplitter()


def make_deck():
    py = PCB_W / 2 + FIT                       # pocket half width
    px0, px1 = PCB_X0 - FIT, PCB_X1 + FIT      # pocket x range

    s = outline(BASE_TOP, LID_Z)
    # lighten: hollow everything above the deck floor except the outer wall,
    # the walls around the board pocket and the screw columns
    keep = box(-OUT_L / 2, px1 + POCKET_WALL, -py - POCKET_WALL, py + POCKET_WALL, PCB_Z, LID_Z)
    for x, y in screw_points() + lid_screw_points():
        keep = keep.fuse(cyl(CLEAR_D + 2 * 1.4, PCB_Z, LID_Z, x, y))
    hollow = rbox(OUT_L - 2 * WALL, OUT_W - 2 * WALL, LID_Z - PCB_Z + 1, OUT_R - WALL, z=PCB_Z)
    s = s.cut(hollow.cut(keep))
    # board pocket and the opening under it (leaves a ledge under the PCB edges)
    s = s.cut(box(px0, px1, -py, py, PCB_Z, LID_Z + 1))
    s = s.cut(box(PCB_X0 + LEDGE, PCB_X1 - LEDGE, -PCB_W / 2 + LEDGE, PCB_W / 2 - LEDGE,
                  BASE_TOP - 1, PCB_Z + 0.01))
    # USB-C slot through the end wall, open to the lid
    uw = USB_W / 2 + 0.45
    s = s.cut(box(-OUT_L / 2 - 1, px0 + 0.01, -uw, uw, PCB_Z - 0.3, LID_Z + 1))
    # pilot holes: blind from below for the base screws, through for the lid screws
    for x, y in screw_points():
        s = s.cut(cyl(PILOT_D, BASE_TOP - 1, BASE_TOP + DECK_ENGAGE + 0.5, x, y))
    for x, y in lid_screw_points():
        s = s.cut(cyl(PILOT_D, BASE_TOP - 1, LID_Z + 1, x, y))
    return s.removeSplitter()


def make_lid():
    top = LID_Z + LID_T
    s = outline(LID_Z, top)
    # clamp ribs pressing the PCB onto the deck ledge, along both pin rows
    for sgn in (-1, 1):
        y0, y1 = sorted((sgn * RIB_Y_IN, sgn * (RIB_Y_IN + RIB_W)))
        s = s.fuse(box(PCB_X0 + 0.5, PCB_X1 - 0.5, y0, y1, PCB_Z + PCB_T, LID_Z + 0.01))
    # tape pad over the RF shield: tape sticks to the pad, the board sticks to the tape
    pad_z = PCB_Z + SHIELD_TOP + TAPE_T - TAPE_SQUEEZE
    s = s.fuse(box(SHIELD_X[0] + PAD_INSET, SHIELD_X[1] - PAD_INSET,
                   -SHIELD_HW + PAD_INSET, SHIELD_HW - PAD_INSET, pad_z, LID_Z + 0.01))
    for x, y in lid_screw_points():
        s = s.cut(cyl(CLEAR_D, LID_Z - 1, top + 1, x, y))
        s = s.cut(cyl(HEAD_D, top - LID_CBORE_DEPTH, top + 1, x, y))
    x0, x1, y0, y1 = LED_WIN
    s = s.cut(rbox(x1 - x0, y1 - y0, LID_T + 2, 0.9, cx=(x0 + x1) / 2, cy=(y0 + y1) / 2,
                   z=LID_Z - 1))
    s = s.cut(cyl(RESET_D, LID_Z - 1, top + 1, *RESET_XY))
    return s.removeSplitter()


# ---------------------------------------------------------------- reference parts
def place_xiao(doc):
    """Import the official STEP and move it into case coordinates (STEP is Y-up)."""
    import Import
    before = set(o.Name for o in doc.Objects)
    Import.insert(XIAO_STEP, doc.Name)
    new = [o for o in doc.Objects if o.Name not in before]
    # STEP x -> case -x, STEP y (up) -> case z, STEP z -> case y
    m = App.Matrix(-1, 0, 0, PCB_X0 + 12.28,
                   0, 0, 1, 6.11,
                   0, 1, 0, PCB_Z + 0.25,   # STEP PCB bottom is at y = -0.25
                   0, 0, 0, 1)
    roots = [o for o in new if not o.InList or all(p.Name not in [n.Name for n in new] for p in o.InList)]
    for o in roots:
        if hasattr(o, "Placement"):
            o.Placement = App.Placement(m).multiply(o.Placement)
    return new


def build(doc_name="FormGuardCase", with_refs=True, export=True):
    if App.listDocuments().get(doc_name):
        App.closeDocument(doc_name)
    doc = App.newDocument(doc_name)
    parts = {"Base": make_base(), "Deck": make_deck(), "Lid": make_lid()}
    objs = {}
    for name, shape in parts.items():
        o = doc.addObject("Part::Feature", name)
        o.Shape = shape
        objs[name] = o
    if with_refs:
        bat = doc.addObject("Part::Feature", "Battery_ref")
        bat.Shape = rbox(BAT_L, BAT_W, BAT_H, 1.0, z=FLOOR)
        place_xiao(doc)
    doc.recompute()

    if App.GuiUp:
        import FreeCADGui as Gui
        colors = {"Base": (0.25, 0.45, 0.75), "Deck": (0.85, 0.55, 0.2), "Lid": (0.6, 0.6, 0.6)}
        for n, c in colors.items():
            objs[n].ViewObject.ShapeColor = c
        objs["Lid"].ViewObject.Transparency = 60
        if with_refs:
            doc.getObject("Battery_ref").ViewObject.ShapeColor = (0.2, 0.2, 0.2)

    if export:
        import Mesh
        os.makedirs(OUT, exist_ok=True)
        for name, o in objs.items():
            o.Shape.exportStep(os.path.join(OUT, f"formguard_{name.lower()}.step"))
            Mesh.export([o], os.path.join(OUT, f"formguard_{name.lower()}.stl"))
        doc.saveAs(os.path.join(OUT, "formguard_case.FCStd"))
    return doc, objs


build()
