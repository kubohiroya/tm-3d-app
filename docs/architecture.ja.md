# turbowarp-3d-scene-dsl アーキテクチャ

`turbowarp-3d-scene-dsl` は、`tm-kamishibai` の DSL scene に付与された3D/AR断片を検証・正規化し、TurboWarp拡張の呼び出し計画へ変換するパッケージです。単体アプリや実行runtimeそのものは含みません。

## 責務境界

- `tm-kamishibai`: 紙芝居 DSL 4.0、scene/action、asset、preview、packaging の基盤。
- `turbowarp-aframe`: TurboWarp unsandboxed 拡張。A-Frame シーングラフの作成、属性変更、selector event に限定。
- `turbowarp-ar`: TurboWarp unsandboxed 拡張。camera lease、AR target pose、selector attachment に限定。
- `turbowarp-3d-scene-dsl`: kamishibai scene にぶら下がる `scene3d` / `ar` DSL 断片を検証・正規化し、上記 2 つの TurboWarp 拡張を呼ぶ計画へ変換する。

## DSL 断片

`tm-kamishibai` 本体へ直接混ぜる前段階として、scene の拡張断片は次の形で扱います。

```yaml
scene3d:
  formatVersion: 1
  options:
    layer: above-stage
    mode: 3d
  root:
    children:
      - type: box
        id: card
        class: monster
        attributes:
          position: 0 1 -3
ar:
  cameraId: default
  targets:
    - targetId: marker-1
      selector: "#card"
```

この断片を `turbowarp-3d-scene-dsl` が `turbowarp-aframe` の `createScene` / `createNode` / `setAttribute` と、`turbowarp-ar` の `createARScene` / `defineARTarget` / `attachSelectorToARTarget` へ展開します。

## 移設方針

YAML document、kamishibai scene 拡張、AR と 3D scene の対応づけ、呼び出し計画の起動順序は `turbowarp-3d-scene-dsl` 側で扱います。アプリの実行やlifecycle管理は利用側の責務です。TurboWarp 拡張側には、ブロックから直接呼べる低レベル操作だけを残します。
