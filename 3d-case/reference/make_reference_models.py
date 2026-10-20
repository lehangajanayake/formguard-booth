"""Build the reference models that have no free official 3D download, and save them as STEP.

Each model is built only from the published dimensions cited next to it.

Run inside FreeCAD (GUI or freecadcmd):
    exec(open("/path/to/3d-case/reference/make_reference_models.py").read())

Outputs (each frame is described next to its builder):
  battery-400mah/battery_400mah.step   38 x 25 x 6 pouch cell with PCM and leads
  jst-ph/PHR-2_mated_envelope.step     space the mated PHR-2 plug and its wire exit take
  screws/ISO7380-1_M3x15.step          M3 x 15 hexagon socket button head screw
"""
import os

import FreeCAD as App
import Part

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else \
    "/Users/lehangajanayake/Projects/formguard-booth/3d-case/reference"


def battery():
    """Core Electronics CE04375, 400 mAh.

    Cell 38 x 25 x 6 mm (product page). The PCM is 17 x 3.8 x 0.6 mm (PCM-datasheet.pdf). It is
    folded flat across the 25 mm lead end, inside the 38 mm length (assumption: no cell drawing
    is published). Frame: lead end at x = 0, the cell runs to +x, centred on y, bottom at z = 0.
    """
    L, W, H, R = 38.0, 25.0, 6.0, 1.0
    cell = Part.makeBox(L, W, H, App.Vector(0, -W / 2, 0))
    cell = cell.makeFillet(R, [e for e in cell.Edges
                               if abs(e.Vertexes[0].Point.z - e.Vertexes[1].Point.z) > 1e-6])
    # two 26 AWG leads (1.0 mm insulated), 5 mm stubs out of the lead end at mid height
    leads = [Part.makeCylinder(0.5, 5.0, App.Vector(0, y, H / 2), App.Vector(-1, 0, 0))
             for y in (-1.0, 1.0)]
    return Part.makeCompound([cell] + leads)


def phr2_envelope():
    """JST PHR-2 plug mated in a B2B-PH-K-S socket.

    Same frame as KiCad's JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical.step: pin 1 at the origin, pin 2
    at x = +2, the socket seating plane at z = 0, the socket top at z = 6.0. The socket housing
    spans x -1.95..3.95 and y -2.8..1.75. The plug sits on the socket top and stands 3 mm
    vertically above it once tilted 45 deg (3 / cos 45 = 4.24 mm along its axis); with the
    socket on the pads that puts the leads at 11.75 mm below the PCB, near the 11 mm the user
    measured with the plug and wires connected. Its cross section is taken as the socket's.
    The two leads leave its back along the same axis.
    """
    x0, x1, y0, y1 = -1.95, 3.95, -2.8, 1.75
    plug_len = 3.0 / 0.7071
    plug = Part.makeBox(x1 - x0, y1 - y0, plug_len, App.Vector(x0, y0, 6.0))
    leads = [Part.makeCylinder(0.5, 3.0, App.Vector(x, (y0 + y1) / 2, 6.0 + plug_len))
             for x in (0.0, 2.0)]
    return Part.makeCompound([plug] + leads)


def iso7380_m3(length=15.0):
    """ISO 7380-1 M3: head dk 5.7, k 1.65, hex socket s 2.0; nominal d 3.0.

    Frame: under-head face at z = 0, the shank runs down to z = -length, axis on z.
    """
    dk, k, s = 5.7, 1.65, 2.0
    # dome: a spherical cap that fits dk and k
    r = (k ** 2 + (dk / 2) ** 2) / (2 * k)
    sphere = Part.makeSphere(r, App.Vector(0, 0, k - r))
    head = sphere.common(Part.makeCylinder(dk / 2, k, App.Vector(0, 0, 0)))
    hexagon = Part.makePolygon([App.Vector(s / 2 / 0.866 * c, s / 2 / 0.866 * sn, k - 1.04)
                                for c, sn in ((1, 0), (0.5, 0.866), (-0.5, 0.866), (-1, 0),
                                              (-0.5, -0.866), (0.5, -0.866), (1, 0))])
    head = head.cut(Part.Face(hexagon).extrude(App.Vector(0, 0, 2)))
    shank = Part.makeCylinder(1.5, length, App.Vector(0, 0, -length))
    return head.fuse(shank).removeSplitter()


def export_all():
    out = {
        os.path.join(HERE, "battery-400mah", "battery_400mah.step"): battery(),
        os.path.join(HERE, "jst-ph", "PHR-2_mated_envelope.step"): phr2_envelope(),
        os.path.join(HERE, "screws", "ISO7380-1_M3x15.step"): iso7380_m3(15.0),
    }
    for path, shape in out.items():
        os.makedirs(os.path.dirname(path), exist_ok=True)
        shape.exportStep(path)
        print("wrote", path, shape.BoundBox)


export_all()
