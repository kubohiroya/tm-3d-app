import {describe, expect, it} from 'vitest';
import {
  createTurboWarpExtensionPlan,
  normalizeKamishibai3DSceneExtension,
  normalizeSceneDocument,
  parseSceneYaml,
  stringifySceneYaml
} from '../src/index.js';

describe('scene YAML documents', () => {
  it('parses handwritten scene YAML and fills app defaults', () => {
    const scene = parseSceneYaml([
      'formatVersion: 1',
      'root:',
      '  children:',
      '    - type: group',
      '      id: field',
      '      children:',
      '        - type: box',
      '          id: monster-card',
      '          class: monster',
      '          data:',
      '            zone: field',
      '          attributes:',
      '            position: 0 1 -3'
    ].join('\n'));

    expect(scene.options).toEqual({layer: 'above-stage', mode: '3d'});
    expect(scene.root.id).toBe('scene');
    expect(scene.root.children?.[0]?.id).toBe('field');
    expect(scene.root.children?.[0]?.children?.[0]?.id).toBe('monster-card');
  });

  it('generates deterministic ids for nodes without ids', () => {
    const scene = parseSceneYaml([
      'formatVersion: 1',
      'root:',
      '  children:',
      '    - type: box',
      '      class: card',
      '    - type: box',
      '      class: card'
    ].join('\n'));

    expect(scene.root.children?.map((node) => node.id)).toEqual(['scene-box-1', 'scene-box-2']);
  });

  it('serializes normalized scene YAML', () => {
    const yaml = stringifySceneYaml({
      formatVersion: 1,
      options: {layer: 'camera-under-3d', mode: 'ar-fallback'},
      root: {
        children: [{type: 'box', id: 'card', data: {zone: 'field'}}]
      }
    });

    expect(yaml).toContain('formatVersion: 1');
    expect(yaml).toContain('layer: camera-under-3d');
    expect(yaml).toContain('id: card');
    expect(yaml).toContain('zone: field');
  });

  it('rejects malformed scene documents', () => {
    expect(() => parseSceneYaml('formatVersion: 1\nextra: true\nroot: {}\n')).toThrow(
      '3D scene document extra is not supported.'
    );
    expect(() => parseSceneYaml('formatVersion: 1\noptions:\n  extra: true\nroot: {}\n')).toThrow(
      '3D scene document options.extra is not supported.'
    );
    expect(() => parseSceneYaml('formatVersion: 2\nroot: {}\n')).toThrow(
      '3D scene document formatVersion must be 1.'
    );
    expect(() => parseSceneYaml('formatVersion: 1\nroot:\n  children: nope\n')).toThrow(
      '3D scene scene.root.children must be an array.'
    );
  });

  it('rejects duplicate normalized ids', () => {
    expect(() =>
      normalizeSceneDocument({
        formatVersion: 1,
        root: {
          children: [
            {type: 'box', id: 'duplicate'},
            {type: 'sphere', id: 'duplicate'}
          ]
        }
      })
    ).toThrow('Duplicate 3D scene node id: duplicate');
  });

  it('normalizes kamishibai 3D scene extensions', () => {
    const extension = normalizeKamishibai3DSceneExtension({
      scene3d: {
        formatVersion: 1,
        root: {
          children: [{type: 'box', class: 'card'}]
        }
      },
      ar: {
        targets: [{targetId: 'marker-1', selector: '#scene-box-1'}]
      }
    });

    expect(extension.scene3d?.root.children?.[0]?.id).toBe('scene-box-1');
    expect(extension.ar).toEqual({
      cameraId: 'default',
      layer: 'camera-under-3d',
      targets: [{targetId: 'marker-1', selector: '#scene-box-1'}]
    });
  });

  it('plans low-level TurboWarp extension calls for 3D and AR setup', () => {
    const calls = createTurboWarpExtensionPlan({
      scene3d: {
        formatVersion: 1,
        options: {layer: 'above-stage', mode: '3d'},
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

    expect(calls).toEqual([
      {
        extension: 'turbowarp-aframe',
        opcode: 'createScene',
        args: {LAYER: 'above-stage', MODE: '3d'}
      },
      {
        extension: 'turbowarp-aframe',
        opcode: 'createNode',
        args: {TYPE: 'box', ID: 'card', PARENT: '#scene'}
      },
      {
        extension: 'turbowarp-aframe',
        opcode: 'addClass',
        args: {CLASS: 'monster', SELECTOR: '#card'}
      },
      {
        extension: 'turbowarp-aframe',
        opcode: 'addClass',
        args: {CLASS: 'selected', SELECTOR: '#card'}
      },
      {
        extension: 'turbowarp-aframe',
        opcode: 'setData',
        args: {SELECTOR: '#card', KEY: 'zone', VALUE: 'field'}
      },
      {
        extension: 'turbowarp-aframe',
        opcode: 'setAttribute',
        args: {SELECTOR: '#card', NAME: 'position', VALUE: '0 1 -3'}
      },
      {
        extension: 'turbowarp-ar',
        opcode: 'createARScene',
        args: {CAMERA_ID: 'front', LAYER: 'camera-under-3d'}
      },
      {
        extension: 'turbowarp-ar',
        opcode: 'defineARTarget',
        args: {TARGET_ID: 'marker-1'}
      },
      {
        extension: 'turbowarp-ar',
        opcode: 'attachSelectorToARTarget',
        args: {SELECTOR: '#card', TARGET_ID: 'marker-1'}
      }
    ]);
  });
});
