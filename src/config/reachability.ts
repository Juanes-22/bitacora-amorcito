import { bodyRadius } from "../domain/geometry";
import type { BitacoraConfig, ConfigIssue, MapZone } from "./types";

const CELL = 4; // px del mundo por celda de la rejilla de comprobación

/**
 * Rejilla de centros transitables de una zona: el cuerpo de Vanessa se trata como un círculo cuyo
 * radio sale de `gameplay.player.body` (píxeles de textura) × `scale`, e infla los obstáculos.
 */
function walkableGrid(zone: MapZone, radius: number) {
  const cols = Math.ceil(zone.width / CELL);
  const rows = Math.ceil(zone.height / CELL);
  const blocked = new Uint8Array(cols * rows);
  const clampX = (x: number) => Math.max(0, Math.min(cols - 1, x));
  const clampY = (y: number) => Math.max(0, Math.min(rows - 1, y));

  for (const o of zone.obstacles) {
    const [x0, y0, x1, y1] =
      o.type === "rect"
        ? [o.x - radius, o.y - radius, o.x + o.width + radius, o.y + o.height + radius]
        : [o.x - o.radius - radius, o.y - o.radius - radius, o.x + o.radius + radius, o.y + o.radius + radius];
    for (let cy = clampY(Math.floor(y0 / CELL)); cy <= clampY(Math.floor(y1 / CELL)); cy++) {
      for (let cx = clampX(Math.floor(x0 / CELL)); cx <= clampX(Math.floor(x1 / CELL)); cx++) {
        if (o.type === "circle") {
          const px = cx * CELL + CELL / 2;
          const py = cy * CELL + CELL / 2;
          if (Math.hypot(px - o.x, py - o.y) > o.radius + radius) continue;
        }
        blocked[cy * cols + cx] = 1;
      }
    }
  }
  // Los centros deben quedar a `radius` del borde del mundo.
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const px = cx * CELL + CELL / 2;
      const py = cy * CELL + CELL / 2;
      if (px < radius || py < radius || px > zone.width - radius || py > zone.height - radius) blocked[cy * cols + cx] = 1;
    }
  }
  return { cols, rows, blocked };
}

function flood(grid: { cols: number; rows: number; blocked: Uint8Array }, start: number): Uint8Array {
  const seen = new Uint8Array(grid.blocked.length);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop() as number;
    const cx = i % grid.cols;
    const cy = (i - cx) / grid.cols;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) continue;
      const n = ny * grid.cols + nx;
      if (!grid.blocked[n] && !seen[n]) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return seen;
}

/** ¿Alguna celda alcanzable cae dentro del círculo (cx, cy, r)? */
function touches(grid: { cols: number; rows: number }, reach: Uint8Array, x: number, y: number, r: number): boolean {
  for (let cy = Math.max(0, Math.floor((y - r) / CELL)); cy <= Math.min(grid.rows - 1, Math.floor((y + r) / CELL)); cy++) {
    for (let cx = Math.max(0, Math.floor((x - r) / CELL)); cx <= Math.min(grid.cols - 1, Math.floor((x + r) / CELL)); cx++) {
      if (reach[cy * grid.cols + cx] && Math.hypot(cx * CELL + CELL / 2 - x, cy * CELL + CELL / 2 - y) <= r) return true;
    }
  }
  return false;
}

/**
 * Comprueba, zona por zona, que los spawns forman una sola región conectada y que cada estación
 * activa y cada portal tienen alguna celda alcanzable dentro de su radio de interacción.
 * Es una comprobación geométrica de la configuración: no sustituye recorrer el mapa en el juego.
 */
