#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';

const sourceRoot = resolve(process.cwd());
const targetArgument = process.argv[2];
if (!targetArgument) throw new Error('Usage: node scripts/sync-non-ai.mjs <non-ai worktree>');

const targetRoot = resolve(targetArgument);
if (targetRoot === sourceRoot || !existsSync(join(targetRoot, '.git'))) {
  throw new Error('The target must be a separate Git worktree.');
}

const targetBranch = execFileSync('git', ['-C', targetRoot, 'branch', '--show-current'], { encoding: 'utf8' }).trim();
if (targetBranch !== 'non-ai-version') {
  throw new Error(`Refusing to update branch "${targetBranch || '(detached)'}"; expected "non-ai-version".`);
}

const START = '<!-- AI_ONLY_START -->';
const END = '<!-- AI_ONLY_END -->';
const AI_ONLY_FILES = new Set(['public/ai.css', 'public/ai.js', 'server-ai.js']);
const SHARED_ROOT_FILES = ['.gitignore', 'README.md', 'package.json', 'server.js'];

function stripAiBlocks(content, file) {
  let output = '';
  let cursor = 0;
  while (true) {
    const start = content.indexOf(START, cursor);
    const endWithoutStart = content.indexOf(END, cursor);
    if (start < 0) {
      if (endWithoutStart >= 0) throw new Error(`Unmatched ${END} in ${file}`);
      output += content.slice(cursor);
      break;
    }
    if (endWithoutStart >= 0 && endWithoutStart < start) throw new Error(`Unmatched ${END} in ${file}`);
    const end = content.indexOf(END, start + START.length);
    if (end < 0) throw new Error(`Unmatched ${START} in ${file}`);
    const startLine = content.lastIndexOf('\n', start - 1) + 1;
    const blockStart = content.slice(startLine, start).trim() ? start : startLine;
    output += content.slice(cursor, blockStart);
    const markerEnd = end + END.length;
    const endLine = content.indexOf('\n', markerEnd);
    cursor = endLine >= 0 && !content.slice(markerEnd, endLine).trim() ? endLine + 1 : markerEnd;
  }
  return `${output.replace(/^[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

function copySharedFile(relativePath) {
  if (AI_ONLY_FILES.has(relativePath)) return;
  const source = join(sourceRoot, relativePath);
  const target = join(targetRoot, relativePath);
  mkdirSync(resolve(target, '..'), { recursive: true });
  if (relativePath === 'README.md' || relativePath === 'public/index.html') {
    writeFileSync(target, stripAiBlocks(readFileSync(source, 'utf8'), relativePath));
  } else {
    cpSync(source, target);
  }
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const targetPublic = join(targetRoot, 'public');
if (existsSync(targetPublic)) rmSync(targetPublic, { recursive: true, force: true });
mkdirSync(targetPublic, { recursive: true });

for (const sourceFile of walk(join(sourceRoot, 'public'))) {
  const relativePath = relative(sourceRoot, sourceFile).split(sep).join('/');
  copySharedFile(relativePath);
}
for (const relativePath of SHARED_ROOT_FILES) copySharedFile(relativePath);
for (const relativePath of AI_ONLY_FILES) rmSync(join(targetRoot, relativePath), { force: true });

const generatedIndex = readFileSync(join(targetRoot, 'public/index.html'), 'utf8');
if (generatedIndex.includes(START) || generatedIndex.includes(END) || /(?:ai\.css|ai\.js|id="analyzeAi")/.test(generatedIndex)) {
  throw new Error('Generated index.html still contains AI-only markup.');
}

const generatedApp = readFileSync(join(targetRoot, 'public/app.js'), 'utf8');
if (/Gemini|analyzeAi|aiResult|vehicleYear/.test(generatedApp)) {
  throw new Error('Shared app.js contains AI-only behavior; move it to public/ai.js.');
}

console.log(`Synchronized shared files into ${basename(targetRoot)} (${targetBranch}).`);
