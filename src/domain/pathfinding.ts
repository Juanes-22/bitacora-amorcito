import type { Point } from "../config/types";

export interface NavGrid {
  cols: number;
  rows: number;
  /** Lado de una celda en unidades del mundo. */
  cell: number;
  /** 1 = el cuerpo de Vanessa no puede estar en esa celda. */
  blocked: Uint8Array;
}

const NEIGHBOURS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

const cellOf = (grid: NavGrid, p: Point) => {
  const cx = Math.min(grid.cols - 1, Math.max(0, Math.floor(p.x / grid.cell)));
  const cy = Math.min(grid.rows - 1, Math.max(0, Math.floor(p.y / grid.cell)));
  return cy * grid.cols + cx;
};
const centerOf = (grid: NavGrid, index: number): Point => ({ x: (index % grid.cols) * grid.cell + grid.cell / 2, y: Math.floor(index / grid.cols) * grid.cell + grid.cell / 2 });

/** ¿Hay línea recta libre entre dos puntos? Se muestrea a media celda para no cortar esquinas. */
export function lineOfSight(grid: NavGrid, a: Point, b: Point): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (grid.cell / 2)));
  for (let i = 0; i <= steps; i++) {
    const x = a.x + ((b.x - a.x) * i) / steps;
    const y = a.y + ((b.y - a.y) * i) / steps;
    if (x < 0 || y < 0 || x >= grid.cols * grid.cell || y >= grid.rows * grid.cell) return false;
    if (grid.blocked[cellOf(grid, { x, y })]) return false;
  }
  return true;
}

/** Montículo binario mínimo por prioridad (A*). */
class MinHeap {
  private readonly items: number[] = [];
  private readonly keys: number[] = [];
  get size() { return this.items.length; }
  push(item: number, key: number) {
    let i = this.items.length;
    this.items.push(item);
    this.keys.push(key);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= this.keys[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }
  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop() as number;
    const lastKey = this.keys.pop() as number;
    if (this.items.length) {
      this.items[0] = lastItem;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.items.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.items.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}

/** Celda libre más cercana a `from` (por anillos), para cuando el cuerpo roza un obstáculo inflado. */
function nearestFree(grid: NavGrid, from: number, maxRing = 8): number | null {
  if (!grid.blocked[from]) return from;
  const cx = from % grid.cols, cy = Math.floor(from / grid.cols);
  for (let ring = 1; ring <= maxRing; ring++) {
    let best = -1, bestD = Infinity;
    for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) continue;
      const i = y * grid.cols + x;
      if (!grid.blocked[i] && dx * dx + dy * dy < bestD) { best = i; bestD = dx * dx + dy * dy; }
    }
    if (best >= 0) return best;
  }
  return null;
}

/** Celdas alcanzables desde `start` (relleno por anchura). */
function reachableFrom(grid: NavGrid, start: number): Uint8Array {
  const seen = new Uint8Array(grid.blocked.length);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop() as number;
    const cx = i % grid.cols, cy = (i - cx) / grid.cols;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) continue;
      const n = ny * grid.cols + nx;
      if (seen[n] || grid.blocked[n]) continue;
      if (dx !== 0 && dy !== 0 && (grid.blocked[cy * grid.cols + nx] || grid.blocked[ny * grid.cols + cx])) continue; // sin cortar esquinas
      seen[n] = 1;
      stack.push(n);
    }
  }
  return seen;
}

export interface PathResult {
  /** Puntos por los que pasar, sin incluir el de partida; el último es el destino alcanzable. */
  waypoints: Point[];
  /** `true` si el destino pedido no era alcanzable y se llegó al punto alcanzable más cercano. */
  adjusted: boolean;
}

/**
 * Camino de `from` a `to` sobre la rejilla (A* con ocho vecinos, sin cortar esquinas) y alisado por línea de vista.
 * Si `to` cae en un obstáculo o en una zona inalcanzable, el destino pasa a ser el punto alcanzable más cercano a
 * `to`; así tocar un arbusto lleva a Vanessa a su orilla en vez de no hacer nada. `null` si no hay por dónde salir.
 */
export function findPath(grid: NavGrid, from: Point, to: Point): PathResult | null {
  const start = nearestFree(grid, cellOf(grid, from));
  if (start === null) return null;
  const reach = reachableFrom(grid, start);

  let goal = cellOf(grid, to);
  let adjusted = false;
  if (!reach[goal]) {
    adjusted = true;
    let best = -1, bestD = Infinity;
    const tx = to.x / grid.cell, ty = to.y / grid.cell;
    for (let i = 0; i < reach.length; i++) {
      if (!reach[i]) continue;
      const d = (i % grid.cols + 0.5 - tx) ** 2 + (Math.floor(i / grid.cols) + 0.5 - ty) ** 2;
      if (d < bestD) { best = i; bestD = d; }
    }
    if (best < 0) return null;
    goal = best;
  }
  if (goal === start) return { waypoints: [adjusted ? centerOf(grid, goal) : { x: to.x, y: to.y }], adjusted };

  // A*
  const g = new Float32Array(grid.blocked.length).fill(Infinity);
  const parent = new Int32Array(grid.blocked.length).fill(-1);
  const closed = new Uint8Array(grid.blocked.length);
  const gx = goal % grid.cols, gy = Math.floor(goal / grid.cols);
  const h = (i: number) => {
    const dx = Math.abs((i % grid.cols) - gx), dy = Math.abs(Math.floor(i / grid.cols) - gy);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy); // distancia octil
  };
  const open = new MinHeap();
  g[start] = 0;
  open.push(start, h(start));
  while (open.size) {
    const i = open.pop();
    if (closed[i]) continue;
    if (i === goal) break;
    closed[i] = 1;
    const cx = i % grid.cols, cy = (i - cx) / grid.cols;
    for (const [dx, dy, cost] of NEIGHBOURS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) continue;
      const n = ny * grid.cols + nx;
      if (grid.blocked[n] || closed[n]) continue;
      if (dx !== 0 && dy !== 0 && (grid.blocked[cy * grid.cols + nx] || grid.blocked[ny * grid.cols + cx])) continue;
      const tentative = g[i] + cost;
      if (tentative < g[n]) {
        g[n] = tentative;
        parent[n] = i;
        open.push(n, tentative + h(n));
      }
    }
  }
  if (parent[goal] < 0) return null;

  const cells: number[] = [];
  for (let i = goal; i !== -1; i = parent[i]) cells.push(i);
  cells.reverse();
  const raw = cells.map((i) => centerOf(grid, i));
  raw[0] = { x: from.x, y: from.y };
  raw[raw.length - 1] = adjusted ? raw[raw.length - 1] : { x: to.x, y: to.y };

  // Alisado: desde cada punto se salta al más lejano con línea de vista libre.
  const waypoints: Point[] = [];
  let anchor = 0;
  while (anchor < raw.length - 1) {
    let next = anchor + 1;
    for (let j = raw.length - 1; j > anchor + 1; j--) {
      if (lineOfSight(grid, raw[anchor], raw[j])) { next = j; break; }
    }
    waypoints.push(raw[next]);
    anchor = next;
  }
  return { waypoints, adjusted };
}
