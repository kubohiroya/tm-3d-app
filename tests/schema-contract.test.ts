import {readFile} from 'node:fs/promises';

import {describe, expect, it} from 'vitest';

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
}

describe('JSON Schema contracts', () => {
  it('allows typed scene graph values in node data and attributes', async () => {
    const schema = await readJson('schemas/scene-node.schema.json');
    const defs = schema['$defs'] as Record<string, unknown>;
    const sceneGraphValue = defs['sceneGraphValue'];

    expect(sceneGraphValue).toEqual({
      oneOf: [
        {$ref: '#/$defs/sceneGraphScalar'},
        {$ref: '#/$defs/sceneGraphScalarArray'},
        {$ref: '#/$defs/sceneGraphScalarObject'}
      ]
    });
    expect(defs['sceneGraphScalar']).toEqual({type: ['string', 'number', 'boolean', 'null']});
    expect(defs['sceneGraphScalarArray']).toEqual({
      type: 'array',
      items: {$ref: '#/$defs/sceneGraphScalar'}
    });
    expect(defs['sceneGraphScalarObject']).toEqual({
      type: 'object',
      propertyNames: {type: 'string', minLength: 1},
      additionalProperties: {$ref: '#/$defs/sceneGraphScalar'}
    });

    const properties = schema['properties'] as Record<string, Record<string, unknown>>;
    expect(properties['data']?.['additionalProperties']).toEqual({
      $ref: '#/$defs/sceneGraphValue'
    });
    expect(properties['attributes']?.['additionalProperties']).toEqual({
      $ref: '#/$defs/sceneGraphValue'
    });
  });
});
