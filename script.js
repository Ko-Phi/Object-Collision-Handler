function program() {
  title("Mass Object Collision Handler");
  size(1800, 1200);
  const canvasHalfWidth = width / 2;
  const canvasHalfHeight = height / 2;
  // no more radian jumpscare

  const FPS = 60;
  const moreBoxes = true; // replaces the usual two boxes with 5
  const veryMoreBoxes = true; // a lot of boxes
  const considerablyLargeAmountOfBoxesToInsert = true; // way too many boxes

  const visualize = false; // recommended to swap off when boxes are densely packed
  const randomMovement = true; // they're alive! (and ruining your performance

  /**
	  *VISUALIZER FLASHING WARNING WHEN OBJECTS COLLIDE AT CORNERS*
	  WASD or Arrow Keys to move, Q/R to rotate, Space to change boxes
	  
	  The number of necessary SAT checks has dropped significantly with the implementation of a HashGrid system and radius camparison, with counts in O(n + k) territory
	  That said, this project still remains quite instable when many dynamic objects are put into play
	  This is mainly due to constant hitbox geometry updates that you probably won't see in an actual game
	  Oh and memory allocation, but thats evil and scary, so we don't talk about that
	  
	  Also, do note that certain collisions, especially those chained between fast moving, rotating objects, may not be resolved properly within the time frame of a single physics update.
	  This takes the form of object-object clipping, with is a major problem f
	  To solve this, one could repeat the collision check-handle loop a couple times per frame, though this of course would be pretty resource intensive.
	  
	  Potential Optimizations {
	  Implementations {
	  HashGrid (very useful)
	  Duplicate purging
	  Caching unrotated normals, rotating them when necessary
	  Caching unrotated centers, rotating them when necessary 
	  (I think theres a pattern)
	  Stop calculating transformed vertices inside the hitbox, do it during SAT / when finding closest point
	  Maybe you don't need perfectly minimized and translated AABBs
	  Only do AABB updates for each object, refrain from full geometry update until broadphase passed
	  Quick radii check (very free)
	  }
	  Do scalar math to prevent object allocation / garbage 
	  collector strain (I don't wanna)
	  }
	  
	  Pipeline {
	      The project loops over each object, performing a broad update, which checks if the object is rotated, yielding a aabb recalculation if true
	      After doing so, a hashgrid query is performed on every object, using each's aabb as input.
	      This returns an array of that shape's grid cell neighbors.
	      This array is then looped over, with duplicate entries and collisions (determined by shape ids) skipped.
	      A quick radius-radius check is made between the main shape and each possible other shape.
	      Only if this check is past, that a narrow update is peformed on each object, allowing for a proper SAT check
	  }
	  
	  Seperating Axis Theorem {
	  If one can draw a line between two objects, those two objects are seperate
	  Conversely, if a line cannot be drawn, those objects are touching
	  To find the seperating axis, which is perpendicular to 
	  this line, one must consult each polygon's normals (perpendicular to each side)
	  By projecting each shape onto each normal, one can check for overlap between shapes
	  Only one instance of seperation is need to conclude that two objects are apart
	  If all seperation checks fail, the objects are touching
	  The Minimum Translation Vector (MTV), which pushes touching objects apart, can be found by multiplying the minimum overlap across all checks with its corresponding normal (normalized and reorientated from object A to B)
	  }
	  
	  Visualization Details {
	      Broadphase {
	          The transparent shadows under a shape represent its AABB (axis aligned bounding bounding box (basically a rectangle)) and maximum radius. The AABB is used by the HashGrid to query surrounding cells, which are represented by the grid.
	          }
	      SAT {
	          The black line between the objects objects is what indicates their seperation
	          Perpendicular to this line is the gray axis of seperation
	          The translucent rectangles represent each object's projection on to this axis
	          For Circle-Polygon collision detection, an additional lineis drawn
	          This line indicates the closest point from the circle's center to the other object
	          For this kind of collision detection, this extra axis is needed for proper checks
	          The gray dots on each object represents the point at which they rotate about
	          As for the gold dots, they represent the object's geometric center
	          Gold dots may sometimes cover gray ones
	          The green object is the one currently controllable via keyboard input
	      }
	  }
	  
	  Changelog {
	      Do excuse my shoddy implementation, will refine later on
	      Now works for all non-concave polygons!
	      Spent so-long frustrated over circle-polygon collision
	      Can now properly push objects
	      Have as many boxes as you want
	      Spatial Grid purges many easy non-collisions
	      Box updates split between broad (all boxes) and narrow (potential collisions)
	      Broad update made very fast with the use of caching and approximated AABBS
	  }
	  **/

  /*
    Disable loop protector function via Daniel T (@dkareh)
		(function(){return this;})().LoopProtector.prototype.leave = function(){};
  */

  angleMode = "radians";
  frameRate(FPS);
  const dt = 60 / FPS;

  // quite small
  const epsilon = 1e-6;
  function rounD(num, deciPlace) {
    return round(num * pow(10, deciPlace)) / pow(10, deciPlace);
  }

  // returns first defined value
  function retDef(input1, input2) {
    if (input1 !== undefined) {
      return input1;
    } else {
      return input2;
    }
  }

  let idCount = 0;
  function newid() {
    return idCount++;
  }

  var keys = Array(100).fill(false);
  keyPressed = function () {
    keys[keyCode] = true;
  };
  keyReleased = function () {
    keys[keyCode] = false;
  };

  // componentInit: x, y
  // dirMagInit: dir, mag
  class Vector {
    constructor(input1, input2, init) {
      init = retDef(init, "component");
      let x, y;
      if (init === "component") {
        x = input1;
        y = input2;
      } else if (init === "dirMag") {
        x = input2 * Math.cos(input1);
        y = input2 * Math.sin(input1);
      }
      this.x = x;
      this.y = y;
    }
    sqMag = () => sq(this.x) + sq(this.y);
    mag = () => sqrt(this.sqMag());
    theta = () => Math.atan2(this.y, this.x);
    add(vector) {
      if (!(vector instanceof Vector)) {
        vector = new Vector(vector, vector);
      }
      return new Vector(this.x + vector.x, this.y + vector.y);
    }
    subtract(vector) {
      if (!(vector instanceof Vector)) {
        vector = new Vector(vector, vector);
      }
      return new Vector(this.x - vector.x, this.y - vector.y);
    }
    multiply(vector) {
      if (!(vector instanceof Vector)) {
        vector = new Vector(vector, vector);
      }
      return new Vector(this.x * vector.x, this.y * vector.y);
    }
    divide(vector) {
      if (!(vector instanceof Vector)) {
        vector = new Vector(vector, vector);
      }
      return new Vector(this.x / vector.x, this.y / vector.y);
    }
    normalize() {
      const mag = this.mag();
      if (mag === 0) {
        return this;
      }
      return this.divide(new Vector(mag, mag));
    }
    dotProduct(vector) {
      if (!(vector instanceof Vector)) {
        vector = new Vector(vector, vector);
      }
      return this.x * vector.x + this.y * vector.y;
    }
    perpendicular = () => new Vector(-this.y, this.x);
    display = () => rounD(this.x, 3) + ", " + rounD(this.y, 3);
    equalTo = (vector) => this.x === vector.x && this.y === vector.y;
  }

  class Color {
    constructor(c1, c2, c3, input1, input2) {
      let alpha;
      let model;
      if (input1 === undefined) {
        alpha = 255;
        model = "RGB";
      } else if (typeof input1 === "string") {
        alpha = 255;
        model = input1;
      } else {
        alpha = input1;
        model = input2;
      }

      this.channels = [c1, c2, c3, alpha];
      this.channels[3] = retDef(this.channels[3], 255);
      this.model = model || "RGB";
      this.cachedValue = this.value();
    }

    toRGB() {
      if (this.model === "RGB") {
        return;
      }
      const hue = this.channels[0];
      const sat = this.channels[1];
      const val = this.channels[2];
      const hueP = hue / 60;
      const chroma = val * sat;
      const x = chroma * (1 - abs((hueP % 2) - 1));

      let r;
      let g;
      let b;
      if (hueP < 1) {
        r = chroma;
        g = x;
        b = 0;
      } else if (hueP < 2) {
        r = x;
        g = chroma;
        b = 0;
      } else if (hueP < 3) {
        r = 0;
        g = chroma;
        b = x;
      } else if (hueP < 4) {
        r = 0;
        g = x;
        b = chroma;
      } else if (hueP < 5) {
        r = x;
        g = 0;
        b = chroma;
      } else if (hueP < 6) {
        r = chroma;
        g = 0;
        b = x;
      }

      const m = val - chroma;
      this.channels[0] = (r + m) * 255;
      this.channels[1] = (g + m) * 255;
      this.channels[2] = (b + m) * 255;
      this.model = "RGB";
    }
    toHSV() {
      if (this.model === "HSV") {
        return;
      }
      const rP = this.channels[0] / 255;
      const gP = this.channels[1] / 255;
      const bP = this.channels[2] / 255;
      const cMax = max(rP, max(gP, bP));
      const cMin = min(rP, min(gP, bP));
      const delta = cMax - cMin;

      let hue;
      let sat;
      let val;
      if (delta === 0) {
        hue = 0;
      }
      if (cMax === rP) {
        hue = (((gP - bP) / delta) % 6) * 60;
      }
      if (cMax === gP) {
        hue = ((bP - rP) / delta + 2) * 60;
      }
      if (cMax === bP) {
        hue = ((rP - gP) / delta + 4) * 60;
      }
      sat = cMax === 0 ? 0 : delta / cMax;
      val = cMax;

      this.channels[0] = hue;
      this.channels[1] = sat;
      this.channels[2] = val;
      this.model = "HSV";
    }
    value() {
      if (this.model === "HSV") {
        this.toRGB();
      }
      return color(this.channels[0], this.channels[1], this.channels[2], this.channels[3]);
    }
  }

  let cellsChecked = 0;

  class SpatialHashGrid {
    constructor(cellSize) {
      this.grid = {};
      this.cellSize = cellSize;
    }
    key = (x, y) => x + "," + y;
    getCellIndex(x, y) {
      const xIndex = floor(x / this.cellSize);
      const yIndex = floor(y / this.cellSize);
      return new Vector(xIndex, yIndex);
    }
    newClient(client) {
      client.indices = [];
      this.insert(client);
      return client;
    }
    insert(client) {
      const x = client.position.x + client.hitbox.aabb.center.x;
      const y = client.position.y + client.hitbox.aabb.center.y;
      const width = client.hitbox.aabb.width;
      const height = client.hitbox.aabb.width;

      // get the client's span
      const index1 = this.getCellIndex(x - width / 2, y - height / 2);
      const index2 = this.getCellIndex(x + width / 2, y + height / 2);
      client.indices = [index1, index2];

      // iterate over span, adding client to each cell
      for (let x = index1.x; x <= index2.x; ++x) {
        for (let y = index1.y; y <= index2.y; ++y) {
          const key = this.key(x, y);
          if (!this.grid[key]) {
            this.grid[key] = [];
          }
          this.grid[key].push(client);
        }
      }
    }
    findNear(position, width, height) {
      const x = position.x;
      const y = position.y;

      // get span of checked area
      const index1 = this.getCellIndex(x - width / 2, y - height / 2);
      const index2 = this.getCellIndex(x + width / 2, y + height / 2);

      // iterate over spanned area for clients
      pushMatrix();
      translate(canvasHalfWidth, canvasHalfHeight);
      fill(180, 30);
      stroke(180, 90);
      let clients = [];
      for (let x = index1.x; x <= index2.x; ++x) {
        for (let y = index1.y; y <= index2.y; ++y) {
          let key = this.key(x, y);
          if (this.grid[key]) {
            for (let i = 0; i < this.grid[key].length; i++) {
              clients.push(this.grid[key][i]);
            }
          }
          rect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
          cellsChecked++;
        }
      }
      popMatrix();
      return clients;
    }
    remove(client) {
      const index1 = client.indices[0];
      const index2 = client.indices[1];
      // iterate over client's span, removing it from each cell
      const searchedId = client.id;
      for (let x = index1.x; x <= index2.x; ++x) {
        for (let y = index1.y; y <= index2.y; ++y) {
          const key = this.key(x, y);
          const cell = this.grid[key];
          if (!cell) {
            continue;
          }

          const clientIndex = cell.indexOf(client);
          if (clientIndex !== -1) {
            cell.splice(clientIndex, 1);
          }

          if (cell.length === 0) {
            delete this.grid[key];
          }
        }
      }
    }
    update(client) {
      const x = client.position.x + client.hitbox.aabb.center.x;
      const y = client.position.y + client.hitbox.aabb.center.y;
      const width = client.hitbox.aabb.width;
      const height = client.hitbox.aabb.width;

      // get the client's span
      const index1 = this.getCellIndex(x - width / 2, y - height / 2);
      const index2 = this.getCellIndex(x + width / 2, y + height / 2);
      // check for change in grid position
      if (!index1.equalTo(client.indices[0]) || !index2.equalTo(client.indices[1])) {
        this.remove(client);
        this.insert(client);
      }
    }
    draw() {
      stroke(new Color(0, 0, 0.8, "HSV").value());
      pushMatrix();
      translate(canvasHalfWidth, canvasHalfHeight);
      for (let x = ceil(-width / this.cellSize) * this.cellSize; x <= canvasHalfWidth; x += this.cellSize) {
        line(x, height, x, -height);
      }
      for (let y = ceil(-height / this.cellSize) * this.cellSize; y <= canvasHalfHeight; y += this.cellSize) {
        line(width, y, -width, y);
      }
      popMatrix();
    }
  }

  let gridSize = 50;

  const world = new SpatialHashGrid(gridSize);

  class Shape {
    constructor(params) {
      this.color = params.color;
      this.type = params.type || "Polygon";
      if (this.type === "Polygon") {
        this.vertices = params.vertices;
      } else if (this.type === "Circle") {
        this.center = retDef(params.center, new Vector(0, 0));
        this.radius = params.radius;
      }
    }
    draw(dx, dy) {
      fill(this.color.cachedValue);
      if (this.type === "Polygon") {
        beginShape();
        for (let i = 0; i < this.vertices.length; i++) {
          let vert = this.vertices[i];
          // Vector check stuff
          if (!(vert instanceof Vector)) {
            vert = new Vector(vert[0], vert[1]);
          }
          vertex(vert.x + dx, vert.y + dy);
        }
        endShape(CLOSE);
      } else if (this.type === "Circle") {
        ellipse(this.center.x, this.center.y, this.radius * 2, this.radius * 2);
      }
      fill(125);
      ellipse(0, 0, 5, 5);
    }
  }

  function regularPolyVerts(x, y, r, n) {
    const vertices = [];
    for (let i = 0; i < n; i++) {
      vertices.push(new Vector(x + r * Math.cos((2 * PI * i) / n), y + r * Math.sin((2 * PI * i) / n)));
    }
    return vertices;
  }
  function polyVerts(inputs) {
    let vertices = [];
    for (let i = 0; i < inputs.length; i += 2) {
      vertices.push(new Vector(inputs[i], inputs[i + 1]));
    }
    return vertices;
  }

  function newPolygon(vertices, color, type) {
    type = type || "Polygon";
    return new Shape({
      vertices: vertices,
      color: color,
      type: type
    });
  }
  function newCircle(center, radius, color) {
    return new Shape({
      type: "Circle",
      center: center,
      radius: radius,
      color: color
    });
  }

  class Hitbox extends Shape {
    constructor(shape, base) {
      super(shape);
      this.rotatedVertices = [];
      this.transformedVertices = [];
      this.normals = [];
      this.cachedDir = null;
      this.lastUpdate = "None";

      // cache everything
      this.aabb = {};
      // this.cachedAabb = {};
      this.cachedNormals = [];
      if (this.type === "Circle") {
        this.aabb.width = this.radius * 2;
        this.aabb.height = this.aabb.width;
        this.aabb.center = this.center;
        this.cachedCenter = this.center.multiply(1);
      }
      if (this.type === "Polygon") {
        const cosT = Math.cos(base.dir);
        const sinT = Math.sin(base.dir);
        let sum = new Vector(0, 0);
        for (let i = 0; i < this.vertices.length; i++) {
          const vertex = this.vertices[i];
          this.rotatedVertices[i] = new Vector(
            vertex.x * cosT - vertex.y * sinT,
            vertex.x * sinT + vertex.y * cosT
          );
          sum = sum.add(vertex);
        }
        this.cachedCenter = sum.divide(this.vertices.length);
        if (this.cachedCenter.sqMag() < epsilon) {
          this.cachedCenter = new Vector(0, 0);
        }
        this.center = this.cachedCenter.multiply(1);

        let maxSqRadius = -Infinity;
        for (let i = 0; i < this.rotatedVertices.length; i++) {
          // this isn't java
          const vertex = this.rotatedVertices[i];
          const nextVertex = this.rotatedVertices[(i + 1) % this.rotatedVertices.length];
          const edge = nextVertex.subtract(vertex);
          let normal = edge.perpendicular().normalize();

          const direction = this.cachedCenter.subtract(normal);
          maxSqRadius = max(vertex.subtract(this.center).sqMag(), maxSqRadius);
          const dotProd = normal.x * direction.x + normal.y * direction.y;
          if (dotProd < 0) {
            normal = normal.multiply(-1);
          }
          this.cachedNormals[i] = normal;
        }
        this.radius = sqrt(maxSqRadius);
        // Better for more uniform shapes (this scenario)
        this.aabb.width = 2 * this.radius;
        this.aabb.height = 2 * this.radius;
        this.aabb.center = this.center;
      }
      this.broadUpdate(base);
    }
    broadUpdate(base) {
      this.lastUpdate = "AABB";

      // check if rotation recalc neccessary
      if (base.dir !== this.cachedDir && this.cachedCenter.x + this.cachedCenter.y !== 0) {
        const dir = base.dir;
        this.cachedDir = dir;
        const cosT = Math.cos(dir);
        const sinT = Math.sin(dir);

        let center = this.center;
        let cachedCenter = this.cachedCenter;
        // recalc center
        center.x = cachedCenter.x * cosT - cachedCenter.y * sinT;
        center.y = cachedCenter.x * sinT + cachedCenter.y * cosT;
      }

      // display AABB (note aabb center points to base center)
      const center = this.center;
      const aabbWidth = this.aabb.width;
      const aabbHeight = this.aabb.height;
      const position = base.position;
      const radius = this.radius;

      fill(128, 50);
      stroke(128, 50);
      rect(
        center.x + position.x + canvasHalfWidth - aabbWidth / 2,
        center.y + position.y + canvasHalfHeight - aabbHeight / 2,
        aabbWidth,
        aabbHeight
      );
      fill(128, 50);
      ellipse(
        center.x + position.x + canvasHalfWidth,
        center.y + position.y + canvasHalfHeight,
        radius * 2,
        radius * 2
      );
    }
    narrowUpdate(base) {
      if (this.type === "Circle" || this.lastUpdate !== "AABB") {
        return;
      }
      this.lastUpdate = "SAT";

      const position = base.position;
      const dir = base.dir;
      const cosT = Math.cos(dir);
      const sinT = Math.sin(dir);
      // recalc transformed vertices and normals
      for (let i = 0; i < this.vertices.length; i++) {
        const vertex = this.vertices[i];
        this.rotatedVertices[i] = new Vector(
          vertex.x * cosT - vertex.y * sinT,
          vertex.x * sinT + vertex.y * cosT
        );
        this.transformedVertices[i] = this.rotatedVertices[i].add(position);

        this.normals[i] = new Vector(
          this.cachedNormals[i].x * cosT - this.cachedNormals[i].y * sinT,
          this.cachedNormals[i].x * sinT + this.cachedNormals[i].y * cosT
        );
      }
    }
    project(axis, base, out) {
      let min, max;
      if (this.type === "Circle") {
        const center = this.center.add(base.position);
        const projection = axis.x * center.x + axis.y * center.y;

        const radiusProjection = this.radius * axis.mag();
        min = projection - radiusProjection;
        max = projection + radiusProjection;
      } else {
        // min = axis.dotProduct(this.transformedVertices[0]);
        min = axis.x * this.transformedVertices[0].x + axis.y * this.transformedVertices[0].y;
        max = min;
        for (let i = 1; i < this.transformedVertices.length; i++) {
          const vert = this.transformedVertices[i];
          const projection = axis.x * vert.x + axis.y * vert.y;
          if (projection < min) {
            min = projection;
          } else if (projection > max) {
            max = projection;
          } else if (min === undefined) {
            min = projection;
            max = projection;
          }
        }
      }
      out.min = min;
      out.max = max;
    }
    closestPointToCenterOf = function (base) {
      let closestPoint;
      let minDistanceSquared = Infinity;
      const center = base.position.add(base.hitbox.center);
      // loop over this object's edges
      const vertices = this.transformedVertices;
      for (let j = 0; j < vertices.length; j++) {
        const vertexA = vertices[j];
        const vertexB = vertices[(j + 1) % vertices.length];

        // get closest point on side
        const sideAB = vertexB.subtract(vertexA);
        const sideACenter = center.subtract(vertexA);
        let projection = (sideACenter.x * sideAB.x + sideACenter.y * sideAB.y) / sideAB.sqMag();

        projection = constrain(projection, 0, 1);
        const point = vertexA.add(sideAB.multiply(new Vector(projection, projection)));
        const difference = point.subtract(center);
        const distanceSquared = difference.sqMag();
        if (distanceSquared < minDistanceSquared) {
          minDistanceSquared = distanceSquared;
          closestPoint = point;
        }
      }
      return closestPoint;
    };
  }

  // temp
  class Base {
    constructor(params) {
      this.id = newid();
      this.x = params.x || 0;
      this.y = params.y || 0;
      this.position = retDef(params.position, new Vector(0, 0));
      this.dir = params.dir || 0;
      this.shape = params.shape || 0;
      this.trueColor = new Color(random(-15, 30), 0.6, 1, "HSV");

      this.hitbox = new Hitbox(params.shape, this);
      this.axesBuffer = [];
      this.velocity = new Vector(0, 0);
      this.omega = 0;
      this.ticks = floor(random(0, 50));
    }
    getInput() {
      const input_x = (keys[RIGHT] || keys[68]) - (keys[LEFT] || keys[65]);
      const input_y = (keys[DOWN] || keys[83]) - (keys[UP] || keys[87]);
      const input_dir = keys[69] - keys[81];
      this.position = this.position.add(new Vector(input_x, input_y).normalize());
      this.dir += input_dir / 20;
    }
    update() {
      this.ticks++;
      this.position = this.position.add(this.velocity.multiply(dt));
      this.dir += this.omega * dt;
      if (abs(this.position.x) > canvasHalfWidth + 30) {
        this.position.x = (this.position.x / abs(this.position.x)) * -1 * canvasHalfWidth;
      }
      if (abs(this.position.y) > canvasHalfHeight + 30) {
        this.position.y = (this.position.y / abs(this.position.y)) * -1 * canvasHalfHeight;
      }
      if (this.ticks % (60 * dt) === 0 && randomMovement) {
        const scale = considerablyLargeAmountOfBoxesToInsert ? 0.5 : 1;
        this.velocity = new Vector(random(0, 2 * PI), random(2, 5) * scale, "dirMag");
        this.omega = random(-0.1, 0.1) * scale;
      }
      if (focus === this.id) {
        this.shape.color = new Color(110, 0.4, 1, "HSV");
      } else {
        this.shape.color = this.trueColor;
      }
    }
    draw() {
      pushMatrix();
      translate(this.position.x + canvasHalfWidth, this.position.y + height / 2);
      if (this.shape.type !== "Circle") {
        rotate(this.dir);
      }
      this.shape.draw(0, 0);
      popMatrix();
    }
    checkCollision(otherBase, visualize) {
      const baseA = this;
      const baseB = otherBase;
      const tCenterA = baseA.hitbox.center.add(baseA.position);
      const tCenterB = baseB.hitbox.center.add(baseB.position);

      this.axesBuffer.length = 0;
      // common seperation axis
      this.axesBuffer.push(tCenterB.subtract(tCenterA).normalize());
      for (let i = 0; i < baseA.hitbox.normals.length; i++) {
        this.axesBuffer.push(baseA.hitbox.normals[i]);
      }
      for (let i = 0; i < baseB.hitbox.normals.length; i++) {
        this.axesBuffer.push(baseB.hitbox.normals[i]);
      }
      let axes = this.axesBuffer;
      // Circle-Circle test
      if (baseA.hitbox.type === baseB.hitbox.type && baseA.hitbox.type === "Circle") {
        const sqDistance = baseA.hitbox.center
          .add(baseA.position)
          .subtract(baseB.hitbox.center.add(baseB.position))
          .sqMag();
        const radiiSum = baseA.hitbox.radius + baseB.hitbox.radius;
        if (sqDistance > sq(radiiSum)) {
          return { colliding: false };
        } else {
          const overlap = sqrt(sqDistance) - radiiSum;
          const normal = tCenterA.subtract(tCenterB).normalize();
          return {
            colliding: true,
            axis: normal,
            overlap: overlap,
            MTV: normal.multiply(overlap),
            baseA: baseA,
            baseB: baseB
          };
        }
      }

      // Circle-Polygon
      // get closest point on edge and add to normals
      if (baseA.hitbox.type !== baseB.hitbox.type) {
        let circleBase, otherHitbox;
        if (baseA.hitbox.type === "Circle") {
          circleBase = baseA;
          otherHitbox = baseB.hitbox;
        } else {
          circleBase = baseB;
          otherHitbox = baseA.hitbox;
        }
        const center = circleBase.position.add(circleBase.hitbox.center);

        const closestPoint = otherHitbox.closestPointToCenterOf(circleBase);
        const axis = closestPoint.subtract(center);
        axes.unshift(axis.normalize());
        // Visualize
        pushMatrix();
        fill(255, 255, 255);
        translate(canvasHalfWidth, canvasHalfHeight);
        ellipse(center.x, center.y, 5, 5);
        ellipse(closestPoint.x, closestPoint.y, 5, 5);
        line(center.x, center.y, closestPoint.x, closestPoint.y);
        popMatrix();
        fill(0, 0, 0);
      }

      // Polygon-Polygon / Circle-Polygon Test
      // project each hitbox on each axis, checking for seperation
      let minOverlap = Infinity;
      let minNormal;
      for (let i = 0; i < axes.length; i++) {
        // project each hitbox's vertices
        const axis = axes[i];
        const projA = { min: null, max: null };
        const projB = { min: null, max: null };
        baseA.hitbox.project(axis, baseA, projA);
        baseB.hitbox.project(axis, baseB, projB);

        // check if seperate
        if (projA.max < projB.min || projB.max < projA.min) {
          if (visualize) {
            const bases = [baseA, baseB];
            const seperator = axis.normalize();
            const scalar = max(canvasHalfWidth, canvasHalfHeight) * 3;
            const shadow = seperator.perpendicular().multiply(scalar);
            pushMatrix();
            translate(canvasHalfWidth, canvasHalfHeight);
            stroke(150);
            line(-seperator.x * scalar, -seperator.y * scalar, seperator.x * scalar, seperator.y * scalar);
            let mid;
            if (projA.max < projB.min) {
              mid = (projA.max + projB.min) / 2;
            } else {
              mid = (projA.min + projB.max) / 2;
            }
            // draw seperating line
            stroke(0);
            line(
              seperator.x * mid - shadow.x,
              seperator.y * mid - shadow.y,
              seperator.x * mid + shadow.x,
              seperator.y * mid + shadow.y
            );
            const mins = [projA.min, projB.min];
            const maxes = [projA.max, projB.max];
            for (let j = 0; j < bases.length; j++) {
              if (focus === bases[j].id) {
                stroke(170, 255, 153);
                fill(170, 255, 153, 25);
              } else {
                stroke(255, 104, 104);
                fill(255, 104, 104, 25);
              }
              strokeWeight(2);
              line(
                seperator.x * mins[j],
                seperator.y * mins[j],
                seperator.x * maxes[j],
                seperator.y * maxes[j]
              );
              // cast shadow
              beginShape();
              vertex(seperator.x * mins[j] - shadow.x, seperator.y * mins[j] - shadow.y);
              vertex(seperator.x * mins[j] + shadow.x, seperator.y * mins[j] + shadow.y);
              vertex(seperator.x * maxes[j] + shadow.x, seperator.y * maxes[j] + shadow.y);
              vertex(seperator.x * maxes[j] - shadow.x, seperator.y * maxes[j] - shadow.y);
              endShape();
            }
            fill(0);
            stroke(0);
            popMatrix();
          }
          return { colliding: false };
        }

        const overlap = min(projA.max, projB.max) - max(projA.min, projB.min);
        if (overlap < minOverlap) {
          minOverlap = overlap;
          minNormal = axis;
        }
      }
      // reorient axis when neccessary
      const direction = tCenterB.subtract(tCenterA);
      const dotProd = minNormal.x * direction.x + minNormal.y * direction.y;
      if (dotProd < 0) {
        minNormal = minNormal.multiply(-1);
      }

      return {
        colliding: true,
        axis: minNormal,
        overlap: minOverlap,
        MTV: minNormal.multiply(minOverlap),
        baseA: baseA,
        baseB: baseB
      };
    }
    handleCollision(data) {
      if (!data.colliding) return;
      const baseA = this;
      const baseB = data.baseB;
      const displacement = data.MTV.multiply(0.5 + epsilon);
      baseA.position = baseA.position.subtract(displacement);
      baseB.position = baseB.position.add(displacement);
    }
  }

  let boxes = [];
  const insertCount = considerablyLargeAmountOfBoxesToInsert ? 200 : veryMoreBoxes ? 50 : 0;
  const s = considerablyLargeAmountOfBoxesToInsert ? 20 : 20;
  for (let i = 0; i < insertCount; i++) {
    const shap =
      ceil(random(0, 5)) > 2
        ? newPolygon(regularPolyVerts(0, 0, ceil(random(s, s + 5)), ceil(random(2, 5))), new Color(255, 0, 0))
        : newCircle(new Vector(0, 0), ceil(random(s, s + 5)), new Color(255, 0, 0));
    boxes.push(
      new Base({
        position: new Vector(
          random(-canvasHalfWidth, canvasHalfWidth),
          random(-canvasHalfHeight, canvasHalfHeight)
        ),
        dir: 0,
        shape: shap
      })
    );
  }

  if (!veryMoreBoxes && !considerablyLargeAmountOfBoxesToInsert) {
    boxes.push(
      new Base({
        position: new Vector(-100, 0),
        dir: 0,
        shape: newPolygon(regularPolyVerts(0, 0, 35, 5), new Color(255, 0, 0))
      }),
      new Base({
        position: new Vector(100, 0),
        dir: 0,
        shape: newCircle(new Vector(0, 0), 25, new Color(255, 0, 0))
      })
    );
    if (moreBoxes) {
      boxes.push(
        new Base({
          position: new Vector(0, -100),
          dir: PI / 2,
          shape: newPolygon(polyVerts([-25, -25, 25, -25, 25, 25, -25, 25, -50, 0]), new Color(255, 0, 0))
        }),
        new Base({
          position: new Vector(0, 0),
          dir: 0,
          shape: newPolygon(regularPolyVerts(0, 0, 35, 3), new Color(255, 0, 0))
        }),
        new Base({
          position: new Vector(0, 100),
          dir: 0,
          shape: newPolygon(regularPolyVerts(0, 0, 35, 4), new Color(255, 0, 0))
        })
      );
    }
  }

  const displayPeriod = 60;
  class Performance {
    constructor() {
      this.metrics = {};
    }
    getTime() {
      const result = performance.now() - this.ticks;
      this.ticks = performance.now();
      return result;
    }
    updateMetric(key) {
      if (this.metrics[key] === undefined) {
        this.metrics[key] = {};
        this.metrics[key].buffer = [];
      }
      let metric = this.metrics[key];
      metric.buffer[0] += this.getTime();
    }
    getMetricData(key, out) {
      let buffer = this.metrics[key].buffer;

      let mini = Infinity;
      let maxi = -Infinity;
      let sum = 0;

      for (let i = 0; i < buffer.length; i++) {
        const data = buffer[i];
        mini = min(data, buffer);
        maxi = max(data, buffer);
        sum += data;
      }

      out.min = mini;
      out.max = maxi;
      out.average = sum / buffer.length;
      if (key !== "total") {
        out.percentage = (out.average / this.metrics.total.savedData.average) * 100;
      } else {
        out.percentage = 100;
      }
    }
    // for next frame
    resetMetrics() {
      for (const key in this.metrics) {
        const metric = this.metrics[key];
        if (metric.buffer.unshift(0) > displayPeriod) {
          metric.buffer.pop();
        }
      }
    }
    getTotal() {
      let sum = 0;
      for (const key in this.metrics) {
        if (key === "total") {
          continue;
        }
        sum += this.metrics[key].buffer[0];
      }
      if (this.metrics.total === undefined) {
        this.metrics.total = {};
        this.metrics.total.buffer = [];
      }
      const total = this.metrics.total;
      total.buffer[0] = sum;
    }
  }

  const Perf = new Performance();

  let focus = 0;
  let ticksSinceInput = 0;

  let ticks = 0;
  let lastFrame = millis();
  let collisions = [];

  const font = createFont("sans-serif");
  const fontBold = createFont("sans-serif Bold");

  for (let i = 0; i < boxes.length; i++) {
    const client = boxes[i];
    const aabb = client.hitbox.aabb;
    client.getInput();
    world.newClient(client, client.position.add(aabb.center), new Vector(aabb.width, aabb.height));
  }
  const collisionSet = new Set();
  function draw() {
    lastFrame = millis();
    Perf.resetMetrics();
    collisionSet.clear();
    collisions = [];
    cellsChecked = 0;
    ticksSinceInput++;
    background(new Color(255, 255, 255).value());
    fill(255, 0, 0);
    world.draw();

    Perf.getTime();

    if (keys[32] & (ticksSinceInput >= 30)) {
      focus = (focus + 1) % boxes.length;
      ticksSinceInput = 0;
    }
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      box.update();
      if (focus === i) {
        box.getInput();
      }
      box.hitbox.broadUpdate(box);
      Perf.updateMetric("broadUpdate");
      world.update(box);
      Perf.updateMetric("gridUpdate");
    }

    // check collisions
    let collisionChecks = 0;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      const aabb = box.hitbox.aabb;
      Perf.getTime();
      const clients = world.findNear(box.position.add(aabb.center), aabb.width, aabb.height);
      Perf.updateMetric("hashGridQuery");

      let seenIDs = new Set();
      seenIDs.add(box.id);
      for (let j = 0; j < clients.length; j++) {
        // skip duplicate clients (from double overlaps)
        if (seenIDs.has(clients[j].id)) {
          continue;
        }
        const client = clients[j];
        seenIDs.add(client.id);
        // skip duplicate collision checks
        const formattedCollision = box.id < client.id ? box.id + "," + client.id : client.id + "," + box.id;
        if (collisionSet.has(formattedCollision)) {
          continue;
        }
        collisionSet.add(formattedCollision);
        // quick radii check
        const sqDistance = box.hitbox.center
          .add(box.position)
          .subtract(client.hitbox.center.add(client.position))
          .sqMag();
        const radiiSum = box.hitbox.radius + client.hitbox.radius;
        if (sqDistance > sq(radiiSum)) {
          continue;
        }
        Perf.updateMetric("priorCheck");

        // narrow update before full check
        box.hitbox.narrowUpdate(box);
        client.hitbox.narrowUpdate(client);
        Perf.updateMetric("narrowUpdate");

        const collision = box.checkCollision(client, visualize && (box.id === focus || client.id === focus));
        Perf.updateMetric("satCheck");
        collisionChecks++;
        if (collision.colliding) {
          collisions.push(collision);
        }
      }
    }

    if (ticks === 0) {
      Perf.getTime();
      Perf.updateMetric("priorCheck");
      Perf.updateMetric("narrowUpdate");
      Perf.updateMetric("satCheck");
    }

    // handle collisions
    for (let i = 0; i < collisions.length; i++) {
      const collision = collisions[i];
      collision.baseA.handleCollision(collision);
    }
    Perf.updateMetric("handleCollisions");

    // draw them boxes
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      stroke(46, 46, 46);
      strokeWeight(1);
      box.draw();
      fill(211, 175, 55);
      ellipse(
        box.position.x + box.hitbox.center.x + canvasHalfWidth,
        box.position.y + box.hitbox.center.y + canvasHalfHeight,
        5,
        5
      );
    }
    Perf.updateMetric("drawBoxes");

    Perf.getTotal();

    const countMetrics = [
      "Cells Filled",
      Object.keys(world.grid).length,
      "Cells Checked",
      cellsChecked,
      "SAT Calls",
      collisionChecks,
      "Object Count",
      boxes.length,
      "Collision Count",
      collisions.length
    ];

    const dataToDisplay = ["average", "max", "percentage"];
    textSize(12);
    fill(0, 0, 0, 120);
    pushMatrix();
    rect(4, 4, dataToDisplay.length * 256, 4 + Object.keys(Perf.metrics).length * 40 + 32);
    fill(255, 255, 255);
    textAlign(LEFT, TOP);

    if (ticks % displayPeriod === 0) {
      let out = {};
      Perf.getMetricData("total", out);
      Perf.metrics.total.savedData = Object.assign({}, out);
      for (const key in Perf.metrics) {
        Perf.getMetricData(key, out);
        Perf.metrics[key].savedData = Object.assign({}, out);
      }
    }

    textFont(fontBold, 24);

    text("Key", 8, 8);
    let dx = 256;
    for (const dataKey of dataToDisplay) {
      text(dataKey[0].toUpperCase() + dataKey.slice(1), dx, 8);
      dx += 140;
    }

    fill(255, 255, 255);
    noStroke();
    rect(8, 42, dataToDisplay.length * 210 + 60, 2);

    textFont(font, 24);
    let dy = 48;

    for (const key in Perf.metrics) {
      const metric = Perf.metrics[key].savedData;

      let formattedKey = [];
      for (let i = 0; i < key.length; i++) {
        const character = key[i];
        if (i === 0) {
          formattedKey.push(character.toUpperCase());
          continue;
        }
        if (character.toUpperCase() === character) {
          formattedKey.push(" ", character);
        } else {
          formattedKey.push(character);
        }
      }

      text(formattedKey.join("") + ": ", 8, dy);

      let dx = 256;
      for (const dataKey of dataToDisplay) {
        let data = metric[dataKey];
        const unit = dataKey === "percentage" ? "%" : "ms";
        data = isNaN(data) ? displayPeriod - ticks : `${data.toFixed(3)} ${unit}`;

        text(data, dx, dy);
        dx += 140;
      }

      dy += 40;
    }

    fill(0, 0, 0, 120);
    stroke(0);
    rect(4, height - 4, 230, -4 - countMetrics.length * 20);
    fill(255);
    textAlign(LEFT, TOP);
    for (let i = 0; i < countMetrics.length; i += 2) {
      text(`${countMetrics[i]}: ${countMetrics[i + 1]}`, 8, height - 4 - countMetrics.length * 20 + i * 20);
    }
    popMatrix();

    ticks += dt;
  }
}

runPJS(program);

// Add reload button on KA --> <script>
