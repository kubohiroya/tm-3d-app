# tm-3d-app

App-level 3D scene document utilities for the `tm-*` package family.

This package owns the YAML scene document format and normalization rules that are above a TurboWarp extension's block API. Low-level TurboWarp/A-Frame bridge code stays in `@kubohiroya/turbowarp-aframe`.

## Scope

- Parse and serialize 3D scene YAML documents.
- Validate scene document and node shape.
- Normalize app scene documents with default options and deterministic missing node ids.
- Normalize Kamishibai scene-level `scene3d` and `ar` extension fragments.
- Produce low-level `turbowarp-aframe` and `turbowarp-ar` call plans.

## Example

```ts
import {parseSceneYaml, stringifySceneYaml} from '@kubohiroya/tm-3d-app';

const scene = parseSceneYaml(`
formatVersion: 1
root:
  children:
    - type: box
      class: card
`);

console.log(stringifySceneYaml(scene));
```

Kamishibai scene extension fragments can combine 3D scene graph setup with AR target bindings:

```ts
import {createTurboWarpExtensionPlan} from '@kubohiroya/tm-3d-app';

const calls = createTurboWarpExtensionPlan({
  scene3d: {
    formatVersion: 1,
    root: {
      children: [{type: 'box', id: 'card', attributes: {position: '0 1 -3'}}]
    }
  },
  ar: {
    targets: [{targetId: 'marker-1', selector: '#card'}]
  }
});
```

See [docs/architecture.ja.md](docs/architecture.ja.md) for the package boundary.

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```
