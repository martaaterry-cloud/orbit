# Orbit

Orbit es una app web personal de diario, autocuidado y exploración simbólica.

## Estado del proyecto

Esta carpeta parte de la versión v9 que ya funcionaba como un único HTML.
Se ha separado el CSS y el JavaScript para empezar una refactorización real,
pero la lógica principal sigue temporalmente en `js/app.js` para no romper
funcionalidades existentes.

La idea es migrar poco a poco cada bloque a su módulo correspondiente.

## Ejecutar en local

Abre `index.html` directamente o usa un servidor local simple.

Con Python:

```bash
python -m http.server 8000
```

Después abre:

```text
http://localhost:8000
```

## Publicar

Puede desplegarse en GitHub Pages porque toda la app es estática.

## Regla importante

No cambiar claves de `localStorage` ni estructuras de datos sin migración.
La información del usuario debe conservarse entre versiones.

## Arquitectura prevista

- `js/storage.js` — persistencia y migraciones
- `js/journal.js` — diario y cartas
- `js/archive.js` — archivo y filtros
- `js/streak.js` — racha e impulsos
- `js/stars.js` — economía de estrellas
- `js/shop.js` — tienda y descuentos
- `js/universe.js` — universo y constelaciones
- `js/missions.js` — destinos y misiones
- `js/events.js` — fechas especiales
- `data/constellations.js` — catálogo de constelaciones
- `data/destinations.js` — catálogo de destinos
- `data/shop-items.js` — catálogo de tienda

Lee `ORBIT_SPEC.md` antes de modificar el producto.
