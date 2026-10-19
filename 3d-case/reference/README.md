# Reference dimensions for the FormGuard case

Source files for the case design, kept here so the numbers can be verified by hand.
Measured values come from the official STEP model, opened in FreeCAD 1.1.3.

## Seeed XIAO nRF52840 (Sense), `xiao-nrf52840/`

| File | What it is | Source |
| --- | --- | --- |
| `XIAO-nRF52840.step` | Official 3D model | https://files.seeedstudio.com/wiki/XIAO-BLE/seeed-studio-xiao-nrf52840-3d-model.zip |
| `*.png` (CustomizedView) | Renders that ship with the 3D model | same zip |
| `top.dxf`, `bottom.dxf` | Board outline and silkscreen, top and bottom | https://files.seeedstudio.com/wiki/XIAO-BLE/XIAO-nRF52840-DXF.zip |
| `bottom-pad-positioning/` | Dimensioned DXF, bottom silkscreen PDF, pad coordinate table (.xls) | https://files.seeedstudio.com/wiki/XIAO-BLE/Bottom-pad-positioning.zip |
| `pinout.png` | Pinout diagram | https://files.seeedstudio.com/wiki/XIAO-BLE/pinout2.png |

Wiki page: https://wiki.seeedstudio.com/XIAO_BLE/

### Measured from the STEP

The STEP is Y-up: +Y is the component side and the PCB bottom is at Y = 0.

| Feature | Value |
| --- | --- |
| PCB outline | 20.95 x 17.78 mm (the wiki says 21 x 17.8) |
| PCB thickness | 1.0 mm |
| Tallest part on top | USB-C shell, 3.2 mm above the PCB top (4.2 mm from the PCB bottom) |
| RF shield can | 10.6 x 12.6 mm, 2.0 mm above the PCB top |
| USB-C overhang | 1.5 mm past the short edge of the PCB |
| USB-C shell | 8.9 wide x 3.2 tall, centred on the board's width |
| Reset button | top side, beside the USB-C on one side, 0.7 mm tall |
| CHG (red) and USR (RGB) LEDs | top side, beside the USB-C on the side opposite the reset button, about 0.3–3 mm in from the USB end |
| Underside | flat apart from pads; bottom pads stand about 0.25 mm proud |

### Bottom pads (from `Bottom Key coordinates .xls`, origin at board centre)

| Pad | x (mm) | y (mm) |
| --- | --- | --- |
| BAT+ | 0.635 | 4.445 |
| GND (BAT-) | 2.54 | 4.445 |
| NFC1 / NFC2 | -8.89 | -3.81 / -5.715 |
| SWD test points | 6.35 / 8.89 | +/-1.27 |
| USB-C (top side) | 4.953 | 0 |

The battery is soldered to the BAT and GND pads on the underside, so its wires leave from the bottom of the board.

## 400 mAh LiPo battery (Core Electronics CE04375), `battery-400mah/`

Product page: https://core-electronics.com.au/polymer-lithium-ion-battery-400mah-38456.html

| Item | Value | Where it comes from |
| --- | --- | --- |
| Cell size | 38 x 25 x 6 mm | Product page only (no cell drawing is published) |
| Weight | 11 g | Product page |
| Voltage / capacity | 3.7 V nominal / 400 mAh | Product page |
| Connector | JST-PH 2-pin (will be cut off and soldered) | Product page |
| Protection board (PCM) | 17 x 3.8 x 0.6 mm, DW01 + 8205 | `PCM-datasheet.pdf` |
| Safety data | | `MSDS.pdf` |

Pouch cells are not precise, and they swell with age. The case allows about 1 mm of clearance on each side of the cell. Measure the actual cell with calipers before printing.
