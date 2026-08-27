// @ts-nocheck

import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

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