export function checkWorldReachability(config: BitacoraConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const radius = bodyRadius(config);

  for (const [zid, zone] of Object.entries(config.maps)) {
    const grid = walkableGrid(zone, radius);
    const spawnIds = Object.keys(zone.spawns);
    const cellOf = (p: { x: number; y: number }) => Math.floor(p.y / CELL) * grid.cols + Math.floor(p.x / CELL);
    const first = zone.spawns[zone.initialSpawnId] ?? zone.spawns[spawnIds[0]];
    if (!first) continue;
    if (grid.blocked[cellOf(first)]) {
      issues.push({ path: `maps.${zid}.spawns.${zone.initialSpawnId}`, message: "el cuerpo de Vanessa no cabe en este punto de aparición" });
      continue;
    }
    const reach = flood(grid, cellOf(first));

    for (const sid of spawnIds) {
      if (!reach[cellOf(zone.spawns[sid])]) {
        issues.push({ path: `maps.${zid}.spawns.${sid}`, message: `no es alcanzable desde «${zone.initialSpawnId}»` });
      }
    }
    for (const [pid, p] of Object.entries(zone.portals)) {
      if (!touches(grid, reach, p.interaction.x, p.interaction.y, p.interaction.radius)) {
        issues.push({ path: `maps.${zid}.portals.${pid}.interaction`, message: "ninguna zona transitable alcanzable queda dentro de su radio" });
      }
    }
    for (const id of config.route) {
      const pl = config.placements[id];
      if (!pl || pl.zoneId !== zid) continue;
      const x = pl.position.x + pl.interactionOffset.x;
      const y = pl.position.y + pl.interactionOffset.y;
      if (!touches(grid, reach, x, y, pl.interactionRadius)) {
        issues.push({ path: `placements.${id}.interactionRadius`, message: "ninguna zona transitable alcanzable queda dentro del radio de interacción" });
      }
    }
  }
  return issues;
}

/**
 * Los efectos ambientales no pueden estorbar el recorrido (SPEC 3.2, AC-45): el agua animada y las plantas se
 * colocan donde Vanessa no puede estar (agua, rocas, vegetación densa), nunca sobre un camino transitable. Comprueba
 * la base de cada pieza contra las celdas alcanzables desde los spawns de su zona. Nubes, luces y partículas no se
 * comprueban: no tienen cuerpo y pasan por encima del escenario.
 */
export function checkAmbientPlacement(config: BitacoraConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const radius = bodyRadius(config);
  for (const [zid, zone] of Object.entries(config.maps)) {
    const first = zone.spawns[zone.initialSpawnId] ?? Object.values(zone.spawns)[0];
    if (!first || zone.ambient.length === 0) continue;
    const grid = walkableGrid(zone, radius);
    const cellOf = (p: { x: number; y: number }) => Math.floor(p.y / CELL) * grid.cols + Math.floor(p.x / CELL);
    if (grid.blocked[cellOf(first)]) continue; // lo informa checkWorldReachability
    const reach = flood(grid, cellOf(first));
    zone.ambient.forEach((fx, i) => {
      if (fx.type === "swim") {
        // Toda la trayectoria (puntos y tramos muestreados) debe quedar fuera del suelo transitable.
        for (let k = 0; k < fx.path.length; k++) {
          const a = fx.path[k], b = fx.path[k + 1] ?? a;
          const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (CELL / 2)));
          for (let t = 0; t <= steps; t++) {
            const p = { x: a.x + ((b.x - a.x) * t) / steps, y: a.y + ((b.y - a.y) * t) / steps };
            if (p.x < 0 || p.y < 0 || p.x >= zone.width || p.y >= zone.height) continue;
            if (reach[cellOf(p)]) {
              issues.push({ path: `maps.${zid}.ambient[${i}].path[${k}]`, message: `«${fx.assetId}» cruza suelo transitable cerca de (${Math.round(p.x)}, ${Math.round(p.y)}): la trayectoria debe quedar en el agua` });
              return;
            }
          }
        }
        return;
      }
      if (fx.type !== "animation" && fx.type !== "sway") return;
      if (fx.position.x < 0 || fx.position.y < 0 || fx.position.x >= zone.width || fx.position.y >= zone.height) return;
      if (reach[cellOf(fx.position)]) {
        issues.push({ path: `maps.${zid}.ambient[${i}].position`, message: `«${fx.assetId}» queda sobre suelo transitable: colócalo donde Vanessa no pueda estar` });
      }
    });
  }
  return issues;
}
