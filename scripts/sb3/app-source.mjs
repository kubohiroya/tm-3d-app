import {createTurboWarpSb3AppSourceFiles} from '@kubohiroya/turbowarp-sb3-source-builder';

export const tm3dAppRuntimeExtensionId = "kubohiroya3dscenedsl";

function runtimeExtensionSource() {
  return Buffer.from(`// ID: ${tm3dAppRuntimeExtensionId}
class Tm3dAppRuntimeExtension {
  constructor(Scratch) {
    this.Scratch = Scratch;
  }

  getInfo() {
    const {BlockType} = this.Scratch;
    return {
      id: '${tm3dAppRuntimeExtensionId}',
      name: 'TurboWarp 3D Scene DSL',
      blocks: [
        {
          opcode: 'statusReporter',
          blockType: BlockType.REPORTER,
          text: '3D scene DSL status',
          disableMonitor: true
        }
      ]
    };
  }

  statusReporter() {
    return 'ready';
  }
}

Scratch.extensions.register(new Tm3dAppRuntimeExtension(Scratch));
`);
}

export async function createTm3dAppReleaseSourceFiles() {
  const stageBackdropSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
  <rect width="480" height="360" fill="#101820"/>
  <text x="240" y="176" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#f2f7f2">turbowarp-3d-scene-dsl</text>
  <text x="240" y="208" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#91c7b1">3D/AR scene DSL bootstrap</text>
</svg>
`;
  const extensionPath = `extensions/${tm3dAppRuntimeExtensionId}.js`;
  return createTurboWarpSb3AppSourceFiles({
    agent: 'turbowarp-3d-scene-dsl',
    extension: {
      id: tm3dAppRuntimeExtensionId,
      path: extensionPath,
      source: runtimeExtensionSource()
    },
    stageBackdrop: {
      name: 'Title',
      svg: `${stageBackdropSvg.trim()}\n`
    }
  });
}
