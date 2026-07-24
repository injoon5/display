half = "left"; // "left" or "right"
panel_cols = 64;
panel_rows = 32;
pixel_pitch = 4;
visible_border = 7;
face_thickness = 3;
rim_depth = 12;
rim_wall = 2;
split_overlap = 4;

panel_w = panel_cols * pixel_pitch;
panel_h = panel_rows * pixel_pitch;
outer_w = panel_w + visible_border * 2;
outer_h = panel_h + visible_border * 2;

module bezel_frame() {
  union() {
    difference() {
      cube([outer_w, outer_h, face_thickness], center = false);
      translate([visible_border, visible_border, -0.1])
        cube([panel_w, panel_h, face_thickness + 0.2], center = false);
    }

    difference() {
      translate([0, 0, face_thickness])
        cube([outer_w, outer_h, rim_depth], center = false);
      translate([rim_wall, rim_wall, face_thickness - 0.1])
        cube([outer_w - rim_wall * 2, outer_h - rim_wall * 2, rim_depth + 0.2], center = false);
    }
  }
}

module seam_tabs() {
  for (y = [outer_h * 0.18, outer_h * 0.72]) {
    translate([outer_w / 2 - 3, y, face_thickness + 2])
      cube([6, 14, 4], center = false);
  }
}

module half_mask(side = "left") {
  if (side == "left") {
    translate([-1, -1, -1])
      cube([outer_w / 2 + split_overlap, outer_h + 2, rim_depth + face_thickness + 2], center = false);
  } else {
    translate([outer_w / 2 - split_overlap, -1, -1])
      cube([outer_w / 2 + split_overlap + 1, outer_h + 2, rim_depth + face_thickness + 2], center = false);
  }
}

intersection() {
  union() {
    bezel_frame();
    seam_tabs();
  }
  half_mask(half);
}
