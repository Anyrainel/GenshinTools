
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const commandType = args[0];
const N = Number(args[1]) || 10;

if (!commandType) {
  console.error("Usage: node run-headtail.js <command> [lines]");
  process.exit(1);
}

const commands = {
  'type-check': ['tsc', ['-b', '--noEmit']],
  'lint': ['biome', ['check', '.']],
  'test': ['vitest', ['run']],
};

const cmdConfig = commands[commandType];
if (!cmdConfig) {
  console.error(`Unknown command: ${commandType}`);
  process.exit(1);
}

const [cmd, cmdArgs] = cmdConfig;
console.log(`> Running headtail (${N}+${N} lines): ${cmd} ${cmdArgs.join(' ')}`);

const child = spawn(cmd, cmdArgs, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });

const allLines = [];

child.stdout.on('data', handleData);
child.stderr.on('data', handleData);

function handleData(data) {
  for (const line of data.toString().split('\n')) {
    allLines.push(line);
  }
}

child.on('close', (code) => {
  const total = allLines.length;
  if (total <= N * 2) {
    // Short enough — print everything, no duplication
    process.stdout.write(allLines.join('\n'));
  } else {
    const head = allLines.slice(0, N);
    const tail = allLines.slice(-N);
    process.stdout.write(head.join('\n'));
    process.stdout.write(`\n... (${total - N * 2} lines omitted) ...\n`);
    process.stdout.write(tail.join('\n'));
  }
  process.exit(code || 0);
});
