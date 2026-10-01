import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import type { ConfigIssue } from "./types";

// Un solo Ajv por proceso; `discriminator` da errores claros para tipos de bloque desconocidos.
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true, discriminator: true });

export function compileSchema(schema: object) {
  return ajv.compile(schema);
}

function toPath(instancePath: string): string {
  return instancePath
    .split("/")
    .slice(1)
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce((acc, seg) => (/^\d+$/.test(seg) ? `${acc}[${seg}]` : acc ? `${acc}.${seg}` : seg), "");
}

function join(base: string, extra: string): string {
  return base ? `${base}.${extra}` : extra;
}

function toIssue(e: ErrorObject): ConfigIssue {
  const base = toPath(e.instancePath);
  const p = e.params as Record<string, unknown>;
  switch (e.keyword) {
    case "required":
      return { path: join(base, String(p.missingProperty)), message: "propiedad obligatoria ausente" };
    case "additionalProperties":
      return { path: join(base, String(p.additionalProperty)), message: "propiedad no permitida" };
    case "type":
      return { path: base, message: `debe ser de tipo ${String(p.type)}` };
    case "enum":
      return { path: base, message: `valor no permitido; admitidos: ${(p.allowedValues as unknown[]).join(", ")}` };
    case "const":
      return { path: base, message: `debe ser ${JSON.stringify(p.allowedValue)}` };
    case "discriminator":
      return {
        path: base,
        message:
          p.error === "tag"
            ? `falta «${String(p.tag)}» o no es texto`
            : `«${String(p.tag)}» = «${String(p.tagValue)}» no es un valor reconocido`,
      };
    case "oneOf":
      return { path: base, message: "no coincide con ninguna de las variantes admitidas" };
    case "pattern":
      return { path: base, message: `no cumple el formato ${String(p.pattern)}` };
    case "exclusiveMinimum":
      return { path: base, message: `debe ser mayor que ${String(p.limit)}` };
    case "minimum":
      return { path: base, message: `debe ser mayor o igual que ${String(p.limit)}` };
    case "maximum":
      return { path: base, message: `debe ser menor o igual que ${String(p.limit)}` };
    case "minItems":
      return { path: base, message: `debe tener al menos ${String(p.limit)} elemento(s)` };
    case "maxItems":
      return { path: base, message: `debe tener como máximo ${String(p.limit)} elemento(s)` };
    case "minProperties":
      return { path: base, message: `debe tener al menos ${String(p.limit)} entrada(s)` };
    case "propertyNames":
      return { path: base, message: `clave «${String(p.propertyName)}» con formato no válido` };
    case "minLength":
      return { path: base, message: "no puede estar vacío" };
    case "uniqueItems":
      return { path: base, message: "contiene elementos repetidos" };
    default:
      return { path: base, message: e.message ?? e.keyword };
  }
}

export function ajvIssues(errors: ErrorObject[] | null | undefined): ConfigIssue[] {
  return (errors ?? []).map(toIssue);
}
