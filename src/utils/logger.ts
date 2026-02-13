import pc from 'picocolors';

export const log = {
  info: (msg: string) => console.log(pc.blue('i') + ' ' + msg),

  success: (msg: string) => console.log(pc.green('✓') + ' ' + msg),

  warn: (msg: string) => console.log(pc.yellow('!') + ' ' + msg),

  error: (msg: string) => console.error(pc.red('✗') + ' ' + msg),

  dim: (msg: string) => console.log(pc.dim(msg)),

  step: (n: number, total: number, msg: string) => {
    console.log(pc.dim(`[${n}/${total}]`) + ' ' + msg);
  },

  banner: () => {
    console.log('');
    console.log(
      pc.bold(pc.cyan('branchdb')) +
        pc.dim(' — every branch gets its own database')
    );
    console.log('');
  },

  table: (rows: [string, string][]) => {
    const maxKey = Math.max(...rows.map(([k]) => k.length));
    for (const [key, value] of rows) {
      console.log('  ' + pc.dim(key.padEnd(maxKey + 2)) + value);
    }
  },
};
