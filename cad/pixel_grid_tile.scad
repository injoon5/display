pixel_pitch = 4;
grid_cols = 16;
grid_rows = 16;
wall_thickness = 0.4;
grid_depth = 2.5;
base_thickness = 0.8;

tile_w = grid_cols * pixel_pitch;
tile_h = grid_rows * pixel_pitch;

// Walls are clipped to the tile bounds so eight 64×64 mm tiles abut flush on a
// 256×128 mm panel. Shared seams land on cell walls and stay invisible.
module cell_walls() {
  for (x = [0 : grid_cols])
    let (
      wall_x = max(0, x * pixel_pitch - wall_thickness / 2),
      wall_w = min(tile_w, x * pixel_pitch + wall_thickness / 2) - wall_x
    )
      if (wall_w > 0)
        translate([wall_x, 0, base_thickness])
          cube([wall_w, tile_h, grid_depth], center = false);

  for (y = [0 : grid_rows])
    let (
      wall_y = max(0, y * pixel_pitch - wall_thickness / 2),
      wall_h = min(tile_h, y * pixel_pitch + wall_thickness / 2) - wall_y
    )
      if (wall_h > 0)
        translate([0, wall_y, base_thickness])
          cube([tile_w, wall_h, grid_depth], center = false);
}

module tile() {
  difference() {
    union() {
      cube([tile_w, tile_h, base_thickness], center = false);
      cell_walls();
    }

    translate([0, 0, base_thickness])
      for (x = [0 : grid_cols - 1])
        for (y = [0 : grid_rows - 1])
          translate([
            x * pixel_pitch + wall_thickness / 2,
            y * pixel_pitch + wall_thickness / 2,
            0
          ])
            cube([
              pixel_pitch - wall_thickness,
              pixel_pitch - wall_thickness,
              grid_depth + 0.2
            ], center = false);
  }
}

tile();
