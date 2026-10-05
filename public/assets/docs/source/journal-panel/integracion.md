# Integración del panel

## Archivos y rutas

Copia el contenido de **public/assets/** a la misma carpeta de tu proyecto. Los assets compartidos quedan en **/assets/ui/badge-panel/** y las insignias en **/assets/ui/badges/**, igual que en el paquete de insignias. Los nuevos están en **/assets/ui/journal-panel/**.

Si ya integraste el paquete de insignias, los 53 PNG reutilizados son idénticos. Puedes conservar los existentes y copiar solo **journal-panel/**. Si todavía no lo integraste, este ZIP ya incluye todo lo compartido que necesita la bitácora.

Conserva el **assets.json** anterior del panel de insignias en su ubicación. El de este paquete corresponde a la bitácora y puede llamarse **journal-assets.json** en tu proyecto. Los identificadores compartidos conservan el prefijo **ui.badgePanel.**; los nuevos utilizan **ui.journalPanel.**

## Qué pieza usar

| Elemento | Asset o tratamiento |
|---|---|
| Ventana principal | panel-frame |
| Tarjeta normal, bloqueada y «En este aprendizaje» | card-pending |
| Siguiente aprendizaje | card-earned-hover + ribbon-next-blank |
| Insignia obtenida | card-earned |
| Botón principal y pestaña activa | button-primary, button-primary-hover |
| Botón secundario y pestaña inactiva | button-secondary, button-secondary-hover |
| «Completado» | label-earned + check-white |
| «En curso» | label-xp + book-brown |
| «Por descubrir» | label-pending + lock-seal |
| «Disponible» | CSS .jp-status--available + triángulo de texto |
| Número 01–06 | button-secondary con texto |
| Palabra clave | label-pending con texto |
| Progreso de los seis aprendizajes | progress-capsule, progress-filled, progress-empty |
| Tres secciones de lectura | Puntos CSS .jp-section-dot; checks al leer |
| Resumen | book-brown / book-cream |
| Reflexión | tab-reflection-bubble |
| Lo vivido | sprout |
| Insignia pendiente | PNG original en gris, ramitas muted y candado |
| Insignia obtenida | PNG original, ramitas verdes y sparkle-gold |
| Cerrar | button-close, button-close-hover |
| Regresar | chevron-left o button-back |
| Fecha opcional del detalle | calendar |

**assets.json.roles** ofrece este mapa con identificadores completos.

## Escalado y composición

Utiliza **object-fit: contain** e **image-rendering: pixelated** en ilustraciones, insignias e iconos. Conserva su proporción. Los PNG mantienen la resolución alta para poder ajustar su tamaño.

Estira los marcos y botones mediante **nine-slice**: cuatro esquinas, cuatro bordes y centro. **assets.json** incluye los cortes en píxeles de la imagen original; **styles/asset-skins.css** contiene las reglas de **border-image**.

~~~tsx
<section className="jp-modal jpk-skin--panel-frame">
  <button className="jp-action jp-action--primary jpk-skin--button-primary">
    Marcar como leído y continuar
  </button>
</section>
~~~

**asset-skins.css** utiliza rutas **/assets/...** para el proyecto. **example-asset-skins.css** utiliza rutas relativas para abrir la demo desde el disco. El HTML de ejemplo elige la segunda variante automáticamente.

No estires una insignia, ramita o ilustración con nine-slice. Muestra la cinta vacía y superpone «Siguiente». Los textos deben ser elementos de la interfaz para poder localizarlos y leerlos con tecnologías de asistencia.

## Distribución

El objetivo de escritorio es una ventana de unos 1460 px dentro de una pantalla de 1672 × 941. El índice muestra tres columnas y dos grupos. La lectura tiene texto a la izquierda y una columna lateral de unos 348 px.

La UI utiliza marrón #58331f, marfil, jade #397d62 y dorado. La fuente de interfaz del ejemplo es Arial y la de lectura es Georgia, con alternativas del sistema. No se incluyen archivos de fuentes; puedes utilizar las que ya tiene el juego.

**journal-panel.css** contiene espacios, estados, tamaños y reglas para pantallas pequeñas. Verifica la adaptación en el viewport real del juego; los previews incluidos son de escritorio.

## Progreso de lectura

Cada aprendizaje registra las claves **resumen**, **reflexion** y **lo-vivido**.

~~~ts
const progress = {
  'plantas-semillas': ['resumen', 'reflexion', 'lo-vivido'],
  'plastilina-casera': ['resumen'],
};
~~~

«Marcar como leído y continuar» registra la sección actual y busca la siguiente pendiente. Una sección ya leída no se duplica. Al completar las tres, aparecen el estado completado y la insignia obtenida, y se habilita el siguiente aprendizaje.

Las tres pestañas son accesibles durante la lectura. Las tarjetas futuras muestran su requisito y no abren la lectura. El ejemplo sigue la secuencia 1–6; adapta los requisitos a los datos reales del juego.

La demo conserva el progreso únicamente en memoria. Conecta la integración con el guardado existente.

## React

Copia **examples/JournalPanel.tsx** y **examples/asset-files.ts** en **src/ui/journal/examples/**. Copia **styles/asset-skins.css** y **styles/journal-panel.css** en **src/ui/journal/styles/**. Así mantienes los imports relativos. Los PNG se copian a **public/assets/**.

El componente recibe el progreso desde el padre:

~~~tsx
import {useState} from 'react';
import {JournalPanel, type Progress, type Section, type Learning}
  from './ui/journal/examples/JournalPanel';

function JournalHost({learnings,openBadge}:{
  learnings: Learning[];
  openBadge: (badgeId:string)=>void;
}) {
  const [visible,setVisible] = useState(true);
  const [progress,setProgress] = useState<Progress>({});
  function markRead(id:string,section:Section) {
    setProgress(previous => ({
      ...previous,
      [id]: Array.from(new Set([...(previous[id]||[]),section])),
    }));
  }
  return visible ? (
    <JournalPanel
      learnings={learnings}
      progress={progress}
      onRead={markRead}
      onClose={()=>setVisible(false)}
      onOpenBadge={openBadge}
    />
  ) : null;
}
~~~

**onOpenBadge** abre el detalle del panel de insignias existente. Los ids del kit tienen el formato **badge.plantas-semillas**; adapta el callback si los del juego difieren. Otorga XP y recompensas desde el sistema del juego al detectar la transición de incompleto a completo.

**JournalPanel** utiliza el diálogo modal nativo y controles de teclado en las pestañas. Requiere React con **useId** y un navegador que soporte **dialog**. Este archivo es una referencia de integración; no se compiló contra tu proyecto.

Si la interfaz vive sobre Phaser, puedes mostrar este panel como overlay DOM. Si lo dibujas en canvas, carga las URLs de **assets.json** como texturas y usa los cortes **nineSlice**. Mantén títulos, párrafos y estados como texto dinámico.

## Verificación

Se comprueban dimensiones y transparencia, SHA-256 de piezas reutilizadas, rutas locales y estados de progreso. Los previews se montan con los PNG reales.

No se ejecutó un navegador ni una compilación de React. Valida integración, tipografía y respuesta táctil dentro del juego.
