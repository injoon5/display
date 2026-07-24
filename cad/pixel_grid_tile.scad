pixel_pitch = 4;
grid_cols = 16;
grid_rows = 16;
wall_thickness = 0.4;
grid_depth = 2.5;
base_thickness = 0.8;
frame_thickness = 0.8;

tile_w = grid_cols * pixel_pitch;
tile_h = grid_rows * pixel_pitch;

module cell_walls() {
  for (x = [0 : grid_cols]) {
    translate([x * pixel_pitch - wall_thickness / 2, 0, base_thickness])
      cube([wall_thickness, tile_h, grid_depth], center = false);
  }

  for (y = [0 : grid_rows]) {
    translate([0, y * pixel_pitch - wall_thickness / 2, base_thickness])
      cube([tile_w, wall_thickness, grid_depth], center = false);
  }
}

module perimeter_frame() {
  translate([-frame_thickness, -frame_thickness, 0])
    cube([tile_w + frame_thickness * 2, tile_h + frame_thickness * 2, base_thickness + grid_depth], center = false);
}

module tile() {
  difference() {
    union() {
      cube([tile_w, tile_h, base_thickness], center = false);
      cell_walls();
      perimeter_frame();
    }

    translate([0, 0, base_thickness])
      for (x = [0 : grid_cols - 1]) {
        for (y = [0 : grid_rows - 1]) {
          translate([x * pixel_pitch + wall_thickness / 2, y * pixel_pitch + wall_thickness / 2, 0])
            cube([pixel_pitch - wall_thickness, pixel_pitch - wall_thickness, grid_depth + 0.2], center = false);
        }
      }
  }
}

tile();
