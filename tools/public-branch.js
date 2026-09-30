// Keeps the branch that may be published in step with the working branch, and installs the guard
// that keeps every other branch from leaving the repository.
//
// The public branch has no history of its own: the reference records used to hold the names and
// ORCID iDs of real people, and those commits must not travel. It therefore carries the current
// tree of the working branch as a fresh commit each time, without any ancestry.
//
// Usage:
//   node tools/public-branch.js install   installs .git/hooks/pre-push (once per working copy)
//   node tools/public-branch.js sync      moves the current tree of main onto the public branch
//   node tools/public-branch.js status    shows what would be published

import { execFileSync } from 'node:child_process';
import { copyFileSync, chmodSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRANCH = 'public';
const SOURCE_BRANCH = 'main';

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
// Expected failures (no branch yet, no remote yet) must not print git's own error text.
const gitQuiet = (...args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

/** Copies the hook into .git/hooks; hooks are not part of a clone and have to be set up locally. */
function install() {
  const dir = join(git('rev-parse', '--git-dir').replace(/^(?![A-Za-z]:|\/)/, `${ROOT}/`), 'hooks');
  mkdirSync(dir, { recursive: true });
  const target = join(dir, 'pre-push');
  copyFileSync(join(ROOT, 'tools/hooks/pre-push'), target);
  chmodSync(target, 0o755);
  console.log(`pre-push hook installed: ${target}`);

  // A plain "git push" then pushes the public branch only, and never the working branch.
  if (gitQuiet('remote', 'get-url', 'origin')) {
    git('config', 'remote.origin.push', `refs/heads/${BRANCH}:refs/heads/main`);
    console.log(`remote.origin.push = refs/heads/${BRANCH}:refs/heads/main`);
  } else {
    console.log('No origin yet - run this again after adding it, to set the push refspec.');
  }
}

/**
 * Puts the current tree of the working branch onto the public branch. The first commit has no
 * parent at all, every later one only its predecessor on this branch - the history of the working
 * branch never becomes an ancestor and therefore never travels.
 */
function sync() {
  if (git('status', '--porcelain')) throw new Error('The working tree is not clean - commit or stash first.');
  const tree = git('rev-parse', `${SOURCE_BRANCH}^{tree}`);
  const head = gitQuiet('rev-parse', '--verify', `refs/heads/${BRANCH}`);
  if (head && git('rev-parse', `${BRANCH}^{tree}`) === tree) {
    console.log(`${BRANCH} already carries the tree of ${SOURCE_BRANCH} - nothing to do.`);
    return;
  }
  const message = `Publish ${git('log', '-1', '--format=%h %s', SOURCE_BRANCH)}`;
  const args = head ? ['commit-tree', tree, '-p', head, '-m', message] : ['commit-tree', tree, '-m', message];
  const commit = git(...args);
  git('update-ref', `refs/heads/${BRANCH}`, commit);
  console.log(`${BRANCH}: ${commit.slice(0, 7)} carries the tree of ${SOURCE_BRANCH}${head ? '' : ' (root commit)'}.`);
}

/** What the public branch holds and whether the guard is in place. */
function status() {
  const head = gitQuiet('rev-parse', '--verify', `refs/heads/${BRANCH}`);
  console.log(`${BRANCH}: ${head ? `${head.slice(0, 7)}, ${git('rev-list', '--count', BRANCH)} commit(s)` : 'does not exist yet'}`);
  if (head) {
    const roots = git('rev-list', '--max-parents=0', BRANCH).split(/\r?\n/).filter(Boolean);
    const shared = gitQuiet('merge-base', BRANCH, SOURCE_BRANCH);
    console.log(`root commits: ${roots.length}, shared history with ${SOURCE_BRANCH}: ${shared ? 'YES - not clean!' : 'none'}`);
    console.log(`same tree as ${SOURCE_BRANCH}: ${git('rev-parse', `${BRANCH}^{tree}`) === git('rev-parse', `${SOURCE_BRANCH}^{tree}`) ? 'yes' : 'no - run sync'}`);
  }
  const hook = join(ROOT, '.git/hooks/pre-push');
  console.log(`pre-push hook: ${existsSync(hook) ? 'installed' : 'MISSING - run install'}`);
  console.log(`push refspec: ${gitQuiet('config', 'remote.origin.push') ?? 'not set (no origin yet)'}`);
}

const command = process.argv[2];
const commands = { install, sync, status };
if (!commands[command]) {
  console.error('Usage: node tools/public-branch.js install | sync | status');
  process.exit(1);
}
commands[command]();
