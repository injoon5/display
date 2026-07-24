panel_cols = 64;
panel_rows = 32;
pixel_pitch = 4;
clearance = 2;
shell_wall = 2;
shell_depth = 26;
lip_depth = 6;
standoff_diameter = 8;
standoff_hole = 3.2;
vent_slot_w = 6;
vent_slot_h = 28;
vent_gap = 4;

panel_w = panel_cols * pixel_pitch;
panel_h = panel_rows * pixel_pitch;
inner_w = panel_w + clearance * 2;
inner_h = panel_h + clearance * 2;
outer_w = inner_w + shell_wall * 2;
outer_h = inner_h + shell_wall * 2;

module shell_body() {
  difference() {
    cube([outer_w, outer_h, shell_depth], center = false);
    translate([shell_wall, shell_wall, shell_wall])
      cube([inner_w, inner_h, shell_depth], center = false);

    for (i = [0 : 5]) {
      translate([outer_w / 2 - 25 + i * (vent_slot_w + vent_gap), outer_h - shell_wall - vent_slot_h - 8, shell_depth - shell_wall - 0.1])
        cube([vent_slot_w, vent_slot_h, shell_wall + 0.2], center = false);
    }

    translate([outer_w / 2 - 12, 0, 7])
      cube([24, shell_wall + 0.2, 10], center = false);
  }
}

module lip() {
  difference() {
    translate([shell_wall, shell_wall, shell_depth - lip_depth])
      cube([inner_w, inner_h, lip_depth], center = false);
    translate([shell_wall + shell_wall, shell_wall + shell_wall, shell_depth - lip_depth - 0.1])
      cube([inner_w - shell_wall * 2, inner_h - shell_wall * 2, lip_depth + 0.2], center = false);
  }
}

module standoffs() {
  positions = [
    [24, 24],
    [outer_w - 24, 24],
    [24, outer_h - 24],
    [outer_w - 24, outer_h - 24]
  ];

  for (pos = positions) {
    difference() {
      translate([pos[0], pos[1], shell_wall])
        cylinder(h = 10, d = standoff_diameter, $fn = 32);
      translate([pos[0], pos[1], shell_wall - 0.1])
        cylinder(h = 10.2, d = standoff_hole, $fn = 24);
    }
  }
}

union() {
  shell_body();
  lip();
  standoffs();
}
