import {parse as parseYaml, stringify as stringifyYaml} from 'yaml';

export interface SceneOptions {
  layer: string;
  mode: string;
}

export interface SceneNodeTemplate {
  type?: string;
  id?: string;
  class?: string | string[];
  classes?: string[];
  data?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  children?: SceneNodeTemplate[];
}

export interface SceneDocument {
  formatVersion: 1;
  options?: Partial<SceneOptions>;
  root: SceneNodeTemplate;
}

export interface NormalizedSceneDocument {
  formatVersion: 1;
  options: SceneOptions;
  root: SceneNodeTemplate;
}

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
  | {
      extension: 'turbowarp-aframe';
      opcode: 'createScene';
      args: {LAYER: string; MODE: string};
    }
  | {
      extension: 'turbowarp-aframe';
      opcode: 'createNode';
      args: {TYPE: string; ID: string; PARENT: string};
    }
  | {
      extension: 'turbowarp-aframe';
      opcode: 'addClass';
      args: {CLASS: string; SELECTOR: string};
    }
  | {
      extension: 'turbowarp-aframe';
      opcode: 'setData';
      args: {SELECTOR: string; KEY: string; VALUE: string};
    }
  | {
      extension: 'turbowarp-aframe';
      opcode: 'setAttribute';
      args: {SELECTOR: string; NAME: string; VALUE: string};
    }
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

const DEFAULT_SCENE_OPTIONS: SceneOptions = {layer: 'above-stage', mode: '3d'};
const DEFAULT_AR_LAYER = 'camera-under-3d';
const ROOT_ID = 'scene';
const TEMPLATE_NODE_KEYS = new Set([
  'attributes',
  'children',
  'class',
  'classes',
  'data',
  'id',
  'type'
]);
const SCENE_DOCUMENT_KEYS = new Set(['formatVersion', 'options', 'root']);
const SCENE_OPTION_KEYS = new Set(['layer', 'mode']);

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
    calls.push({
      extension: 'turbowarp-aframe',
      opcode: 'createScene',
      args: {
        LAYER: normalized.scene3d.options.layer,
        MODE: normalized.scene3d.options.mode
      }
    });
    for (const child of normalized.scene3d.root.children ?? []) {
      appendNodeCalls(calls, child, ROOT_ID);
    }
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
  validateSceneDocument(document);
  const root = cloneNode(document.root);
  root.id = ROOT_ID;
  root.children = (root.children ?? []).map((child, index) =>
    normalizeChildNode(child, ROOT_ID, index)
  );
  assertUniqueNodeIds(root);
  return {
    formatVersion: 1,
    options: {
      layer: document.options?.layer ?? DEFAULT_SCENE_OPTIONS.layer,
      mode: document.options?.mode ?? DEFAULT_SCENE_OPTIONS.mode
    },
    root
  };
}

export function validateSceneDocument(value: unknown): asserts value is SceneDocument {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('3D scene document must be an object.');
  }
  const document = value as Record<string, unknown>;
  for (const key of Object.keys(document)) {
    if (!SCENE_DOCUMENT_KEYS.has(key)) {
      throw new TypeError(`3D scene document ${key} is not supported.`);
    }
  }
  if (document['formatVersion'] !== 1) {
    throw new TypeError('3D scene document formatVersion must be 1.');
  }
  if (document['options'] !== undefined) {
    validateSceneOptions(document['options']);
  }
  validateSceneNodeTemplate(document['root'], 'scene.root');
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

export function validateSceneNodeTemplate(
  value: unknown,
  path = 'node'
): asserts value is SceneNodeTemplate {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`3D scene ${path} must be an object.`);
  }
  const node = value as Record<string, unknown>;
  for (const key of Object.keys(node)) {
    if (!TEMPLATE_NODE_KEYS.has(key)) {
      throw new TypeError(`3D scene ${path}.${key} is not supported.`);
    }
  }
  validateOptionalString(node['type'], `${path}.type`);
  validateOptionalString(node['id'], `${path}.id`);
  validateTemplateClass(node['class'], `${path}.class`);
  validateOptionalStringArray(node['classes'], `${path}.classes`);
  validateStringRecord(node['data'], `${path}.data`);
  validateStringRecord(node['attributes'], `${path}.attributes`);
  const children = node['children'];
  if (children === undefined) return;
  if (!Array.isArray(children)) {
    throw new TypeError(`3D scene ${path}.children must be an array.`);
  }
  children.forEach((child, index) => {
    validateSceneNodeTemplate(child, `${path}.children[${index}]`);
  });
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

