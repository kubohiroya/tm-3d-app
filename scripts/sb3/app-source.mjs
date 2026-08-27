import {createHash} from 'node:crypto';

export const tm3dAppRuntimeExtensionId = 'kubohiroyatm3dapp';

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function md5(contents) {
  return createHash('md5').update(contents).digest('hex');
}

function svgAsset(source) {
  const bytes = Buffer.from(`${source.trim()}\n`);
  const assetId = md5(bytes);
  return {
    assetId,
    bytes,
    filename: `${assetId}.svg`
  };
}

function runtimeExtensionSource() {
  return Buffer.from(`class Tm3dAppRuntimeExtension {
  constructor(Scratch) {
    this.Scratch = Scratch;
  }

  getInfo() {
    const {BlockType} = this.Scratch;
    return {
      id: '${tm3dAppRuntimeExtensionId}',
      name: 'TM 3D App',
      blocks: [
        {
          opcode: 'statusReporter',
          blockType: BlockType.REPORTER,
          text: 'TM 3D app status',
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
  const stageBackdrop = svgAsset(`
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
  <rect width="480" height="360" fill="#101820"/>
  <text x="240" y="176" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#f2f7f2">tm-3d-app</text>
  <text x="240" y="208" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#91c7b1">3D/AR scene runtime bootstrap</text>
</svg>
`);
  const extensionPath = `extensions/${tm3dAppRuntimeExtensionId}.js`;
  const project = {
    targets: [
      {
        isStage: true,
        name: 'Stage',
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: {},
        comments: {},
        currentCostume: 0,
        costumes: [
          {
            assetId: stageBackdrop.assetId,
            name: 'Title',
            bitmapResolution: 1,
            dataFormat: 'svg',
            md5ext: stageBackdrop.filename,
            rotationCenterX: 240,
            rotationCenterY: 180
          }
        ],
        sounds: [],
        volume: 100,
        layerOrder: 0,
        tempo: 60,
        videoTransparency: 50,
        videoState: 'on',
        textToSpeechLanguage: null
      }
    ],
    extensionURLs: {
      [tm3dAppRuntimeExtensionId]: `embedded-extension:${extensionPath}`
    },
    meta: {
      semver: '3.0.0',
      vm: '0.2.0',
      agent: 'tm-3d-app'
    }
  };
  const embeddedExtensions = {
    formatVersion: 1,
    extensions: [
      {
        id: tm3dAppRuntimeExtensionId,
        path: extensionPath,
        mediaType: 'text/javascript',
        parameters: [],
        encoding: 'base64'
      }
    ]
  };
  const sourceManifest = {
    formatVersion: 1,
    project: 'project.source.json',
    embeddedExtensions: 'embedded-extensions.json',
    assetsDirectory: 'assets',
    archiveEntries: ['project.json', stageBackdrop.filename]
  };
  return new Map([
    ['project.source.json', jsonBytes(project)],
    ['embedded-extensions.json', jsonBytes(embeddedExtensions)],
    ['sb3-source.json', jsonBytes(sourceManifest)],
    [`assets/${stageBackdrop.filename}`, stageBackdrop.bytes],
    [extensionPath, runtimeExtensionSource()]
  ]);
}
