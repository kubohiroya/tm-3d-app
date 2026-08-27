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
} from '@kubohiroya/turbowarp-scene-graph-plan';
import {parse as parseYaml, stringify as stringifyYaml} from 'yaml';

export type SceneOptions = SceneGraphOptions;
export type SceneNodeTemplate = SceneGraphNode;
export type SceneDocument = SceneGraphDocument;
export type NormalizedSceneDocument = NormalizedSceneGraphDocument;
export type {AFrameSceneGraphCall, SceneGraphScalar, SceneGraphValue};
export {stringifySceneGraphValue};

export interface ARTargetBinding {
  targetId: string;
  selector: string;
}

export interface ARSceneControl {
  cameraId?: string;
  layer?: string;
  targets?: ARTargetBinding[];
}

export interface Kamishibai3DSceneExtension {
  scene3d?: SceneDocument;
  ar?: ARSceneControl;
}

export interface NormalizedKamishibai3DSceneExtension {
  scene3d?: NormalizedSceneDocument;
  ar?: {
    cameraId: string;
    layer: string;
    targets: ARTargetBinding[];
  };
}

export type TurboWarpExtensionCall =
  | AFrameSceneGraphCall
  | {
      extension: 'turbowarp-ar';
      opcode: 'createARScene';
      args: {CAMERA_ID: string; LAYER: string};
    }
  | {
      extension: 'turbowarp-ar';
      opcode: 'defineARTarget';
      args: {TARGET_ID: string};
    }
  | {
      extension: 'turbowarp-ar';
      opcode: 'attachSelectorToARTarget';
      args: {SELECTOR: string; TARGET_ID: string};
    };

const DEFAULT_AR_LAYER = 'camera-under-3d';

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
    normalized.ar = {
      cameraId: normalizeId(extension.ar.cameraId ?? 'default') || 'default',
      layer: extension.ar.layer ?? DEFAULT_AR_LAYER,
      targets: [...(extension.ar.targets ?? [])]
    };
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
    calls.push({
      extension: 'turbowarp-ar',
      opcode: 'createARScene',
      args: {
        CAMERA_ID: normalized.ar.cameraId,
        LAYER: normalized.ar.layer
      }
    });
    for (const target of normalized.ar.targets) {
      calls.push({
        extension: 'turbowarp-ar',
        opcode: 'defineARTarget',
        args: {TARGET_ID: target.targetId}
      });
      calls.push({
        extension: 'turbowarp-ar',
        opcode: 'attachSelectorToARTarget',
        args: {SELECTOR: target.selector, TARGET_ID: target.targetId}
      });
    }
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
    validateARSceneControl(extension['ar']);
  }
}

function validateARSceneControl(value: unknown): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Kamishibai 3D AR control must be an object.');
  }
  const control = value as Record<string, unknown>;
  for (const key of Object.keys(control)) {
    if (key !== 'cameraId' && key !== 'layer' && key !== 'targets') {
      throw new TypeError(`Kamishibai 3D AR control ${key} is not supported.`);
    }
  }
  validateOptionalString(control['cameraId'], 'ar.cameraId');
  validateOptionalString(control['layer'], 'ar.layer');
  const targets = control['targets'];
  if (targets === undefined) return;
  if (!Array.isArray(targets)) {
    throw new TypeError('Kamishibai 3D AR control targets must be an array.');
  }
  targets.forEach((target, index) => {
    validateARTargetBinding(target, `ar.targets[${index}]`);
  });
}

function validateARTargetBinding(value: unknown, path: string): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`Kamishibai 3D ${path} must be an object.`);
  }
  const target = value as Record<string, unknown>;
  for (const key of Object.keys(target)) {
    if (key !== 'targetId' && key !== 'selector') {
      throw new TypeError(`Kamishibai 3D ${path}.${key} is not supported.`);
    }
  }
  if (typeof target['targetId'] !== 'string' || target['targetId'].trim().length === 0) {
    throw new TypeError(`Kamishibai 3D ${path}.targetId must be a non-empty string.`);
  }
  if (typeof target['selector'] !== 'string' || target['selector'].trim().length === 0) {
    throw new TypeError(`Kamishibai 3D ${path}.selector must be a non-empty string.`);
  }
}

function validateOptionalString(value: unknown, path: string): void {
  if (value === undefined || typeof value === 'string') return;
  throw new TypeError(`3D scene ${path} must be a string.`);
}

function normalizeId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
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
