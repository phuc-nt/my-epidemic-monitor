#!/usr/bin/env node
/**
 * test-privacy-block.cjs - Unit tests for privacy-block hook
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const HOOK_PATH = path.join(__dirname, '..', 'privacy-block.cjs');
const MK_CONFIG_PATH = path.join(__dirname, '..', '.mk.json');

async function runHook(hookData, cwd = undefined) {
  return new Promise((resolve) => {
    const options = cwd ? { cwd } : {};
    const proc = spawn('node', [HOOK_PATH], options);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ code, stderr });
    });

    proc.stdin.write(JSON.stringify(hookData));
    proc.stdin.end();
  });
}

// Test cases - blocking without APPROVED: prefix
const blockTests = [
  {
    name: '.env file - should block',
    input: { tool_input: { file_path: '.env' } },
    expectBlomk: true,
    expectContains: 'PRIVACY BLOCK'
  },
  {
    name: '.env.local - should block',
    input: { tool_input: { file_path: '.env.local' } },
    expectBlomk: true,
    expectContains: 'APPROVED:'
  },
  {
    name: 'credentials.json - should block',
    input: { tool_input: { file_path: 'config/credentials.json' } },
    expectBlomk: true
  },
  {
    name: 'id_rsa - should block',
    input: { tool_input: { file_path: '~/.ssh/id_rsa' } },
    expectBlomk: true
  },
  {
    name: '.env in bash command - should block',
    input: { tool_input: { command: 'cat .env' } },
    expectBlomk: true
  },
  {
    name: 'secrets.yaml - should block',
    input: { tool_input: { file_path: 'secrets.yaml' } },
    expectBlomk: true
  },
  {
    name: 'private.key - should block',
    input: { tool_input: { file_path: 'certs/private.key' } },
    expectBlomk: true
  },
  // NEW: URL-encoded paths
  {
    name: 'URL-encoded .env (%2e%65%6e%76) - should block',
    input: { tool_input: { file_path: '%2eenv' } },
    expectBlomk: true
  },
  // NEW: Bash variable assignments
  {
    name: 'bash variable FILE=.env - should block',
    input: { tool_input: { command: 'FILE=.env cat $FILE' } },
    expectBlomk: true
  },
  // NEW: Command substitution
  {
    name: 'command substitution $(cat .env) - should block',
    input: { tool_input: { command: 'echo $(cat .env)' } },
    expectBlomk: true
  }
];

// Test cases - allowing with APPROVED: prefix
const allowTests = [
  {
    name: 'APPROVED:.env - should allow',
    input: { tool_input: { file_path: 'APPROVED:.env' } },
    expectBlomk: false,
    expectContains: 'User-approved'
  },
  {
    name: 'APPROVED:.env.local - should allow',
    input: { tool_input: { file_path: 'APPROVED:.env.local' } },
    expectBlomk: false
  },
  {
    name: 'APPROVED:credentials.json - should allow',
    input: { tool_input: { file_path: 'APPROVED:config/credentials.json' } },
    expectBlomk: false
  },
  {
    name: 'APPROVED in bash command - should allow',
    input: { tool_input: { command: 'cat APPROVED:.env' } },
    expectBlomk: false
  }
];

// Test cases - non-sensitive files (always allowed)
const safeTests = [
  {
    name: 'regular file - should allow',
    input: { tool_input: { file_path: 'src/index.ts' } },
    expectBlomk: false
  },
  {
    name: 'package.json - should allow',
    input: { tool_input: { file_path: 'package.json' } },
    expectBlomk: false
  },
  {
    name: 'README.md - should allow',
    input: { tool_input: { file_path: 'README.md' } },
    expectBlomk: false
  }
];

// Test cases - example/sample/template files (exempt from privacy checks)
const exemptTests = [
  {
    name: '.env.example - should allow (exempt)',
    input: { tool_input: { file_path: '.env.example' } },
    expectBlomk: false
  },
  {
    name: '.env.local.example - should allow (exempt)',
    input: { tool_input: { file_path: '.env.local.example' } },
    expectBlomk: false
  },
  {
    name: '.env.sample - should allow (exempt)',
    input: { tool_input: { file_path: '.env.sample' } },
    expectBlomk: false
  },
  {
    name: '.env.template - should allow (exempt)',
    input: { tool_input: { file_path: '.env.template' } },
    expectBlomk: false
  },
  {
    name: 'config/.env.example - should allow (exempt)',
    input: { tool_input: { file_path: 'config/.env.example' } },
    expectBlomk: false
  },
  {
    name: 'credentials.example - should allow (exempt)',
    input: { tool_input: { file_path: 'credentials.example' } },
    expectBlomk: false
  },
  {
    name: 'cat .env.example in bash - should allow (exempt)',
    input: { tool_input: { command: 'cat .env.example' } },
    expectBlomk: false
  }
];

// Test cases - config toggle (privacyBlomk: false)
const configToggleTests = [
  {
    name: 'privacyBlomk: false - .env should allow',
    input: { tool_input: { file_path: '.env' } },
    config: { privacyBlomk: false },
    expectBlomk: false
  },
  {
    name: 'privacyBlomk: false - credentials.json should allow',
    input: { tool_input: { file_path: 'credentials.json' } },
    config: { privacyBlomk: false },
    expectBlomk: false
  },
  {
    name: 'privacyBlomk: true - .env should block',
    input: { tool_input: { file_path: '.env' } },
    config: { privacyBlomk: true },
    expectBlomk: true
  }
];

async function main() {
  console.log('Testing privacy-block hook...\n');

  let passed = 0;
  let failed = 0;

  console.log('\x1b[1m--- Block Tests (no APPROVED: prefix) ---\x1b[0m');
  for (const test of blockTests) {
    const result = await runHook(test.input);
    const blocked = result.code === 2;
    const success = blocked === test.expectBlock;
    const containsOk = !test.expectContains || result.stderr.includes(test.expectContains);

    if (success && containsOk) {
      console.log(`\x1b[32m✓\x1b[0m ${test.name}`);
      passed++;
    } else {
      console.log(`\x1b[31m✗\x1b[0m ${test.name}: expected BLOCK, got ${blocked ? 'BLOCK' : 'ALLOW'}`);
      failed++;
    }
  }

  console.log('\n\x1b[1m--- Allow Tests (with APPROVED: prefix) ---\x1b[0m');
  for (const test of allowTests) {
    const result = await runHook(test.input);
    const blocked = result.code === 2;
    const success = blocked === test.expectBlock;
    const containsOk = !test.expectContains || result.stderr.includes(test.expectContains);

    if (success && containsOk) {
      console.log(`\x1b[32m✓\x1b[0m ${test.name}`);
      passed++;
    } else {
      console.log(`\x1b[31m✗\x1b[0m ${test.name}: expected ALLOW, got ${blocked ? 'BLOCK' : 'ALLOW'}`);
      failed++;
    }
  }

  console.log('\n\x1b[1m--- Safe Files (always allowed) ---\x1b[0m');
  for (const test of safeTests) {
    const result = await runHook(test.input);
    const blocked = result.code === 2;
    const success = blocked === test.expectBlock;

    if (success) {
      console.log(`\x1b[32m✓\x1b[0m ${test.name}`);
      passed++;
    } else {
      console.log(`\x1b[31m✗\x1b[0m ${test.name}: expected ALLOW, got ${blocked ? 'BLOCK' : 'ALLOW'}`);
      failed++;
    }
  }

  console.log('\n\x1b[1m--- Exempt Files (example/sample/template) ---\x1b[0m');
  for (const test of exemptTests) {
    const result = await runHook(test.input);
    const blocked = result.code === 2;
    const success = blocked === test.expectBlock;

    if (success) {
      console.log(`\x1b[32m✓\x1b[0m ${test.name}`);
      passed++;
    } else {
      console.log(`\x1b[31m✗\x1b[0m ${test.name}: expected ALLOW (exempt), got ${blocked ? 'BLOCK' : 'ALLOW'}`);
      failed++;
    }
  }

  // Config toggle tests - requires temp directory with .claude/.mk.json
  console.log('\n\x1b[1m--- Config Toggle (privacyBlock setting) ---\x1b[0m');
  const os = require('os');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'privacy-test-'));
  const tmpClaudeDir = path.join(tmpDir, '.claude');
  fs.mkdirSync(tmpClaudeDir, { recursive: true });

  for (const test of configToggleTests) {
    // Write test config
    fs.writeFileSync(
      path.join(tmpClaudeDir, '.mk.json'),
      JSON.stringify(test.config)
    );

    const result = await runHook(test.input, tmpDir);
    const blocked = result.code === 2;
    const success = blocked === test.expectBlock;

    if (success) {
      console.log(`\x1b[32m✓\x1b[0m ${test.name}`);
      passed++;
    } else {
      console.log(`\x1b[31m✗\x1b[0m ${test.name}: expected ${test.expectBlock ? 'BLOCK' : 'ALLOW'}, got ${blocked ? 'BLOCK' : 'ALLOW'}`);
      failed++;
    }
  }

  // Cleanup temp directory
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`\n\x1b[1mResults:\x1b[0m ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
