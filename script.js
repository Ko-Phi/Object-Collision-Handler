function program() {
  title("Mass Object Collision Handler");
  size(1800, 1200);

  const canvasHalfWidth = width / 2;
  const canvasHalfHeight = height / 2;

  // Simulation Options
  const initialVelocity = false; // objects begin with an intial velocity
  const periodicVelocityShifts = false; // velocity randomized periodically
  const velocityMagnitude = 5; // alters the magnitude of said velocity

  const collisionImpulse = true; // objects bounce off each other on collision
  const restitution = 1; // collision bounciness. Values < 1 yield loss of energy. Values > 1 break the first law of thermodynamics
  const mu = 0; // add friction (should be quite small)

  const allCircles = false; // all shapes are circles. Increases performance as well
  const allPolys = false; // all shapes are polygons. Slightly more performance intensive
  const gridSize = 50; // influences hashgrid check. Can queak for minor performance improvement

  // Box Count
  const insertCount = 0;
  const scale = 32;
  const scaleVariance = 0.3;
  // const moreBoxes = true; // replaces the usual two boxes with 5
  // const veryMoreBoxes = true; // a lot of boxes
  // const considerablyLargeAmountOfBoxesToInsert = true; // way too many boxes

  // Visuals
  // 16.67 ms is the sweet spot. If your device can average below this, you can swap to 60 fps
  const FPS = insertCount >= 750 ? 30 : 60;
  const drawAsCircles = false; // shapes drawn as circles. Increases performance
  const displayAABB = false; // aabbs drawn. Uses rect() so not very good for performance
  const displayGridCheck = false; // checked grids are highlighted. Very performance intensive
  const sameColor = false; // shapes drawn with the same color. Minor performance gain
  const displayTriangulation = true;

  angleMode = "radians";
  frameRate(FPS);
  const dt = 60 / FPS;

  // quite small
  const epsilon = 1e-6;
  const rounD = (num, deciPlace) => round(num * pow(10, deciPlace)) / pow(10, deciPlace);

  Array.prototype.getItem = function (index) {
    if (index >= this.length) return this[index % this.length];
    else if (index < 0) return this[(index % this.length) + this.length];
    else return this[index];
  };

  let idCount = 0;
  const newid = () => idCount++;

  var keys = Array(100).fill(false);
  keyPressed = () => (keys[keyCode] = true);
  keyReleased = () => (keys[keyCode] = false);

  // componentInit: x, y
  // dirMagInit: dir, mag
  class Vector {
    constructor(input1, input2, init = "component") {
      let x, y;
      if (init === "component") [x, y] = [input1, input2];
      if (init === "dirMag") [x, y] = [input2 * Math.cos(input1), input2 * Math.sin(input1)];
      [this.x, this.y] = [x, y];
    }
    copy = () => new Vector(this.x, this.y);
    getSqMag = () => sq(this.x) + sq(this.y);
    getMag = () => sqrt(this.getSqMag());
    theta = () => Math.atan2(this.y, this.x);
    add(vector) {
      let vectorX, vectorY;
      if (typeof vector === "number") vectorX = vectorY = vector;
      else [vectorX, vectorY] = [vector.x, vector.y];
      this.x += vectorX;
      this.y += vectorY;
      return this;
    }
    subtract(vector) {
      let vectorX, vectorY;
      if (typeof vector === "number") vectorX = vectorY = vector;
      else [vectorX, vectorY] = [vector.x, vector.y];
      this.x -= vectorX;
      this.y -= vectorY;
      return this;
    }
    multiply(vector) {
      let vectorX, vectorY;
      if (typeof vector === "number") vectorX = vectorY = vector;
      else [vectorX, vectorY] = [vector.x, vector.y];
      this.x *= vectorX;
      this.y *= vectorY;
      return this;
    }
    divide(vector) {
      let vectorX, vectorY;
      if (typeof vector === "number") vectorX = vectorY = vector;
      else [vectorX, vectorY] = [vector.x, vector.y];
      this.x /= vectorX;
      this.y /= vectorY;
      return this;
    }
    normalize() {
      const mag = this.getMag();
      if (mag === 0) return this;
      return this.divide(mag);
    }
    dotProduct(vector) {
      let vectorX, vectorY;
      if (typeof vector === "number") vectorX = vectorY = vector;
      else [vectorX, vectorY] = [vector.x, vector.y];
      return this.x * vector.x + this.y * vector.y;
    }
    crossProduct(vector) {
      let vectorX, vectorY;
      if (typeof vector === "number") vectorX = vectorY = vector;
      else [vectorX, vectorY] = [vector.x, vector.y];
      return -(this.x * vectorY - this.y * vectorX);
    }
    perpendicular() {
      [this.x, this.y] = [-this.y, this.x];
      return this;
    }
    display = () => rounD(this.x, 3) + ", " + rounD(this.y, 3);
    equalTo = (vector) => this.x === vector.x && this.y === vector.y;
  }

  class Color {
    constructor(c1, c2, c3, input1, input2) {
      let alpha, model;
      if (input1 === undefined) [alpha, model] = [255, "RGB"];
      else if (typeof input1 === "string") [alpha, model] = [255, input1];
      else [alpha, model] = [input1, input2];

      this.channels = [c1, c2, c3, alpha];
      this.model = model;
      this.cachedValue = this.value();
    }
    toRGB() {
      if (this.model === "RGB") return;
      const [hue, sat, val] = [this.channels[0], this.channels[1], this.channels[2]];
      const hueP = hue / 60;
      const chroma = val * sat;
      const x = chroma * (1 - abs((hueP % 2) - 1));

      let r, g, b;
      if (hueP < 1) [r, g, b] = [chroma, x, 0];
      else if (hueP < 2) [r, g, b] = [x, chroma, 0];
      else if (hueP < 3) [r, g, b] = [0, chroma, x];
      else if (hueP < 4) [r, g, b] = [0, x, chroma];
      else if (hueP < 5) [r, g, b] = [x, 0, chroma];
      else if (hueP < 6) [r, g, b] = [chroma, 0, x];

      const m = val - chroma;
      this.channels[0] = (r + m) * 255;
      this.channels[1] = (g + m) * 255;
      this.channels[2] = (b + m) * 255;
      this.model = "RGB";
    }
    toHSV() {
      if (this.model === "HSV") return;
      const rP = this.channels[0] / 255;
      const gP = this.channels[1] / 255;
      const bP = this.channels[2] / 255;
      const cMax = max(rP, max(gP, bP));
      const cMin = min(rP, min(gP, bP));
      const delta = cMax - cMin;

      let hue, sat, val;
      if (delta === 0) hue = 0;
      if (cMax === rP) hue = (((gP - bP) / delta) % 6) * 60;
      if (cMax === gP) hue = ((bP - rP) / delta + 2) * 60;
      if (cMax === bP) hue = ((rP - gP) / delta + 4) * 60;

      sat = cMax === 0 ? 0 : delta / cMax;
      val = cMax;

      this.channels[0] = hue;
      this.channels[1] = sat;
      this.channels[2] = val;
      this.model = "HSV";
    }
    value() {
      if (this.model === "HSV") this.toRGB();
      return color(this.channels[0], this.channels[1], this.channels[2], this.channels[3]);
    }
  }

  let cellsChecked = 0;
  class SpatialHashGrid {
    constructor(cellSize) {
      this.grid = new Map();
      this.cellSize = cellSize;
      this.queryIds = 0;
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
      this.queryId = -1;
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
          if (!this.grid.has(key)) this.grid.set(key, new Set());
          this.grid.get(key).add(client);
        }
      }
    }
    queryGrid(position, width, height) {
      const x = position.x;
      const y = position.y;

      // get span of checked area
      const index1 = this.getCellIndex(x - width / 2, y - height / 2);
      const index2 = this.getCellIndex(x + width / 2, y + height / 2);

      // iterate over spanned area for clients
      if (displayGridCheck) {
        pushMatrix();
        translate(canvasHalfWidth, canvasHalfHeight);
        fill(180, 30);
        stroke(180, 90);
      }
      let clients = [];
      const queryId = this.queryIds++;
      for (let x = index1.x; x <= index2.x; ++x) {
        for (let y = index1.y; y <= index2.y; ++y) {
          let key = this.key(x, y);
          if (!this.grid.has(key)) continue;
          for (const client of this.grid.get(key)) {
            if (client.queryId !== queryId) {
              client.queryId = queryId;
              clients.push(client);
            }
          }
          if (displayGridCheck) rect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
          cellsChecked++;
        }
      }
      if (displayGridCheck) popMatrix();
      return clients;
    }
    remove(client) {
      const index1 = client.indices[0];
      const index2 = client.indices[1];
      // iterate over client's span, removing it from each cell
      for (let x = index1.x; x <= index2.x; ++x) {
        for (let y = index1.y; y <= index2.y; ++y) {
          const key = this.key(x, y);
          const cell = this.grid.get(key);
          cell.delete(client);
          if (cell.size === 0) this.grid.delete(key);
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
      stroke(204);
      pushMatrix();
      translate(canvasHalfWidth, canvasHalfHeight);
      for (let x = ceil(-width / this.cellSize) * this.cellSize; x <= canvasHalfWidth; x += this.cellSize)
        line(x, height, x, -height);
      for (let y = ceil(-height / this.cellSize) * this.cellSize; y <= canvasHalfHeight; y += this.cellSize)
        line(width, y, -width, y);
      popMatrix();
    }
  }

  const world = new SpatialHashGrid(gridSize);

  function regularPolyVerts(x, y, radius, sideCount) {
    const vertices = [];
    for (let i = 0; i < sideCount; i++)
      vertices.push(
        new Vector(
          x + radius * Math.cos((2 * PI * i) / sideCount),
          y + radius * Math.sin((2 * PI * i) / sideCount)
        )
      );
    return vertices;
  }
  function polyVerts(...inputs) {
    let vertices = [];
    for (let i = 0; i < inputs.length; i += 2) vertices.push(new Vector(inputs[i], inputs[i + 1]));
    return vertices;
  }

  function newPolygon(vertices, color, type, rho) {
    type = type || "Polygon";
    return new Shape({
      vertices: vertices,
      color: color,
      type: type,
      rho: rho
    });
  }
  function newCircle(center, radius, color, rho) {
    return new Shape({
      type: "Circle",
      center: center,
      radius: radius,
      color: color,
      rho: rho
    });
  }

  class Shape {
    constructor(params) {
      this.color = params.color;
      this.type = params.type || "Polygon";
      if (this.type === "Polygon") this.vertices = params.vertices;
      else if (this.type === "Circle") {
        this.center = params.center ?? new Vector(0, 0);
        this.radius = params.radius;
      }
    }

    draw(dx = 0, dy = 0, base) {
      if (!sameColor) fill(this.color.cachedValue);
      if (this.type === "Polygon") {
        beginShape();
        for (const vert of this.vertices) vertex(vert.x + dx, vert.y + dy);
        endShape(CLOSE);
      } else if (this.type === "Circle") {
        ellipse(this.center.x, this.center.y, this.radius * 2, this.radius * 2);
        line(this.center.x, this.center.y, this.radius * cos(base.dir), this.radius * sin(base.dir));
      }
    }
  }

  class Hitbox extends Shape {
    constructor(shape, base, params) {
      super(shape);
      this.rotatedVertices = [];
      this.transformedVertices = [];
      this.normals = [];
      this.cachedDir = null;
      this.lastUpdate = "None";
      this.aabb = {};
      this.cachedNormals = [];

      this.cacheUpdate(base);
      this.shallowUpdate(base);
      this.trianglesIndices = this.getTriangleIndices();

      this.rho = params.rho ?? 1;
      this.area = this.getArea();
      this.mass = this.rho * this.area;
      this.momentOfInertia = this.getMomentOfInertia();

      if (this.type === "Polygon") {
        const sum =
          this.vertices.reduce((area, vertex, index, vertices) => {
            const nextVertex = vertices[(index + 1) % vertices.length];
            return area + vertex.crossProduct(nextVertex);
          }, 0) < 0;
        if (sum > 0) {
          console.log("CW");
        } else console.log("CCW");
      }
    }
    getCentroid(vertices) {
      vertices = vertices ?? this.vertices;
      return vertices.reduce((sum, vertex) => sum.add(vertex), new Vector(0, 0)).divide(vertices.length);
    }
    getArea(vertices) {
      vertices = vertices ?? this.vertices;
      if (this.type === "Circle") return PI * sq(this.radius);
      // something something shoelaces
      return (
        abs(
          vertices.reduce((area, vertex, index, vertices) => {
            const nextVertex = vertices[(index + 1) % vertices.length];
            return area + vertex.crossProduct(nextVertex);
          }, 0)
        ) / 2
      );
    }
    getMomentOfInertia(vertices) {
      if (this.type === "Circle") return 0.5 * this.getArea() * this.rho * sq(this.radius);

      vertices = vertices ?? this.vertices;
      const area = this.area ?? Hitbox.prototype.getArea(vertices);
      const trianglesIndices = this.trianglesIndices ?? Hitbox.prototype.getTriangleIndices(vertices);

      if (vertices.length === 3) {
        // follows formula I = M / 6 * (a^2 + b^2 + c^2) for triangular lamina about their polar centroidal axis. very clean indeed
        return (
          (area / 36) *
          vertices.reduce((sqSideLengthSum, vertex, index) => {
            const nextVertex = vertices[(index + 1) % vertices.length];
            return sqSideLengthSum + nextVertex.copy().subtract(vertex).getSqMag();
          }, 0)
        );
      }

      let centroid = this.centroid ?? Hitbox.prototype.getCentroid(vertices);

      let trianglesVertices = [];
      for (let i = 0; i < trianglesIndices.length; i += 3) {
        trianglesVertices.push([
          vertices[trianglesIndices[i]],
          vertices[trianglesIndices[i + 1]],
          vertices[trianglesIndices[i + 2]]
        ]);
      }

      return trianglesVertices.reduce((sum, triangleVertices) => {
        // follows parallel axis theorem (I = I_cm + Md^2)
        let momentOfInertia = Hitbox.prototype.getMomentOfInertia(triangleVertices);
        let radiusSquared = Hitbox.prototype.getCentroid(triangleVertices).subtract(centroid).getSqMag();
        let mass = Hitbox.prototype.getArea(triangleVertices) * this.rho;
        return sum + momentOfInertia + mass * radiusSquared;
      }, 0);
    }
    getTriangleIndices(vertices) {
      if (this.type === "Circle") return;
      vertices = vertices ?? this.vertices;
      let trianglesIndices = [];
      let vertexIndices = vertices.map((_, index) => index);
      let attempts = 0;
      while (vertexIndices.length > 3 && attempts < 300) {
        checkPossibleEar: for (let i = 0; i < vertexIndices.length; i++) {
          const indexA = vertexIndices.getItem(i - 1);
          const indexB = vertexIndices[i];
          const indexC = vertexIndices.getItem(i + 1);

          const vertexA = vertices[indexA];
          const vertexB = vertices[indexB];
          const vertexC = vertices[indexC];

          const vectorBA = vertexA.copy().subtract(vertexB);
          const vectorBC = vertexC.copy().subtract(vertexB);
          // reflex check
          if (vectorBA.crossProduct(vectorBC) < 0) continue;

          // point-triangle overlap check
          for (let j = 0; j < vertices.length; j++) {
            const triangleVertices = [vertexA, vertexB, vertexC];

            const point = vertices[j];
            if (triangleVertices.some((vertex) => vertex === point)) continue;

            let hasNegative, hasPositive;
            triangleVertices.forEach((vector, indexIndex, thisArray) => {
              const currentVertex = vector;
              const nextVertex = thisArray.getItem(indexIndex + 1);

              const vectorCurrNext = nextVertex.copy().subtract(currentVertex);

              const vectorCurrPoint = point.copy().subtract(currentVertex);

              const result = vectorCurrNext.crossProduct(vectorCurrPoint);
              if (result < 0) hasNegative = true;
              if (result > 0) hasPositive = true;
            });
            if (!(hasPositive && hasNegative)) continue checkPossibleEar;
          }

          trianglesIndices.push(indexA, indexB, indexC);
          vertexIndices = vertexIndices.filter((index) => index !== indexB);
          break;
        }
        attempts++;
      }
      if (attempts > 300) console.log("failure");
      trianglesIndices.push(...vertexIndices);
      return trianglesIndices;
    }
    drawTriangles(base) {
      noFill();
      for (let i = 0; i < this.trianglesIndices.length; i += 3) {
        base.trueColor.toHSV();
        stroke(0, 0, 0, 30);
        let hue = base.trueColor.channels[0];
        hue = map(i, 0, this.trianglesIndices.length - 1, hue, hue + 20);
        fill(new Color(hue, 0.6, 1, "HSV").value());
        triangle(
          this.vertices[this.trianglesIndices[i]].x,
          this.vertices[this.trianglesIndices[i]].y,
          this.vertices[this.trianglesIndices[i + 1]].x,
          this.vertices[this.trianglesIndices[i + 1]].y,
          this.vertices[this.trianglesIndices[i + 2]].x,
          this.vertices[this.trianglesIndices[i + 2]].y
        );
      }
    }
    cacheUpdate(base) {
      // cache everything
      if (this.type === "Circle") {
        this.aabb.width = this.radius * 2;
        this.aabb.height = this.aabb.width;
        this.aabb.center = this.center;
        this.cachedCenter = this.center.copy(); // creates copy
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
          sum.add(vertex);
        }
        this.cachedCenter = sum.copy().divide(this.vertices.length);
        if (this.cachedCenter.getSqMag() < epsilon) [this.cachedCenter.x, this.cachedCenter.y] = [0, 0];
        this.center = this.cachedCenter.copy();

        let maxSqRadius = -Infinity;
        for (let i = 0; i < this.rotatedVertices.length; i++) {
          const vertex = this.rotatedVertices[i];
          const nextVertex = this.rotatedVertices[(i + 1) % this.rotatedVertices.length];
          const edge = nextVertex.copy().subtract(vertex);
          let normal = edge.copy().perpendicular().normalize();

          const direction = this.cachedCenter.copy().subtract(normal);
          maxSqRadius = max(vertex.copy().subtract(this.center).getSqMag(), maxSqRadius);
          const dotProd = normal.x * direction.x + normal.y * direction.y;
          if (dotProd < 0) normal.multiply(-1);
          this.cachedNormals[i] = normal.normalize();
          this.normals[i] = this.cachedNormals[i].copy();
        }
        for (const normal of this.cachedNormals) if (normal.getMag() > 1) println("oh no");
        this.radius = sqrt(maxSqRadius);
        // Better for more uniform shapes (this scenario)
        this.aabb.width = 2 * this.radius;
        this.aabb.height = 2 * this.radius;
        this.aabb.center = this.center;
      }
    }

    shallowUpdate(base) {
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
      if (!displayAABB) return;
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
      ellipse(
        center.x + position.x + canvasHalfWidth,
        center.y + position.y + canvasHalfHeight,
        radius * 2,
        radius * 2
      );
    }
    narrowUpdate(base) {
      if (this.type === "Circle" || this.lastUpdate !== "AABB") return;
      this.lastUpdate = "SAT";

      const position = base.position;
      const dir = base.dir;
      const cosT = Math.cos(dir);
      const sinT = Math.sin(dir);
      // recalc transformed vertices and normals
      for (let i = 0; i < this.vertices.length; i++) {
        const vertex = this.vertices[i];
        const rotatedVertex = this.rotatedVertices[i];

        rotatedVertex.x = vertex.x * cosT - vertex.y * sinT;
        rotatedVertex.y = vertex.x * sinT + vertex.y * cosT;

        this.transformedVertices[i] = rotatedVertex.copy().add(position);

        this.normals[i].x = this.cachedNormals[i].x * cosT - this.cachedNormals[i].y * sinT;
        this.normals[i].y = this.cachedNormals[i].x * sinT + this.cachedNormals[i].y * cosT;
      }
    }
    project(axis, base, out) {
      let min, max;
      if (this.type === "Circle") {
        const center = this.center.copy().add(base.position);
        const projection = axis.dotProduct(center);
        const radiusProjection = this.radius * axis.getMag();
        min = projection - radiusProjection;
        max = projection + radiusProjection;
      } else {
        max = min = axis.x * this.transformedVertices[0].x + axis.y * this.transformedVertices[0].y;
        for (const vert of this.transformedVertices) {
          const projection = axis.x * vert.x + axis.y * vert.y;
          if (projection < min) min = projection;
          else if (projection > max) max = projection;
        }
      }
      [out.min, out.max] = [min, max];
    }
    closestPointToCenterOf = function (base) {
      let closestPoint;
      let minDistanceSquared = Infinity;
      const center = base.position.copy().add(base.hitbox.center);
      // loop over this object's edges
      const vertices = this.transformedVertices;
      for (let i = 0; i < vertices.length; i++) {
        const vertexA = vertices[i];
        const vertexB = vertices[(i + 1) % vertices.length];

        // get closest point on side
        const sideAB = vertexB.copy().subtract(vertexA);
        const sideACenter = center.copy().subtract(vertexA);
        let projection = sideACenter.dotProduct(sideAB) / sideAB.getSqMag();
        projection = constrain(projection, 0, 1);

        const point = vertexA.copy().add(sideAB.copy().multiply(projection));
        const difference = point.copy().subtract(center);
        const distanceSquared = difference.getSqMag();
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
      this.position = params.position ?? new Vector(0, 0);
      this.dir = params.dir || 0;
      this.shape = params.shape || 0;
      this.trueColor = new Color(random(-15, 40), 0.6, 1, "HSV");

      this.hitbox = new Hitbox(params.shape, this, params);
      this.axesBuffer = [];
      if (initialVelocity) {
        this.velocity = new Vector(random(0, 2 * PI), velocityMagnitude * random(0.75, 1.25), "dirMag");
        this.omega = random(-0.5, 0.5);
      } else {
        this.velocity = new Vector(0, 0);
        this.omega = 0;
      }
      this.velocity = params.velocity ?? this.velocity;
      this.ticks = floor(random(0, 50));
    }
    getInput() {
      const input_x = (keys[RIGHT] || keys[68]) - (keys[LEFT] || keys[65]);
      const input_y = (keys[DOWN] || keys[83]) - (keys[UP] || keys[87]);
      const input_dir = keys[69] - keys[81];
      this.position.add(new Vector(input_x, input_y).normalize());
      this.dir += input_dir / 20;
    }
    update() {
      this.ticks++;
      this.position.add(this.velocity.copy().multiply(dt));
      this.dir += this.omega * dt;

      const velocity = this.velocity.getMag();
      if (velocity > mu) this.velocity.subtract(this.velocity.copy().multiply(mu / velocity));
      else this.velocity = new Vector(0, 0);

      if (abs(this.position.x) > canvasHalfWidth + this.hitbox.aabb.width / 2) {
        this.position.x = -Math.sign(this.position.x) * (canvasHalfWidth + this.hitbox.aabb.width / 2);
      }
      if (abs(this.position.y) > canvasHalfHeight + this.hitbox.aabb.height / 2) {
        this.position.y = -Math.sign(this.position.y) * (canvasHalfHeight + this.hitbox.aabb.width / 2);
      }

      if (this.ticks % (60 * dt) === 0 && periodicVelocityShifts) {
        this.velocity = new Vector(random(0, 2 * PI), velocityMagnitude * random(0.75, 1.25), "dirMag");
        this.omega = random(-0.01, 0.01) * scale;
      }

      if (focus === this.id) this.shape.color = new Color(110, 0.4, 1, "HSV");
      else this.shape.color = this.trueColor;
    }
    draw() {
      pushMatrix();
      translate(this.position.x + canvasHalfWidth, this.position.y + height / 2);
      if (this.shape.type !== "Circle") rotate(this.dir);
      this.shape.draw(0, 0, this);
      if (this.hitbox.type !== "Circle" && displayTriangulation) this.hitbox.drawTriangles(this);
      popMatrix();
    }
    checkCollision(otherBase) {
      const baseA = this;
      const baseB = otherBase;
      const tCenterA = baseA.hitbox.center.copy().add(baseA.position);
      const tCenterB = baseB.hitbox.center.copy().add(baseB.position);

      this.axesBuffer.length = 0;
      // common seperation axis first
      this.axesBuffer.push(tCenterB.copy().subtract(tCenterA).normalize());
      for (const normal of baseA.hitbox.normals) this.axesBuffer.push(normal);
      for (const normal of baseB.hitbox.normals) this.axesBuffer.push(normal);

      let axes = this.axesBuffer;
      // Circle-Circle test
      if (baseA.hitbox.type === baseB.hitbox.type && baseA.hitbox.type === "Circle") {
        const sqDistance = baseA.hitbox.center
          .copy()
          .add(baseA.position)
          .subtract(baseB.hitbox.center.copy().add(baseB.position))
          .getSqMag();
        const radiiSum = baseA.hitbox.radius + baseB.hitbox.radius;
        if (sqDistance > sq(radiiSum)) {
          return { colliding: false };
        } else {
          const overlap = sqrt(sqDistance) - radiiSum;
          const normal = tCenterA.copy().subtract(tCenterB).normalize();
          return {
            colliding: true,
            axis: normal,
            overlap: overlap,
            MTV: normal.copy().multiply(overlap),
            baseA: baseA,
            baseB: baseB
          };
        }
      }

      // Polygon-Polygon / Circle-Polygon Test
      // project each hitbox on each axis, checking for seperation
      let minOverlap = Infinity;
      let minNormal;
      for (const axis of axes) {
        // project each hitbox's vertices
        const projA = { min: null, max: null };
        const projB = { min: null, max: null };
        baseA.hitbox.project(axis, baseA, projA);
        baseB.hitbox.project(axis, baseB, projB);

        // check if seperate
        if (projA.max < projB.min || projB.max < projA.min) return { colliding: false };

        const overlap = min(projA.max, projB.max) - max(projA.min, projB.min);
        if (overlap < minOverlap) {
          minOverlap = overlap;
          minNormal = axis;
        }
      }

      // Circle-Polygon Edge Case
      if (baseA.hitbox.type !== baseB.hitbox.type) {
        // get closest point on edge and add to normals
        let circleBase, otherBase;
        if (baseA.hitbox.type === "Circle") [circleBase, otherBase] = [baseA, baseB];
        else [circleBase, otherBase] = [baseB, baseA];
        const center = circleBase.position.copy().add(circleBase.hitbox.center);

        const closestPoint = otherBase.hitbox.closestPointToCenterOf(circleBase);
        const axis = closestPoint.copy().subtract(center).normalize();

        // project each hitbox's vertices
        const projA = { min: null, max: null };
        const projB = { min: null, max: null };
        baseA.hitbox.project(axis, baseA, projA);
        baseB.hitbox.project(axis, baseB, projB);

        // check if seperate
        if (projA.max < projB.min || projB.max < projA.min) return { colliding: false };

        const overlap = min(projA.max, projB.max) - max(projA.min, projB.min);
        if (overlap < minOverlap) {
          minOverlap = overlap;
          minNormal = axis;
        }
      }

      // reorient axis when neccessary
      const direction = tCenterB.copy().subtract(tCenterA);
      const dotProd = minNormal.x * direction.x + minNormal.y * direction.y;
      if (dotProd < 0) minNormal.multiply(-1);

      return {
        colliding: true,
        axis: minNormal,
        overlap: minOverlap,
        baseA: baseA,
        baseB: baseB
      };
    }
    handleCollision(data) {
      if (!data.colliding) return;
      const axis = data.axis;
      const tangent = axis.copy().perpendicular();
      const MTV = data.axis.copy().multiply(data.overlap);
      const baseB = data.baseB;
      const baseA = data.baseA;
      const bases = [baseA, baseB];

      const massA = baseA.hitbox.mass,
        massB = baseB.hitbox.mass;

      const displacementA = MTV.copy().multiply(massB / (massA + massB));
      const displacementB = MTV.copy().multiply(massA / (massA + massB));
      baseA.position.subtract(displacementA);
      baseB.position.add(displacementB);
      // get contact points
      let contactPoint = null;
      let minDistanceSquared = Infinity;
      const collisionType = baseA.hitbox.type + "-" + baseB.hitbox.type;
      if (collisionType === "Polygon-Polygon") {
        /* Visualization:
         * A is the checked vertex. BC is the current edge of the other base. P is the closest point
              /B
             / |
            /  |
           A---P
            \  |
             \ |
              \C
        */

        // base loop
        bases.forEach((base, index, bases) => {
          const otherBase = bases.getItem(index + 1);
          const vertices = base.hitbox.transformedVertices;
          const otherVertices = otherBase.hitbox.transformedVertices;
          // vertex loop
          vertices.forEach((vertexA) => {
            // side loop
            otherVertices.forEach((vertexB, index, bVertices) => {
              const vertexC = bVertices.getItem(index + 1);
              const sideBC = vertexC.copy().subtract(vertexB);
              const sideBA = vertexA.copy().subtract(vertexB);

              let projection = sideBA.dotProduct(sideBC) / sideBC.getSqMag();
              projection = constrain(projection, 0, 1);

              const point = vertexB.copy().add(sideBC.copy().multiply(projection));
              const sideAP = point.copy().subtract(vertexA);
              const distanceSquared = sideAP.getSqMag();
              if (distanceSquared < minDistanceSquared) {
                contactPoint = point;
              }
            });
          });
        });
      } else if (collisionType === "Polygon-Circle" || collisionType === "Circle-Polygon") {
        let circleBase, otherBase;
        if (baseA.hitbox.type === "Circle") [circleBase, otherBase] = [baseA, baseB];
        else [circleBase, otherBase] = [baseB, baseA];
        contactPoint = otherBase.hitbox.closestPointToCenterOf(circleBase);
      } else if (collisionType === "Circle-Circle") {
        const centerAToCenterB = baseB.position.copy().subtract(baseA.position).normalize();
        contactPoint = baseA.position.copy().add(centerAToCenterB.copy().multiply(baseA.hitbox.radius));
      }

      if (!collisionImpulse) return;

      if (axis.getMag() > 1.1) println("Non normalized axis");

      const vectorAC = contactPoint.copy().subtract(baseA.position);
      const vectorBC = contactPoint.copy().subtract(baseB.position);
      const contactVelocityA = baseA.velocity
        .copy()
        .add(new Vector(baseA.omega * -vectorAC.y, baseA.omega * vectorAC.x));
      const contactVelocityB = baseB.velocity
        .copy()
        .add(new Vector(baseB.omega * -vectorBC.y, baseB.omega * vectorBC.x));

      const velocityAB = contactVelocityB.copy().subtract(contactVelocityA);

      const inertiaA = baseA.hitbox.momentOfInertia;
      const inertiaB = baseB.hitbox.momentOfInertia;
      const impulseScalar =
        velocityAB
          .copy()
          .multiply(-1 - restitution)
          .dotProduct(axis) /
        (axis.dotProduct(axis.copy().multiply(1 / massA + 1 / massB)) +
          sq(vectorAC.crossProduct(axis)) / inertiaA +
          sq(vectorBC.crossProduct(axis)) / inertiaB);

      baseA.velocity.subtract(axis.copy().multiply(impulseScalar / massA));
      baseA.omega += (vectorAC.crossProduct(axis) * impulseScalar) / inertiaA;

      baseB.velocity.add(axis.copy().multiply(impulseScalar / massB));
      baseB.omega -= (vectorBC.crossProduct(axis) * impulseScalar) / inertiaB;

      /*
      const pVelocityA = baseA.velocity.dotProduct(axis);
      const tVelocityA = baseA.velocity.dotProduct(tangent);
      const pVelocityB = baseB.velocity.dotProduct(axis);
      const tVelocityB = baseB.velocity.dotProduct(tangent);

      baseA.velocity = axis
        .copy()
        .multiply(
          massA * pVelocityA +
            massB * pVelocityB -
            massB * restitution * (pVelocityA - pVelocityB),
        )
        .divide(massA + massB)
        .add(tangent.copy().multiply(tVelocityA));
      baseB.velocity = axis
        .copy()
        .multiply(
          massA * pVelocityA +
            massB * pVelocityB +
            massA * restitution * (pVelocityA - pVelocityB),
        )
        .divide(massA + massB)
        .add(tangent.copy().multiply(tVelocityB));
      */
    }
  }

  let boxes = [];
  for (let i = 0; i < insertCount; i++) {
    const shape =
      (ceil(random(0, 5)) > 3 && !allCircles) || allPolys
        ? newPolygon(
            regularPolyVerts(
              0,
              0,
              ceil(scale * random(1 - scaleVariance, 1 + scaleVariance)),
              ceil(random(2, 10))
            ),
            new Color(255, 0, 0)
          )
        : newCircle(new Vector(0, 0), ceil(scale * random(0.9, 1.1)), new Color(255, 0, 0));
    boxes.push(
      new Base({
        position: new Vector(
          random(-canvasHalfWidth, canvasHalfWidth),
          random(-canvasHalfHeight, canvasHalfHeight)
        ),
        dir: random(0, 2 * PI),
        shape: shape
      })
    );
  }
  if (insertCount === 0)
    boxes.push(
      new Base({
        position: new Vector(-100, 0),
        dir: 0,
        velocity: new Vector(1, 0),
        //shape: newPolygon(regularPolyVerts(0, 0, 35, 4), new Color(255, 0, 0))
        shape: newCircle(new Vector(0, 0), 20, new Color(255, 0, 0))
      }),
      new Base({
        position: new Vector(100, 0),
        dir: 0,
        //shape: newPolygon(regularPolyVerts(0, 0, 55, 5), new Color(255, 0, 0))
        shape: newCircle(new Vector(0, 0), 100, new Color(255, 0, 0), 1)
      }),
      new Base({
        position: new Vector(0, -100),
        dir: 0,
        // shape: newPolygon(regularPolyVerts(0, 0, 35, 5), new Color(255, 0, 0))
        shape: newCircle(new Vector(0, 0), 35, new Color(255, 0, 0))
      }),
      new Base({
        position: new Vector(0, 100),
        dir: 0,
        shape: newPolygon(regularPolyVerts(0, 0, 35, 8), new Color(255, 0, 0))
      }),
      new Base({
        position: new Vector(0, 200),
        dir: 0,
        shape: newPolygon(polyVerts(-4, -4, -4, 4, 4, 4), new Color(255, 0, 0))
      })
    );

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

      for (const data of buffer) {
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

  for (const client of boxes) {
    const aabb = client.hitbox.aabb;
    client.getInput();
    world.newClient(client, client.position.copy().add(aabb.center), new Vector(aabb.width, aabb.height));
  }

  const collisionSet = new Set();
  let KE = 0;
  function draw() {
    KE = 0;
    lastFrame = millis();
    Perf.resetMetrics();
    collisionSet.clear();
    collisions = [];
    cellsChecked = 0;
    ticksSinceInput++;
    background(255);
    fill(255, 0, 0);
    world.draw();

    Perf.getTime();

    if (keys[32] & (ticksSinceInput >= 30)) {
      focus = (focus + 1) % boxes.length;
      //for (const box of boxes)
      // box.velocity.add(new Vector(random(0, 2 * PI), velocityMagnitude * random(0.75, 1.25), "dirMag"));
      ticksSinceInput = 0;
    }
    for (const box of boxes) {
      KE +=
        (box.hitbox.mass * box.velocity.getSqMag()) / 2 + (box.hitbox.momentOfInertia * sq(box.omega)) / 2;
      box.update();
      Perf.updateMetric("boxUpdate");
      if (focus === box.id) box.getInput();
      box.hitbox.shallowUpdate(box);
      Perf.updateMetric("aabbUpdate");
      world.update(box);
      Perf.updateMetric("gridUpdate");
    }

    // check collisions
    let collisionChecks = 0;
    for (const box of boxes) {
      const aabb = box.hitbox.aabb;
      Perf.getTime();
      const clients = world.queryGrid(box.position.copy().add(aabb.center), aabb.width, aabb.height);
      Perf.updateMetric("gridQuery");

      for (const client of clients) {
        // skip duplicate collision check with self
        if (client.id === box.id) continue;
        // skip duplicate collision checks
        const formattedCollision = box.id < client.id ? box.id + "," + client.id : client.id + "," + box.id;
        if (collisionSet.has(formattedCollision)) continue;

        collisionSet.add(formattedCollision);
        // quick radii check
        const sqDistance = box.hitbox.center
          .copy()
          .add(box.position)
          .subtract(client.hitbox.center.copy().add(client.position))
          .getSqMag();
        const radiiSum = box.hitbox.radius + client.hitbox.radius;
        if (sqDistance > sq(radiiSum)) continue;

        Perf.updateMetric("priorCheck");

        // narrow update before full check
        box.hitbox.narrowUpdate(box);
        client.hitbox.narrowUpdate(client);
        Perf.updateMetric("hitboxUpdate");

        const collision = box.checkCollision(client);
        Perf.updateMetric("satCheck");
        collisionChecks++;
        if (collision.colliding) collisions.push(collision);
      }
    }

    if (ticks === 0) {
      Perf.getTime();
      Perf.updateMetric("priorCheck");
      Perf.updateMetric("hitboxUpdate");
      Perf.updateMetric("satCheck");
    }

    // draw them boxes
    for (const box of boxes) {
      stroke(46);
      if (sameColor) fill(255, 120, 120);
      if (drawAsCircles) {
        if (!sameColor) fill(box.shape.color.cachedValue);
        const diameter = box.hitbox.aabb.width;
        ellipse(
          box.position.x + box.hitbox.center.x + canvasHalfWidth,
          box.position.y + box.hitbox.center.y + canvasHalfHeight,
          diameter,
          diameter
        );
      } else box.draw();
      fill(211, 175, 55);
      ellipse(
        box.position.x + box.hitbox.center.x + canvasHalfWidth,
        box.position.y + box.hitbox.center.y + canvasHalfHeight,
        5,
        5
      );
    }
    Perf.updateMetric("drawBoxes");

    // handle collisions
    for (const collision of collisions) collision.baseA.handleCollision(collision);
    Perf.updateMetric("handleCollisions");

    Perf.getTotal();

    const countMetrics = [
      "Cells Filled",
      world.grid.size,
      "Cells Checked",
      cellsChecked,
      "SAT Calls",
      collisionChecks,
      "Object Count",
      boxes.length,
      "Collision Count",
      collisions.length,
      "Kinetic Energy",
      KE.toFixed(3)
    ];

    textAlign(LEFT, TOP);
    textFont(fontBold, 24);

    const dataToDisplay = ["average", "max", "percentage"];
    const margin = 4;
    const padding = 8;

    const dataWidth = 140;
    const keyWidth = 210;
    const columnGap = 16;

    const rowHeight = textAscent() * 2;
    const initialRowGap = 16;
    const rowGap = 0;
    const start = margin + padding;

    const metricDisplayWidth = padding + keyWidth + dataToDisplay.length * (dataWidth + columnGap) + padding;
    fill(0, 0, 0, 120);
    pushMatrix();
    const metricCount = Object.keys(Perf.metrics).length;
    rect(
      margin,
      margin,
      metricDisplayWidth,
      padding + (metricCount + 1) * rowHeight + metricCount * rowGap + initialRowGap + padding
    );
    fill(255, 255, 255);

    if (ticks % displayPeriod === 0) {
      let out = {};
      Perf.getMetricData("total", out);
      Perf.metrics.total.savedData = Object.assign({}, out);
      for (const key in Perf.metrics) {
        Perf.getMetricData(key, out);
        Perf.metrics[key].savedData = Object.assign({}, out);
      }
    }

    let dx, dy;
    dy = dx = start;
    text("Key", dx, dy);
    dx += keyWidth + columnGap;
    for (const dataKey of dataToDisplay) {
      text(dataKey[0].toUpperCase() + dataKey.slice(1), dx, dy);
      dx += dataWidth + columnGap;
    }

    fill(255, 255, 255);
    noStroke();
    rect(start, start + rowHeight, dataToDisplay.length * (dataWidth + columnGap) + keyWidth, 3);

    textFont(font, 24);
    dx = start + keyWidth + columnGap;
    dy += rowHeight + initialRowGap;

    let i = 0;
    for (const key in Perf.metrics) {
      let ddx = dx;
      const metric = Perf.metrics[key].savedData;

      if (i % 2 === 0) {
        fill(0, 0, 0, 50);
        rect(margin, dy, metricDisplayWidth, rowHeight);
        fill(255);
      }

      let formattedKey = [];
      for (let i = 0; i < key.length; i++) {
        const character = key[i];
        if (i === 0) {
          formattedKey.push(character.toUpperCase());
          continue;
        }
        if (character.toUpperCase() === character) formattedKey.push(" ", character);
        else formattedKey.push(character);
      }

      text(`${formattedKey.join("")}:`, start, dy);

      for (const dataKey of dataToDisplay) {
        let data = metric[dataKey];
        const unit = dataKey === "percentage" ? "%" : "ms";
        data = isNaN(data) ? displayPeriod - ticks / dt : `${data.toFixed(3)} ${unit}`;

        text(data, ddx, dy);
        ddx += dataWidth + columnGap;
      }

      dy += rowHeight + rowGap;
      i++;
    }

    fill(0, 0, 0, 120);
    stroke(0);
    const counterDisplayHeight = padding + (countMetrics.length / 2) * (rowHeight + rowGap) + padding;
    const counterDisplayWidth = padding + keyWidth + columnGap + dataWidth + padding;
    rect(margin, height - margin - counterDisplayHeight, counterDisplayWidth, counterDisplayHeight);
    fill(255);
    dy = height - margin - counterDisplayHeight + padding;
    for (let i = 0; i < countMetrics.length; i += 2) {
      if (i % 4 === 0) {
        fill(0, 0, 0, 50);
        rect(margin, dy, counterDisplayWidth, rowHeight);
        fill(255);
      }
      text(countMetrics[i] + ":", start, dy);
      text(countMetrics[i + 1], start + keyWidth + columnGap, dy);
      dy += rowHeight + rowGap;
    }
    popMatrix();

    ticks += dt;
  }
}

runPJS(program);
