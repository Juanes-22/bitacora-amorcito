import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_FONTS } from "../src/app/fontsReady";

// Las tipografías propias (SPEC 14, AC-96): lo que la aplicación espera es lo que declara el CSS y lo que usan los tokens.
describe("tipografías propias: CSS y lista de espera coinciden", () => {
  it("las familias que espera son las que declara fonts.css y las que usa tokens.css", () => {
    const fontsCss = readFileSync("src/styles/fonts.css", "utf8");
    const tokens = readFileSync("src/styles/tokens.css", "utf8");
    const families = new Set(APP_FONTS.map((f) => /"([^"]+)"/.exec(f)![1]));
    for (const family of families) {
      expect(fontsCss, family).toContain(`font-family: "${family}"`);
      expect(tokens, family).toContain(`"${family}"`);
    }
    // Cada archivo declarado existe en el paquete y la cursiva de lectura está declarada.
    for (const m of fontsCss.matchAll(/url\("([^"]+\.woff2)"\)/g)) expect(() => readFileSync(`src/styles/${m[1]}`), m[1]).not.toThrow();
    expect(fontsCss).toContain("font-style: italic");
  });
});