function appendNodeCalls(
  calls: TurboWarpExtensionCall[],
  node: SceneNodeTemplate,
  parentId: string
): void {
  const id = normalizeId(node.id ?? '');
  if (id.length === 0) {
    throw new TypeError('Normalized 3D scene nodes must have ids before planning.');
  }
  const selector = `#${id}`;
  calls.push({
    extension: 'turbowarp-aframe',
    opcode: 'createNode',
    args: {TYPE: node.type ?? 'group', ID: id, PARENT: `#${parentId}`}
  });
  for (const className of classTokens(node)) {
    calls.push({
      extension: 'turbowarp-aframe',
      opcode: 'addClass',
      args: {CLASS: className, SELECTOR: selector}
    });
  }
  for (const [key, value] of Object.entries(node.data ?? {})) {
    calls.push({
      extension: 'turbowarp-aframe',
      opcode: 'setData',
      args: {SELECTOR: selector, KEY: key, VALUE: String(value)}
    });
  }
  for (const [name, value] of Object.entries(node.attributes ?? {})) {
    calls.push({
      extension: 'turbowarp-aframe',
      opcode: 'setAttribute',
      args: {SELECTOR: selector, NAME: name, VALUE: String(value)}
    });
  }
  for (const child of node.children ?? []) {
    appendNodeCalls(calls, child, id);
  }
}

function classTokens(node: SceneNodeTemplate): string[] {
  return [
    ...(Array.isArray(node.class) ? node.class : String(node.class ?? '').split(/\s+/)),
    ...(node.classes ?? [])
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function validateSceneOptions(value: unknown): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('3D scene document options must be an object.');
  }
  const options = value as Record<string, unknown>;
  for (const key of Object.keys(options)) {
    if (!SCENE_OPTION_KEYS.has(key)) {
      throw new TypeError(`3D scene document options.${key} is not supported.`);
    }
  }
  validateOptionalString(options['layer'], 'scene.options.layer');
  validateOptionalString(options['mode'], 'scene.options.mode');
}

function normalizeChildNode(
  node: SceneNodeTemplate,
  parentId: string,
  index: number
): SceneNodeTemplate {
  const next = cloneNode(node);
  next.id = normalizeId(next.id ?? fallbackNodeId(next, parentId, index));
  next.children = (next.children ?? []).map((child, childIndex) =>
    normalizeChildNode(child, next.id ?? ROOT_ID, childIndex)
  );
  return next;
}

function assertUniqueNodeIds(root: SceneNodeTemplate): void {
  const ids = new Set<string>();
  visit(root, (node) => {
    const id = normalizeId(node.id ?? '');
    if (id.length === 0) return;
    if (ids.has(id)) {
      throw new Error(`Duplicate 3D scene node id: ${id}`);
    }
    ids.add(id);
  });
}

function visit(node: SceneNodeTemplate, visitor: (node: SceneNodeTemplate) => void): void {
  visitor(node);
  for (const child of node.children ?? []) {
    visit(child, visitor);
  }
}

function fallbackNodeId(node: SceneNodeTemplate, parentId: string, index: number): string {
  const type = normalizeId(node.type ?? 'node') || 'node';
  return `${parentId}-${type}-${index + 1}`;
}

function cloneNode(node: SceneNodeTemplate): SceneNodeTemplate {
  const clone: SceneNodeTemplate = {...node};
  if (node.data !== undefined) {
    clone.data = {...node.data};
  }
  if (node.attributes !== undefined) {
    clone.attributes = {...node.attributes};
  }
  if (node.children !== undefined) {
    clone.children = node.children.map(cloneNode);
  }
  return clone;
}

function validateTemplateClass(value: unknown, path: string): void {
  if (value === undefined || typeof value === 'string') return;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return;
  throw new TypeError(`3D scene ${path} must be a string or string array.`);
}

function validateOptionalStringArray(value: unknown, path: string): void {
  if (value === undefined) return;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return;
  throw new TypeError(`3D scene ${path} must be a string array.`);
}

function validateOptionalString(value: unknown, path: string): void {
  if (value === undefined || typeof value === 'string') return;
  throw new TypeError(`3D scene ${path} must be a string.`);
}

function validateStringRecord(value: unknown, path: string): void {
  if (value === undefined) return;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`3D scene ${path} must be an object.`);
  }
  for (const [key, recordValue] of Object.entries(value)) {
    if (key.trim().length === 0) {
      throw new TypeError(`3D scene ${path} keys must be non-empty strings.`);
    }
    if (recordValue === undefined) {
      throw new TypeError(`3D scene ${path}.${key} must not be undefined.`);
    }
  }
}

function normalizeId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
}
