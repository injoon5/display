part = "pair"; // "pair", "wall", "panel"
length = 180;
height = 32;
thickness = 14;
bevel_deg = 30;
tilt_deg = 8;
slot_length = 10;
slot_width = 4.5;

bevel_drop = tan(bevel_deg) * thickness;
tilt_rise = tan(tilt_deg) * height;

// Elongated mounting hole through the wall half thickness, along the cleat length.
module screw_slot(z) {
  hull() {
    translate([-0.1, height * 0.55, z - slot_length / 2])
      rotate([0, 90, 0])
      cylinder(h = thickness + 0.2, d = slot_width, $fn = 24);
    translate([-0.1, height * 0.55, z + slot_length / 2])
      rotate([0, 90, 0])
      cylinder(h = thickness + 0.2, d = slot_width, $fn = 24);
  }
}

module wall_half() {
  difference() {
    linear_extrude(height = length)
      polygon([
        [0, 0],
        [thickness, 0],
        [thickness, height - bevel_drop],
        [0, height]
      ]);

    screw_slot(length * 0.25);
    screw_slot(length * 0.75);
  }
}

module panel_half() {
  union() {
    linear_extrude(height = length)
      polygon([
        [0, 0],
        [thickness, bevel_drop],
        [thickness, height],
        [0, height]
      ]);

    translate([thickness, 0, 0])
      linear_extrude(height = length)
      polygon([
        [0, 0],
        [tan(tilt_deg) * thickness, 0],
        [tan(tilt_deg) * thickness + tilt_rise, height],
        [0, height]
      ]);
  }
}

if (part == "wall") {
  wall_half();
} else if (part == "panel") {
  panel_half();
} else {
  wall_half();
  translate([thickness + 25, 0, 0])
    panel_half();
}
