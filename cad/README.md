# CAD sources

Minimal parametric OpenSCAD sources for the Wall Matrix Panel printed parts live here.

## Quick start

Preview any part:

```bash
openscad cad/pixel_grid_tile.scad
```

Export an STL from the repo root:

```bash
openscad -o out/pixel_grid_tile.stl cad/pixel_grid_tile.scad
```

## Notes

- Dimensions are in millimetres.
- The files are intentionally simple and editable for print-fit iteration.
- Default parameters match the build plan callouts:
  - pixel grid tile: `16x16`, `4 mm` pitch, `2.5 mm` depth, `0.4 mm` walls
  - tile footprint is exactly `64×64 mm` so eight tiles abut flush on the panel
  - cleat bevel: `30 deg`
  - panel tilt: `8 deg`
  - mmWave radome wall: `1.0 mm`
  - load-cell foot: cup above, sensor post below the base
