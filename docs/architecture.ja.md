# tm-3d-app アーキテクチャ

`tm-3d-app` は、`tm-kamishibai` の DSL scene を 3D/AR アプリとして解釈する上位パッケージです。

## 責務境界

- `tm-kamishibai`: 紙芝居 DSL 4.0、scene/action、asset、preview、packaging の基盤。
- `turbowarp-aframe`: TurboWarp unsandboxed 拡張。A-Frame シーングラフの作成、属性変更、selector event に限定。
- `turbowarp-ar`: TurboWarp unsandboxed 拡張。camera lease、AR target pose、selector attachment に限定。
- `tm-3d-app`: kamishibai scene にぶら下がる `scene3d` / `ar` DSL 断片を検証・正規化し、上記 2 つの TurboWarp 拡張を呼ぶ計画へ変換する。

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

この断片を `tm-3d-app` が `turbowarp-aframe` の `createScene` / `createNode` / `setAttribute` と、`turbowarp-ar` の `createARScene` / `defineARTarget` / `attachSelectorToARTarget` へ展開します。

## 移設方針

YAML document、kamishibai scene 拡張、AR と 3D scene の対応づけ、起動順序、app lifecycle は `tm-3d-app` 側に置きます。TurboWarp 拡張側には、ブロックから直接呼べる低レベル操作だけを残します。
