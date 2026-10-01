import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";

// El icono del sitio (libro abierto con un destello y una hoja): cada enlace de index.html apunta a un archivo real, del tamaño
// que declara, y el exterior del dibujo es transparente (las esquinas redondeadas no salen blancas en la pestaña).

const html = readFileSync("index.html", "utf8");
const links = [...html.matchAll(/<link rel="(icon|apple-touch-icon)"([^>]*)>/g)].map((m) => ({ rel: m[1], attrs: m[2], href: /href="([^"]+)"/.exec(m[2])?.[1] as string }));
const png = (name: string) => PNG.sync.read(readFileSync(`public/${name}`));

describe("favicon", () => {
  it("index.html enlaza el icono (ico, PNG de 32 y 192) y el de iOS", () => {
    expect(links.map((l) => l.href).sort()).toEqual(["/apple-touch-icon.png", "/favicon-32.png", "/favicon.ico", "/icon-192.png"]);
  });

  it("cada enlace apunta a un archivo que existe en public/", () => {
    for (const l of links) expect(existsSync(`public${l.href}`), l.href).toBe(true);
  });

  it("los PNG miden lo que declaran", () => {
    expect(png("favicon-32.png")).toMatchObject({ width: 32, height: 32 });
    expect(png("icon-192.png")).toMatchObject({ width: 192, height: 192 });
    expect(png("icon-512.png")).toMatchObject({ width: 512, height: 512 });
    expect(png("apple-touch-icon.png")).toMatchObject({ width: 180, height: 180 });
  });

  it("el .ico trae los tamaños 16, 32 y 48", () => {
    const ico = readFileSync("public/favicon.ico");
    expect(ico.readUInt16LE(0)).toBe(0); // reservado
    expect(ico.readUInt16LE(2)).toBe(1); // tipo icono
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => ico[6 + i * 16] || 256).sort((a, b) => a - b);
    expect(sizes).toEqual([16, 32, 48]);
  });

  it("las esquinas son transparentes y el centro es opaco; el icono de iOS es opaco entero", () => {
    for (const name of ["favicon-32.png", "icon-192.png", "icon-512.png"]) {
      const p = png(name);
      const alphaAt = (x: number, y: number) => p.data[(y * p.width + x) * 4 + 3];
      expect(alphaAt(0, 0), `${name} esquina`).toBe(0);
      expect(alphaAt(p.width - 1, p.height - 1), `${name} esquina`).toBe(0);
      expect(alphaAt(p.width >> 1, p.height >> 1), `${name} centro`).toBe(255);
    }
    const apple = png("apple-touch-icon.png");
    for (let i = 3; i < apple.data.length; i += 4) expect(apple.data[i]).toBe(255);
  });
});
