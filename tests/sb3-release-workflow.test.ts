// @ts-nocheck

import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {describe, expect, it} from 'vitest';
import {createDeterministicSb3, migrateExtensionId, validateSb3Source} from '@kubohiroya/sb3-toolchain';

import {createTm3dAppReleaseSourceFiles} from '../scripts/sb3/app-source.mjs';
import {createTm3dAppSb3} from '../scripts/sb3/build.mjs';
import {
  checkTm3dAppRelease,
  tm3dAppReleaseCandidateArtifactPath,
  tm3dAppReleaseMetadataPath,
  updateTm3dAppRelease
} from '../scripts/sb3/release-workflow.mjs';

async function withTemporaryDirectory<T>(callback: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tm-3d-app-release-test-'));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, {force: true, recursive: true});
  }
}

describe('SB3 release workflow', () => {
  it('migrates a legacy source fixture structurally without changing unrelated project data', async () => {
    await withTemporaryDirectory(async (root) => {
      const sourceDirectory = path.join(root, 'source');
      const files = await createTm3dAppReleaseSourceFiles();
      const oldId = 'kubohiroyatm3dapp';
      const newId = 'kubohiroya3dscenedsl';
      const oldPath = `extensions/${oldId}.js`;
      const newPath = `extensions/${newId}.js`;
      const project = JSON.parse(files.get('project.source.json').toString());
      project.extensionURLs = {[oldId]: `embedded-extension:${oldPath}`};
      project.meta.agent = 'legacy-fixture';
      const targets = structuredClone(project.targets);
      const embedded = JSON.parse(files.get('embedded-extensions.json').toString());
      embedded.extensions[0].id = oldId;
      embedded.extensions[0].path = oldPath;
      files.set('project.source.json', Buffer.from(JSON.stringify(project)));
      files.set('embedded-extensions.json', Buffer.from(JSON.stringify(embedded)));
      files.set(oldPath, files.get(newPath));
      files.delete(newPath);
      for (const [filename, bytes] of files) {
        const destination = path.join(sourceDirectory, filename);
        await mkdir(path.dirname(destination), {recursive: true});
        await writeFile(destination, bytes);
      }
      await validateSb3Source(sourceDirectory);
      const result = await migrateExtensionId({sourceDirectory, fromId: oldId, toId: newId, yes: true});
      expect(result.totalChanges).toBe(5);
      expect(result.unclassifiedReferences).toEqual([]);
      await validateSb3Source(sourceDirectory);
      const migrated = JSON.parse(await readFile(path.join(sourceDirectory, 'project.source.json'), 'utf8'));
      expect(migrated.targets).toEqual(targets);
      expect(migrated.meta.agent).toBe('legacy-fixture');
      expect(migrated.extensionURLs).toEqual({[newId]: `embedded-extension:${newPath}`});
      expect(await readFile(path.join(sourceDirectory, newPath), 'utf8')).toContain("opcode: 'statusReporter'");
      await expect(readFile(path.join(sourceDirectory, oldPath))).rejects.toMatchObject({code: 'ENOENT'});
      const first = await createDeterministicSb3(sourceDirectory);
      const second = await createDeterministicSb3(sourceDirectory);
      expect(Buffer.from(first.archive)).toEqual(Buffer.from(second.archive));
    });
  });

  it('regenerates coherent manifests, extension identity, and backdrop integrity', async () => {
    const files = await createTm3dAppReleaseSourceFiles();
    const project = JSON.parse(files.get('project.source.json').toString());
    const embedded = JSON.parse(files.get('embedded-extensions.json').toString());
    const manifest = JSON.parse(files.get('sb3-source.json').toString());
    const id = 'kubohiroya3dscenedsl';
    const extensionPath = `extensions/${id}.js`;
    expect(project.extensionURLs).toEqual({[id]: `embedded-extension:${extensionPath}`});
    expect(project.meta.agent).toBe('turbowarp-3d-scene-dsl');
    expect(embedded.extensions).toEqual([
      {id, path: extensionPath, mediaType: 'text/javascript', parameters: [], encoding: 'base64'}
    ]);
    const extension = files.get(extensionPath).toString();
    expect(extension).toContain(`id: '${id}'`);
    expect(extension).toContain("opcode: 'statusReporter'");
    expect(extension).not.toContain('kubohiroyatm3dapp');
    const costume = project.targets[0].costumes[0];
    const backdrop = files.get(`assets/${costume.md5ext}`);
    expect(createHash('md5').update(backdrop).digest('hex')).toBe(costume.assetId);
    expect(manifest.archiveEntries).toEqual(['project.json', costume.md5ext]);
    await withTemporaryDirectory(async (root) => {
      const {metadata} = await updateTm3dAppRelease({root});
      expect(metadata.artifact.filename).toBe('turbowarp-3d-scene-dsl-0.1.0.sb3');
    });
  });

  it('generates deterministic app SB3 archives from source files', async () => {
    const first = await createTm3dAppSb3();
    const second = await createTm3dAppSb3();

    expect(Buffer.from(first.archive)).toEqual(Buffer.from(second.archive));
  });

  it('updates and checks release candidate metadata', async () => {
    await withTemporaryDirectory(async (root) => {
      const result = await updateTm3dAppRelease({root});

      expect(result.artifactPath).toBe(path.join(root, tm3dAppReleaseCandidateArtifactPath));
      expect(result.metadata.state).toBe('candidate');
      expect(result.metadata.artifact.filename).toMatch(/\.sb3$/u);
      await expect(checkTm3dAppRelease({root})).resolves.toEqual(result.metadata);
    });
  });

  it('detects stale release source files', async () => {
    await withTemporaryDirectory(async (root) => {
      await updateTm3dAppRelease({root});
      await expect(
        checkTm3dAppRelease({
          root,
          createSourceFiles: async () => {
            const files = await createTm3dAppReleaseSourceFiles();
            files.set('changed.txt', Buffer.from('changed\n'));
            return files;
          }
        })
      ).rejects.toThrow(/source changed/u);
    });
  });

  it('reports the metadata path expected by the release workflow', () => {
    expect(tm3dAppReleaseMetadataPath).toMatch(/^release-metadata\/.+\.json$/u);
  });
});
