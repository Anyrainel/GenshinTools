
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const commandType = args[0];
const N = Number(args[1]) || 15;

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
let remainder = '';

child.stdout.on('data', handleData);
child.stderr.on('data', handleData);

const stripAnsi = (str) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

function handleData(data) {
  remainder += data.toString();
  const lines = remainder.split('\n');
  remainder = lines.pop() || '';
  
  for (const line of lines) {
    if (stripAnsi(line).trim().length > 0) {
      allLines.push(line);
    }
  }
}

child.on('close', (code) => {
  if (stripAnsi(remainder).trim().length > 0) {
    allLines.push(remainder);
  }
  
  const total = allLines.length;
  if (total === 0) {
    process.exit(code || 0);
  }
  
  if (total <= N * 2) {
    // Short enough — print everything, no duplication
    process.stdout.write(allLines.join('\n') + '\n');
  } else {
    const head = allLines.slice(0, N);
    const tail = allLines.slice(-N);
    process.stdout.write(head.join('\n') + '\n');
    process.stdout.write(`... (${total - N * 2} lines omitted) ...\n`);
    process.stdout.write(tail.join('\n') + '\n');
  }
  process.exit(code || 0);
});
