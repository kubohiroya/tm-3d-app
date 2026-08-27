import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {buildSb3, createDeterministicSb3} from '@kubohiroya/sb3-toolchain';

import {createTm3dAppReleaseSourceFiles} from './app-source.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
export const defaultTm3dAppOutputPath = path.join(repositoryRoot, 'tmp', 'tm-3d-app.sb3');

async function writeSourceFiles(directory, files) {
  for (const [relativePath, contents] of [...files.entries()].sort(([left], [right]) =>
    left.localeCompare(right, 'en')
  )) {
    const outputPath = path.join(directory, relativePath);
    await mkdir(path.dirname(outputPath), {recursive: true});
    await writeFile(outputPath, contents);
  }
}

export async function withTm3dAppSourceDirectory(callback, {createSourceFiles} = {}) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'tm-3d-app-source-'));
  const sourceDirectory = path.join(temporaryRoot, 'app');
  try {
    await writeSourceFiles(sourceDirectory, await (createSourceFiles ?? createTm3dAppReleaseSourceFiles)());
    return await callback(sourceDirectory);
  } finally {
    await rm(temporaryRoot, {force: true, recursive: true});
  }
}

export async function createTm3dAppSb3({create = createDeterministicSb3, createSourceFiles} = {}) {
  return withTm3dAppSourceDirectory((sourceDirectory) => create(sourceDirectory), {
    createSourceFiles
  });
}

export async function buildTm3dAppSb3({
  build = buildSb3,
  createSourceFiles,
  outputPath = defaultTm3dAppOutputPath,
  yes = false
} = {}) {
  return withTm3dAppSourceDirectory(
    (sourceDirectory) =>
      build({
        outputPath,
        sourceDirectory,
        yes
      }),
    {createSourceFiles}
  );
}

function argumentValue(name) {
  const position = process.argv.indexOf(name);
  return position === -1 ? undefined : process.argv[position + 1];
}

async function main() {
  const outputPath = argumentValue('--output') ?? defaultTm3dAppOutputPath;
  const result = await buildTm3dAppSb3({outputPath, yes: process.argv.includes('--yes')});
  process.stdout.write(`${result.changed ? 'Built' : 'Unchanged'} ${result.outputPath}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  });
}
