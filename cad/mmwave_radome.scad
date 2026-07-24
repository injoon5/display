width = 48;
depth = 24;
height = 14;
wall = 1.0;
flange = 3;

module rounded_cap(w, d, h, r) {
  hull() {
    for (x = [r, w - r]) {
      for (y = [r, d - r]) {
        translate([x, y, r])
          sphere(r = r, $fn = 36);
      }
    }
    translate([w / 2, d / 2, h])
      sphere(r = r, $fn = 36);
  }
}

difference() {
  union() {
    translate([0, 0, flange])
      rounded_cap(width, depth, height, 4);
    cube([width, depth, flange], center = false);
  }

  translate([wall, wall, flange + wall])
    rounded_cap(width - wall * 2, depth - wall * 2, height - wall * 2, 3);
}
