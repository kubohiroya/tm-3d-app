# turbowarp-3d-scene-dsl

[English](README.md)

`turbowarp-3d-scene-dsl` は、Kamishibai の scene に付与する 3D/AR 用 DSL 断片を扱う TypeScript パッケージです。

現在の実装は、YAML で書かれた 3D scene document の検証・正規化・シリアライズと、`scene3d` / `ar` 断片から低レベル TurboWarp 拡張呼び出し計画を作るところまでを担当します。実際の A-Frame / AR 実行処理はこのパッケージには含みません。

## 識別子の移行

package／repositoryの改名に伴い、配布SB3のextension IDは`kubohiroyatm3dapp`から`kubohiroya3dscenedsl`へ変更されます。schema `$id`も新repositoryのURLへ移行します。これはbreaking changeであり、既存SB3は展開したJSON構造を移行してmanifestとintegrityを再生成する必要があります。opcode `statusReporter`、DSLの入力形状、TypeScript公開API名は維持します。

## 役割

- 3D scene document YAML を parse / stringify する。
- scene document、node、Kamishibai 3D scene extension の形を検証する。
- 省略された scene options と node id を決定的に補う。
- Kamishibai scene の `scene3d` / `ar` 断片を正規化する。
- `turbowarp-aframe` / `turbowarp-ar` 向けの呼び出し計画を生成する。

## パッケージ構成

- [src/index.ts](src/index.ts): 公開 API の実装。
- [tests/scene-yaml.test.ts](tests/scene-yaml.test.ts): 現在の挙動を固定するテスト。
- [schemas/](schemas): scene document と Kamishibai extension の JSON Schema。
- [docs/architecture.ja.md](docs/architecture.ja.md): `tm-kamishibai` / TurboWarp 拡張との責務境界。

## 公開 API

```ts
import {
  createTurboWarpExtensionPlan,
  normalizeKamishibai3DSceneExtension,
  normalizeSceneDocument,
  parseSceneYaml,
  stringifySceneGraphValue,
  stringifySceneYaml,
  validateKamishibai3DSceneExtension,
  validateSceneDocument,
  validateSceneNodeTemplate
} from '@kubohiroya/turbowarp-3d-scene-dsl';
```

主な型:

- `SceneDocument`
- `NormalizedSceneDocument`
- `SceneNodeTemplate`
- `SceneGraphValue`
- `Kamishibai3DSceneExtension`
- `NormalizedKamishibai3DSceneExtension`
- `TurboWarpExtensionCall`

## Scene Document

最小の YAML は次の形です。

```yaml
formatVersion: 1
root:
  children:
    - type: box
      class: card
      attributes:
        position: 0 1 -3
```

`parseSceneYaml` は YAML を検証した上で正規化します。

```ts
import {parseSceneYaml, stringifySceneYaml} from '@kubohiroya/turbowarp-3d-scene-dsl';

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

正規化時の主なルール:

- `root.id` は常に `scene` になる。
- `options.layer` の既定値は `above-stage`。
- `options.mode` の既定値は `3d`。
- id がない子 node には `scene-box-1` のような決定的 id が付く。
- id は空白を trim し、英数字・`_`・`-` 以外を `-` に置き換える。
- 正規化後に重複 id がある場合は例外を投げる。

`data` と `attributes` の値には、文字列、数値、真偽値、`null`、scalar 配列、scalar object を指定できます。呼び出し計画の生成時には `stringifySceneGraphValue` で TurboWarp 向けの文字列へ変換します。

- scalar は JavaScript の文字列変換を使う。ただし `null` は空文字列になる。
- 配列は scalar 文字列をスペース区切りで連結する。
- `x` / `y` / `z` / `w` だけを持つ vector 風 object は、その順序でスペース区切りにする。
- その他の scalar object は key 順に並べ、`key: value; key: value` の形にする。

## Kamishibai 3D Scene Extension

`scene3d` と `ar` は同じ extension object にまとめて渡せます。

```ts
import {createTurboWarpExtensionPlan} from '@kubohiroya/turbowarp-3d-scene-dsl';

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

生成される呼び出し計画は、`turbowarp-aframe` の `createScene` / `createNode` / `addClass` / `setData` / `setAttribute` と、`turbowarp-ar` の `createARScene` / `defineARTarget` / `attachSelectorToARTarget` で構成されます。

AR 正規化時の既定値:

- `ar.cameraId`: `default`
- `ar.layer`: `camera-under-3d`
- `ar.targets`: `[]`

## 開発

Node.js 22 以上と pnpm を使います。

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run check
```

`pnpm run check` は `typecheck`、`test`、`sb3:check` を順に実行します。

## ライセンス

このプロジェクトは Mozilla Public License 2.0 の下で提供されます。詳細は [LICENSE](LICENSE) を参照してください。
