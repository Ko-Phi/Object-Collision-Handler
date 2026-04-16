declare function title(text: string): void;
declare function size(width: number, height: number): void;
declare function frameRate(fps: number): void;
declare function color(c1: number, c2: number, c3: number, alpha?: number): any;
declare function fill(
  c1: number | object,
  c2?: number,
  c3?: number,
  alpha?: number,
): any;

declare function line(x1: number, y1: number, x2: number, y2: number): void;
declare function ellipse(
  x: number,
  y: number,
  radius1: number,
  radius2: number,
): void;
declare function beginShape(): void;
declare function vertex(x: number, y: number): void;
declare const CLOSE: number;
declare function endShape(type: number): void;

declare const width: number;
declare const height: number;
declare let angleMode: string;
declare let keyCode: number;
declare let keyPressed: Function;
declare let keyReleased: Function;
declare const UP: number;
declare const DOWN: number;
declare const LEFT: number;
declare const RIGHT: number;

declare function round(number: number): number;
declare function pow(base: number, exponent: number): number;
declare function sq(number: number): number;
declare function sqrt(number: number): number;
declare function abs(number: number): number;
declare function max(number1: number, number2: number): number;
declare function min(number1: number, number2: number): number;
declare function floor(number: number): number;
declare function random(number1: number, number2: number): number;
declare function cos(number: number): number;
declare function sin(number: number): number;

declare const PI: number;
