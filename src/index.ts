import {
  createAFrameSceneGraphPlan,
  normalizeSceneGraphDocument,
  stringifySceneGraphValue,
  validateSceneGraphDocument,
  validateSceneGraphNode,
  type AFrameSceneGraphCall,
  type NormalizedSceneGraphDocument,
  type SceneGraphDocument,
  type SceneGraphNode,
  type SceneGraphOptions,
  type SceneGraphScalar,
  type SceneGraphValue
} from '@kubohiroya/turbowarp-scene-graph';
import {
  createTurboWarpARScenePlan,
  normalizeARSceneControl,
  validateARSceneControl,
  type ARSceneControl,
  type ARTargetBinding,
  type NormalizedARSceneControl,
  type TurboWarpARScenePlanCall
} from '@kubohiroya/turbowarp-ar/plan';
import {parse as parseYaml, stringify as stringifyYaml} from 'yaml';

export type SceneOptions = SceneGraphOptions;
export type SceneNodeTemplate = SceneGraphNode;
export type SceneDocument = SceneGraphDocument;
export type NormalizedSceneDocument = NormalizedSceneGraphDocument;
export type {
  AFrameSceneGraphCall,
  ARSceneControl,
  ARTargetBinding,
  SceneGraphScalar,
  SceneGraphValue,
  TurboWarpARScenePlanCall
};
export {stringifySceneGraphValue};

export interface Kamishibai3DSceneExtension {
  scene3d?: SceneDocument;
  ar?: ARSceneControl;
}

export interface NormalizedKamishibai3DSceneExtension {
  scene3d?: NormalizedSceneDocument;
  ar?: NormalizedARSceneControl;
}

export type TurboWarpExtensionCall = AFrameSceneGraphCall | TurboWarpARScenePlanCall;

export function parseSceneYaml(source: string): NormalizedSceneDocument {
  const value: unknown = parseYaml(source);
  validateSceneDocument(value);
  return normalizeSceneDocument(value);
}

export function stringifySceneYaml(document: SceneDocument): string {
  validateSceneDocument(document);
  return stringifyYaml(normalizeSceneDocument(document), {lineWidth: 0});
}

export function normalizeKamishibai3DSceneExtension(
  extension: Kamishibai3DSceneExtension
): NormalizedKamishibai3DSceneExtension {
  validateKamishibai3DSceneExtension(extension);
  const normalized: NormalizedKamishibai3DSceneExtension = {};
  if (extension.scene3d !== undefined) {
    normalized.scene3d = normalizeSceneDocument(extension.scene3d);
  }
  if (extension.ar !== undefined) {
    normalized.ar = normalizeARSceneControl(extension.ar);
  }
  return normalized;
}

export function createTurboWarpExtensionPlan(
  extension: Kamishibai3DSceneExtension
): TurboWarpExtensionCall[] {
  const normalized = normalizeKamishibai3DSceneExtension(extension);
  const calls: TurboWarpExtensionCall[] = [];

  if (normalized.scene3d !== undefined) {
    calls.push(...createAFrameSceneGraphPlan(normalized.scene3d));
  }

  if (normalized.ar !== undefined) {
    calls.push(...createTurboWarpARScenePlan(normalized.ar));
  }

  return calls;
}

export function normalizeSceneDocument(document: SceneDocument): NormalizedSceneDocument {
  try {
    return normalizeSceneGraphDocument(document);
  } catch (error) {
    throw remapSceneGraphError(error);
  }
}

export function validateSceneDocument(value: unknown): asserts value is SceneDocument {
  try {
    validateSceneGraphDocument(value);
  } catch (error) {
    throw remapSceneGraphError(error);
  }
}

export function validateSceneNodeTemplate(
  value: unknown,
  path = 'node'
): asserts value is SceneNodeTemplate {
  try {
    validateSceneGraphNode(value, path);
  } catch (error) {
    throw remapSceneGraphError(error);
  }
}

export function validateKamishibai3DSceneExtension(
  value: unknown
): asserts value is Kamishibai3DSceneExtension {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Kamishibai 3D scene extension must be an object.');
  }
  const extension = value as Record<string, unknown>;
  for (const key of Object.keys(extension)) {
    if (key !== 'scene3d' && key !== 'ar') {
      throw new TypeError(`Kamishibai 3D scene extension ${key} is not supported.`);
    }
  }
  if (extension['scene3d'] !== undefined) {
    validateSceneDocument(extension['scene3d']);
  }
  if (extension['ar'] !== undefined) {
    try {
      validateARSceneControl(extension['ar']);
    } catch (error) {
      throw remapTurboWarpARError(error);
    }
  }
}

function remapSceneGraphError(error: unknown): unknown {
  if (!(error instanceof Error)) return error;
  const nextMessage = error.message
    .replace(/^Scene graph document /u, '3D scene document ')
    .replace(/^Scene graph root/u, '3D scene scene.root')
    .replace(/^Scene graph node/u, '3D scene node')
    .replace(/^Scene graph /u, '3D scene ')
    .replace(/^Duplicate scene graph node id:/u, 'Duplicate 3D scene node id:')
    .replace(/^Normalized scene graph nodes must/u, 'Normalized 3D scene nodes must');
  return new (error.constructor as new (message: string) => Error)(nextMessage);
}

function remapTurboWarpARError(error: unknown): unknown {
  if (!(error instanceof Error)) return error;
  const nextMessage = error.message
    .replace(/^TurboWarp AR scene control/u, 'Kamishibai 3D AR control')
    .replace(/^TurboWarp AR /u, 'Kamishibai 3D ');
  return new (error.constructor as new (message: string) => Error)(nextMessage);
}
