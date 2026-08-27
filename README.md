# tm-3d-app

[日本語](README.ja.md)

`tm-3d-app` is a TypeScript package for handling 3D/AR DSL fragments attached to Kamishibai scenes.

The current implementation validates, normalizes, and serializes YAML-based 3D scene documents, and turns `scene3d` / `ar` fragments into low-level TurboWarp extension call plans. It does not include the actual A-Frame or AR runtime implementation.

## Responsibilities

- Parse and stringify 3D scene document YAML.
- Validate scene document, node, and Kamishibai 3D scene extension shapes.
- Fill omitted scene options and node ids deterministically.
- Normalize Kamishibai scene-level `scene3d` / `ar` fragments.
- Generate call plans for `turbowarp-aframe` / `turbowarp-ar`.

## Package Layout

- [src/index.ts](src/index.ts): Public API implementation.
- [tests/scene-yaml.test.ts](tests/scene-yaml.test.ts): Tests that lock down the current behavior.
- [schemas/](schemas): JSON Schemas for scene documents and Kamishibai extensions.
- [docs/architecture.ja.md](docs/architecture.ja.md): Responsibility boundary with `tm-kamishibai` and TurboWarp extensions.

## Public API

```ts
import {
  createTurboWarpExtensionPlan,
  normalizeKamishibai3DSceneExtension,
  normalizeSceneDocument,
  parseSceneYaml,
  stringifySceneYaml,
  validateKamishibai3DSceneExtension,
  validateSceneDocument,
  validateSceneNodeTemplate
} from '@kubohiroya/tm-3d-app';
```

Main types:

- `SceneDocument`
- `NormalizedSceneDocument`
- `SceneNodeTemplate`
- `Kamishibai3DSceneExtension`
- `NormalizedKamishibai3DSceneExtension`
- `TurboWarpExtensionCall`

## Scene Document

The minimal YAML shape is:

```yaml
formatVersion: 1
root:
  children:
    - type: box
      class: card
      attributes:
        position: 0 1 -3
```

`parseSceneYaml` validates and normalizes YAML input.

```ts
import {parseSceneYaml, stringifySceneYaml} from '@kubohiroya/tm-3d-app';

const scene = parseSceneYaml(`
formatVersion: 1
root:
  children:
    - type: box
      class: card
`);

console.log(scene.options);
// { layer: 'above-stage', mode: '3d' }

console.log(scene.root.children?.[0]?.id);
// 'scene-box-1'

console.log(stringifySceneYaml(scene));
```

Main normalization rules:

- `root.id` is always `scene`.
- The default `options.layer` is `above-stage`.
- The default `options.mode` is `3d`.
- Child nodes without ids receive deterministic ids such as `scene-box-1`.
- ids are trimmed, and characters other than ASCII letters, digits, `_`, and `-` are replaced with `-`.
- Duplicate ids after normalization throw an error.

## Kamishibai 3D Scene Extension

`scene3d` and `ar` can be passed together in the same extension object.

```ts
import {createTurboWarpExtensionPlan} from '@kubohiroya/tm-3d-app';

const calls = createTurboWarpExtensionPlan({
  scene3d: {
    formatVersion: 1,
    root: {
      children: [
        {
          type: 'box',
          id: 'card',
          class: 'monster selected',
          data: {zone: 'field'},
          attributes: {position: '0 1 -3'}
        }
      ]
    }
  },
  ar: {
    cameraId: 'front',
    targets: [{targetId: 'marker-1', selector: '#card'}]
  }
});

console.log(calls);
```

The generated call plan consists of `turbowarp-aframe` calls for `createScene` / `createNode` / `addClass` / `setData` / `setAttribute`, and `turbowarp-ar` calls for `createARScene` / `defineARTarget` / `attachSelectorToARTarget`.

AR normalization defaults:

- `ar.cameraId`: `default`
- `ar.layer`: `camera-under-3d`
- `ar.targets`: `[]`

## Development

Use Node.js 22 or later and pnpm.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run check
```

`pnpm run check` runs `typecheck` and `test` in sequence.
