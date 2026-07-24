cup_diameter = 52;
cup_depth = 10;
wall = 3;
base_thickness = 5;
sensor_post_diameter = 16;
sensor_post_height = 8;
relief_hole = 8;

// Bed leg sits in the cup (above). Load-cell button is pressed by the post
// that protrudes below the base.
module foot_cup() {
  difference() {
    union() {
      cylinder(h = base_thickness + cup_depth, d = cup_diameter, $fn = 72);
      translate([0, 0, -sensor_post_height])
        cylinder(h = sensor_post_height, d = sensor_post_diameter, $fn = 48);
    }

    translate([0, 0, base_thickness])
      cylinder(h = cup_depth + 0.2, d = cup_diameter - wall * 2, $fn = 72);

    translate([0, 0, -0.1])
      cylinder(h = base_thickness + 0.2, d = relief_hole, $fn = 32);
  }
}

foot_cup();
