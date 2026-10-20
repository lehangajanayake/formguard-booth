"""FormGuard sensor case: XIAO nRF52840 Sense + 400 mAh LiPo, 3 stacked parts.

The battery sits beside the board at the end away from the USB-C (toward +X), clear of the
board. It plugs into a JST PH socket soldered at 45 deg to the battery pads on the board's
underside, facing the GND pin. With the plug and wires connected its lowest point is 11 mm
below the board (measured); a pit in the base under the board gives it 13 mm.

Run inside FreeCAD (GUI or freecadcmd):
    exec(open("/path/to/3d-case/formguard_case.py").read())

Parts, bottom to top:
  Base - battery tray and connector pit; the screws thread into pilot holes in its corners
  Deck - frame with a fitted pocket for the XIAO; its floor keeps the battery down
  Lid  - the board clips to its underside: the USB-C end hooks into a cradle (the hinge),
         the far end snaps under a flexible latch. Ribs press the board onto the deck ledge
         when the case is closed. LED window + reset hole.

Board in: hook the USB-C into the lid's cradle, swing the far end up until the latch clicks.
Board out: push the latch back, swing the far end down around the USB-C, slide it out.

Hardware: 4x M3x15 screws (button head ISO 7380 sits lowest; M3x16 also fits), down through
lid and deck and threading straight into the base. No inserts or nuts.
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
REF = os.path.join(HERE, "reference")
XIAO_STEP = os.path.join(REF, "xiao-nrf52840", "XIAO-nRF52840.step")
SOCKET_STEP = os.path.join(REF, "jst-ph", "JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical.step")  # KiCad
PLUG_STEP = os.path.join(REF, "jst-ph", "PHR-2_mated_envelope.step")      # make_reference_models.py
BATTERY_STEP = os.path.join(REF, "battery-400mah", "battery_400mah.step")  # make_reference_models.py
SCREW_STEP = os.path.join(REF, "screws", "ISO7380-1_M3x15.step")          # make_reference_models.py

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

# XIAO (measured from the STEP)
PCB_L, PCB_W, PCB_T = 20.95, 17.78, 1.25
USB_OVERHANG = 1.53          # USB-C shell past the PCB edge
USB_W, USB_TOP = 8.94, 4.46  # shell width; top above PCB bottom
USB_FACE_INSET = 0.2         # USB-C face sits this far inside the outer wall

# JST PH socket on the battery pads, tilted 45 deg so the plug faces the GND pin side (+Y)
CONN_DROP = 11.0             # lowest point of socket + mated plug + wires below the PCB (measured)
CONN_CLEAR = 2.0             # spare room under that
SOCKET_TILT = 45.0           # deg from straight down, toward +Y
# battery pads from "Bottom Key coordinates .xls" (board centre origin, +x toward the USB end).
# The bottom silkscreen and pinout put them on the D0-D6 edge, which is -Y in the case.
PAD_GND_XY = (2.54, 4.445)   # socket pin 1
PAD_BAT_XY = (0.635, 4.445)
GLUE_X = (1.5, 13.0)         # glue reaching the PCB long edges, measured from the USB end
PIT_HW = 12.0                # pit half width; leaves 1.75 mm round the USB-end pilot holes
BAT_GAP = 1.0                # cell starts this far past the far edge of the PCB (no overlap)
END_MARGIN = 5.0             # cavity to outer end wall, room for the far screws

# outer shell: USB face inset + overhang + board + gap + battery cavity + end margin
OUT_L = USB_FACE_INSET + USB_OVERHANG + PCB_L + BAT_GAP - BAT_ROOM + CAV_L + END_MARGIN  # 67.68
OUT_W, OUT_R = 37.0, 4.0

# stack heights
DECK_FLOOR = 1.2
PCB_Z = FLOOR + CONN_DROP + CONN_CLEAR           # 15.0  PCB bottom
BASE_TOP = PCB_Z - DECK_FLOOR                    # 13.8
BAT_Z = BASE_TOP - CAV_H                         # 6.8  battery platform: foam + cell reach the deck floor
LID_Z = PCB_Z + USB_TOP + 0.4                    # 19.86 lid underside
LID_T = 2.4
LEDGE = 1.0                                      # deck ledge under the PCB edges
POCKET_WALL = 1.6

# screws: 4x M3, heads on top of the lid (an M3 head counterbore would break out of
# the lid corners), threading into pilot holes in the base corners
PILOT_D = 2.5                                    # M3 self-threading into PLA/PETG
CLEAR_D = 3.4
PILOT_FLOOR = 0.8                                # skin left under the pilot holes; fits up to M3x16
SCREW_INSET_X, SCREW_Y = 3.5, 15.0               # screw centres from the outer ends; half spacing across

# board placement: USB end toward -X
USB_FACE_X = -OUT_L / 2 + USB_FACE_INSET
PCB_X0 = USB_FACE_X + USB_OVERHANG               # PCB edge at USB end
PCB_X1 = PCB_X0 + PCB_L
CAV_X0 = PCB_X1 + BAT_GAP - BAT_ROOM             # battery cavity, starting at the board's far edge
CAV_CX = CAV_X0 + CAV_L / 2

# features on the board top, in case coordinates (from the STEP, see place_xiao)
LED_WIN = (PCB_X0 + 0.1, PCB_X0 + 3.6, 4.6, 6.9)     # x0, x1, y0, y1 over CHG + USR LEDs
RESET_XY = (PCB_X0 + 1.88, -5.72)
RESET_D = 1.8
RIB_W, RIB_Y_IN = 1.9, 7.0                            # lid clamp ribs over the pin rows (4-5 FDM lines)
RIB_X_INSET = (0.5, 1.5)                              # ends: USB end, far end (clears a 0402 cap)

# USB-C hinge: a cradle on the lid wraps under the shell where it overhangs the PCB. The STEP
# shows the overhang's underside level with the PCB top, with nothing below it.
# Beside the shell there's only 0.4-0.6 mm to the reset button and LEDs, so the cradle stays
# in the overhang.
HINGE_GAP = 0.15                                      # cradle to shell / PCB edge
HINGE_LEG = 1.5                                       # cradle side legs, along Y
HINGE_BAR = 1.2                                       # bar under the shell, thickness
HINGE_FRONT = 0.35                                    # cradle face inside the outer wall

# far-end snap latch: an arm hanging from the lid, its tooth catches under the PCB far edge.
# The arm root sits in a recess in the lid so it is long enough to flex (about 2 % strain).
# Off centre: the chip antenna sits 0.27 mm from the far edge at y -3.4..-0.2 (STEP), so the
# tooth stays on the +Y side, clear of it and of the NFC pads underneath.
LATCH_Y, LATCH_W, LATCH_T = 3.2, 6.0, 1.2             # arm centre and width (Y), thickness (X)
LATCH_HOOK = 0.5                                      # tooth reach under the PCB
LATCH_GAP = 0.1                                       # tooth below the PCB bottom
LATCH_RECESS = 1.6                                    # root recess in the lid (0.8 mm skin left)
LATCH_ROOM = 0.9                                      # free space behind the arm to flex into


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
    return [(sx * (OUT_L / 2 - SCREW_INSET_X), sy * SCREW_Y) for sx in (-1, 1) for sy in (-1, 1)]


def outline(z0, z1):
    return rbox(OUT_L, OUT_W, z1 - z0, OUT_R, z=z0)


# ---------------------------------------------------------------- parts
def make_base():
    s = outline(0, BASE_TOP)
    # battery on a raised platform, so the deck floor holds it down
    s = s.cut(rbox(CAV_L, CAV_W, CAV_H + 1, CAV_R, cx=CAV_CX, z=BAT_Z))
    # connector pit under the USB half of the board, down to the floor, open to the battery end
    pit_x0 = -OUT_L / 2 + WALL
    s = s.cut(rbox(CAV_X0 - pit_x0, 2 * PIT_HW, BASE_TOP, CAV_R,
                   cx=(pit_x0 + CAV_X0) / 2, z=FLOOR))
    for x, y in screw_points():
        s = s.cut(cyl(PILOT_D, PILOT_FLOOR, BASE_TOP + 1, x, y))
    return s.removeSplitter()


def make_deck():
    py = PCB_W / 2 + FIT                       # pocket half width
    px0, px1 = PCB_X0 - FIT, PCB_X1 + FIT      # pocket x range

    s = outline(BASE_TOP, LID_Z)
    # lighten: hollow everything above the deck floor except the outer wall,
    # the walls around the board pocket and the screw columns
    keep = box(-OUT_L / 2, px1 + POCKET_WALL, -py - POCKET_WALL, py + POCKET_WALL, PCB_Z, LID_Z)
    for x, y in screw_points():
        keep = keep.fuse(cyl(CLEAR_D + 2 * 1.4, PCB_Z, LID_Z, x, y))
    hollow = rbox(OUT_L - 2 * WALL, OUT_W - 2 * WALL, LID_Z - PCB_Z + 1, OUT_R - WALL, z=PCB_Z)
    s = s.cut(hollow.cut(keep))
    # board pocket and the opening under it (leaves a ledge under the PCB edges)
    s = s.cut(box(px0, px1, -py, py, PCB_Z, LID_Z + 1))
    s = s.cut(box(PCB_X0 + LEDGE, PCB_X1 - LEDGE, -PCB_W / 2 + LEDGE, PCB_W / 2 - LEDGE,
                  BASE_TOP - 1, PCB_Z + 0.01))
    # no ledge along the long edges where the connector glue reaches them
    s = s.cut(box(PCB_X0 + GLUE_X[0], PCB_X0 + GLUE_X[1], -py, py, BASE_TOP - 1, PCB_Z + 0.01))
    # USB-C slot through the end wall, open to the lid, wide and deep enough for the lid's cradle
    hx0, hx1, yi, yo, bz0, bz1 = hinge_dims()
    s = s.cut(box(-OUT_L / 2 - 1, hx1 + 0.3, -yo - 0.3, yo + 0.3, bz0 - 0.3, LID_Z + 1))
    # slot for the lid latch through the far pocket wall and the ledge, with room to flex
    ax0, ax1, tip, zt, zb = latch_dims()
    s = s.cut(box(tip - 0.3, ax1 + LATCH_ROOM, LATCH_Y - LATCH_W / 2 - 0.4,
                  LATCH_Y + LATCH_W / 2 + 0.4, BASE_TOP - 1, LID_Z + 1))
    for x, y in screw_points():
        s = s.cut(cyl(CLEAR_D, BASE_TOP - 1, LID_Z + 1, x, y))
    return s.removeSplitter()


def hinge_dims():
    """USB-C cradle: x range, inner/outer half width, bar z range."""
    shell_bottom = PCB_Z + PCB_T                  # under the overhang (from the STEP)
    yi = USB_W / 2 + HINGE_GAP
    bz1 = shell_bottom - HINGE_GAP
    return (-OUT_L / 2 + HINGE_FRONT, PCB_X0 - HINGE_GAP, yi, yi + HINGE_LEG,
            bz1 - HINGE_BAR, bz1)


def latch_dims():
    """Far-end latch: arm x range, tooth tip x, tooth top z, arm bottom z."""
    ax0 = PCB_X1 + FIT
    zt = PCB_Z - LATCH_GAP
    return ax0, ax0 + LATCH_T, PCB_X1 - LATCH_HOOK, zt, zt - 0.9


def make_lid():
    top = LID_Z + LID_T
    s = outline(LID_Z, top)
    # clamp ribs pressing the PCB onto the deck ledge, along both pin rows
    for sgn in (-1, 1):
        y0, y1 = sorted((sgn * RIB_Y_IN, sgn * (RIB_Y_IN + RIB_W)))
        s = s.fuse(box(PCB_X0 + RIB_X_INSET[0], PCB_X1 - RIB_X_INSET[1], y0, y1,
                       PCB_Z + PCB_T, LID_Z + 0.01))
    # USB-C hinge: two legs beside the shell overhang and a bar under it. The bar also stops
    # the PCB edge, so the board can't slide toward the USB end.
    hx0, hx1, yi, yo, bz0, bz1 = hinge_dims()
    for sgn in (-1, 1):
        y0, y1 = sorted((sgn * yi, sgn * yo))
        s = s.fuse(box(hx0, hx1, y0, y1, bz0, LID_Z + 0.01))
    s = s.fuse(box(hx0, hx1, -yo, yo, bz0, bz1))
    # far-end snap latch: arm rooted in a recess, tooth with a lead-in ramp underneath
    ax0, ax1, tip, zt, zb = latch_dims()
    y0, y1 = LATCH_Y - LATCH_W / 2, LATCH_Y + LATCH_W / 2
    s = s.cut(box(ax0 - 0.4, ax1 + LATCH_ROOM, y0 - 0.4, y1 + 0.4, LID_Z - 1, LID_Z + LATCH_RECESS))
    s = s.fuse(box(ax0, ax1, y0, y1, zb, LID_Z + LATCH_RECESS + 0.01))
    tooth = Part.Face(Part.makePolygon([App.Vector(ax0 + 0.01, y0, zt), App.Vector(tip, y0, zt),
                                        App.Vector(tip, y0, zt - 0.25), App.Vector(ax0 + 0.01, y0, zb),
                                        App.Vector(ax0 + 0.01, y0, zt)]))
    s = s.fuse(tooth.extrude(App.Vector(0, LATCH_W, 0)))
    for x, y in screw_points():
        s = s.cut(cyl(CLEAR_D, LID_Z - 1, top + 1, x, y))
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


def pad_xy(pad):
    """Bottom pad table coordinates -> case x, y."""
    return PCB_X0 + PCB_L / 2 - pad[0], -pad[1]


def socket_placement():
    """KiCad socket frame (pin 1 at origin, seating plane z = 0, mating up +z) -> case.

    The socket hangs under the board with its mating axis tilted SOCKET_TILT from straight
    down toward +Y (facing the GND pin side). Its pin tips sit on the pads, pin 1 on GND.
    Tilted like this the KiCad socket hangs 7.9 mm and the plug envelope's leads reach 11.75 mm,
    close to the 11 mm measured (CONN_DROP).
    """
    rot = App.Rotation(App.Vector(1, 0, 0), -(180 - SOCKET_TILT))
    pin_tip = rot.multVec(App.Vector(0, 0, -3.4))          # KiCad pin length below the seat
    gx, gy = pad_xy(PAD_GND_XY)
    return App.Placement(App.Vector(gx, gy - pin_tip.y, PCB_Z - pin_tip.z), rot)


def add_ref(doc, name, path, placement):
    o = doc.addObject("Part::Feature", name)
    o.Shape = Part.read(path)
    o.Placement = placement
    return o


def place_refs(doc):
    """Reference parts in case coordinates; returns {name: object} (XIAO fused into one)."""
    refs = {}
    new = place_xiao(doc)
    names = {o.Name for o in new}
    roots = [o for o in new if not any(p.Name in names for p in o.InList)]
    doc.recompute()
    refs["XIAO"] = Part.makeCompound([Part.getShape(o) for o in roots])
    sp = socket_placement()
    refs["Socket"] = add_ref(doc, "Socket_ref", SOCKET_STEP, sp)
    refs["Plug"] = add_ref(doc, "Plug_ref", PLUG_STEP, sp)
    refs["Battery"] = add_ref(doc, "Battery_ref", BATTERY_STEP, App.Placement(
        App.Vector(CAV_X0 + BAT_ROOM, 0, BAT_Z + BAT_ROOM), App.Rotation()))
    for i, (x, y) in enumerate(screw_points()):
        refs[f"Screw{i}"] = add_ref(doc, f"Screw_ref{i}", SCREW_STEP, App.Placement(
            App.Vector(x, y, LID_Z + LID_T), App.Rotation()))
    return refs


def check_fit(parts, refs):
    """Print every overlap between a case part and a reference part.

    Expected: only the screws overlap the base (they cut their thread into the pilot holes).
    """
    clean = True
    names = list(parts)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            v = parts[a].common(parts[b]).Volume
            if v > 1e-3:
                clean = False
                print(f"  overlap {a} x {b}: {v:.2f} mm^3")
    for rn, r in refs.items():
        rs = r if isinstance(r, Part.Shape) else r.Shape
        for pn, p in parts.items():
            v = p.common(rs).Volume
            if v > 1e-3:
                clean = False
                print(f"  overlap {rn} x {pn}: {v:.2f} mm^3")
    print("fit check:", "no overlaps" if clean else "see overlaps above")


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
        refs = place_refs(doc)
        doc.recompute()
        check_fit(parts, {n: (r.Shape if hasattr(r, "Shape") else r) for n, r in refs.items()})
    doc.recompute()

    if App.GuiUp:
        colors = {"Base": (0.25, 0.45, 0.75), "Deck": (0.85, 0.55, 0.2), "Lid": (0.6, 0.6, 0.6),
                  "Battery_ref": (0.2, 0.2, 0.2), "Socket_ref": (0.95, 0.95, 0.9),
                  "Plug_ref": (0.9, 0.3, 0.3)}
        for n, c in colors.items():
            if doc.getObject(n):
                doc.getObject(n).ViewObject.ShapeColor = c
        objs["Lid"].ViewObject.Transparency = 60

    if export:
        import Mesh
        os.makedirs(OUT, exist_ok=True)
        for name, o in objs.items():
            o.Shape.exportStep(os.path.join(OUT, f"formguard_{name.lower()}.step"))
            Mesh.export([o], os.path.join(OUT, f"formguard_{name.lower()}.stl"))
        doc.saveAs(os.path.join(OUT, "formguard_case.FCStd"))
    return doc, objs


build(export=not globals().get("NO_EXPORT"))   # set NO_EXPORT = True before exec to only preview
