import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {
  assertSb3ReleaseSnapshotMetadata,
  createSb3ReleaseSnapshot,
  verifySb3ReleaseSnapshot,
  writeSb3ReleaseCandidate
} from '@kubohiroya/sb3-toolchain';

import {createTm3dAppReleaseSourceFiles} from './app-source.mjs';
import {createTm3dAppSb3} from './build.mjs';

export const tm3dAppReleaseVersion = '0.1.0';
export const tm3dAppReleaseSeries = '0.1';
export const tm3dAppReleaseBuildDate = '2026-08-27';
export const tm3dAppReleaseChannel = 'next';
export const tm3dAppReleaseFilename = `tm-3d-app-${tm3dAppReleaseVersion}.sb3`;
export const tm3dAppReleaseMetadataPath = `release-metadata/${tm3dAppReleaseVersion}.json`;
export const tm3dAppReleaseCandidateArtifactPath = `tmp/release-candidates/${tm3dAppReleaseFilename}`;

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

export function assertTm3dAppReleaseMetadata(metadata) {
  assertSb3ReleaseSnapshotMetadata(metadata);
  assert.equal(metadata.series, tm3dAppReleaseSeries, 'TM 3D app release series is invalid.');
  assert.equal(metadata.version, tm3dAppReleaseVersion, 'TM 3D app release version is invalid.');
  assert.equal(metadata.channel, tm3dAppReleaseChannel, 'TM 3D app release channel is invalid.');
  assert.equal(
    metadata.buildDate,
    tm3dAppReleaseBuildDate,
    'TM 3D app release build date is invalid.'
  );
  assert.deepEqual(metadata.publication?.npm, {distTag: tm3dAppReleaseChannel});
  return metadata;
}

async function readMetadata(root) {
  try {
    return assertTm3dAppReleaseMetadata(
      JSON.parse(await readFile(path.join(root, tm3dAppReleaseMetadataPath), 'utf8'))
    );
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function updateTm3dAppRelease({
  root = repositoryRoot,
  createSourceFiles = createTm3dAppReleaseSourceFiles,
  createSb3 = createTm3dAppSb3
} = {}) {
  const sourceFiles = await createSourceFiles();
  const built = await createSb3ReleaseSnapshot({
    artifact: {filename: tm3dAppReleaseFilename},
    createSb3: () => createSb3({createSourceFiles: async () => sourceFiles}),
    metadata: {
      series: tm3dAppReleaseSeries,
      version: tm3dAppReleaseVersion,
      channel: tm3dAppReleaseChannel,
      buildDate: tm3dAppReleaseBuildDate
    },
    publication: {npm: {distTag: tm3dAppReleaseChannel}},
    sourceFiles
  });
  const metadata = assertTm3dAppReleaseMetadata(built.metadata);
  await writeSb3ReleaseCandidate({
    archive: built.archive,
    artifactPath: path.join(root, tm3dAppReleaseCandidateArtifactPath),
    metadata,
    metadataPath: path.join(root, tm3dAppReleaseMetadataPath)
  });
  return {
    artifactPath: path.join(root, tm3dAppReleaseCandidateArtifactPath),
    metadata
  };
}

export async function checkTm3dAppRelease({
  root = repositoryRoot,
  createSourceFiles = createTm3dAppReleaseSourceFiles,
  createSb3 = createTm3dAppSb3
} = {}) {
  const metadata = await readMetadata(root);
  assert(metadata, `Missing ${tm3dAppReleaseMetadataPath}. Run pnpm release:sb3:update.`);
  const sourceFiles = await createSourceFiles();
  await verifySb3ReleaseSnapshot({
    createSb3: () => createSb3({createSourceFiles: async () => sourceFiles}),
    metadata,
    sourceFiles
  });
  return metadata;
}

async function main() {
  const command = process.argv[2];
  if (command === 'update') {
    const {artifactPath, metadata} = await updateTm3dAppRelease();
    process.stdout.write(`Updated ${metadata.version} candidate: ${artifactPath}\n`);
    return;
  }
  if (command === 'check') {
    const metadata = await checkTm3dAppRelease();
    process.stdout.write(`Verified ${metadata.version} ${metadata.state}: ${metadata.artifact.sha256}\n`);
    return;
  }
  throw new Error('Usage: release-workflow.mjs <update|check>');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  });
}
