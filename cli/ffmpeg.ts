import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

/** Finds ffmpeg: FFMPEG_PATH if set (no fallback), else PATH. Returns undefined when missing. */
export function findFfmpeg(): string | undefined {
  const works = (c: string) => spawnSync(c, ['-version'], { stdio: 'ignore' }).status === 0;
  const custom = process.env.FFMPEG_PATH;
  if (custom) {
    if (works(custom)) return custom;
    throw new Error(`FFMPEG_PATH "${custom}" is not a working ffmpeg. Fix the path or unset FFMPEG_PATH.`);
  }
  return works('ffmpeg') ? 'ffmpeg' : undefined;
}

export interface Encoder {
  proc: ChildProcess;
  write(png: Buffer): Promise<void>;
  finish(): Promise<void>;
}

/** Starts ffmpeg. Input: PNG frames on stdin. Output: H.264 yuv420p with correct bt709 tags. */
export function startEncoder(ffmpeg: string, fps: number, out: string): Encoder {
  const args = [
    '-v', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-r', String(fps), '-movflags', '+faststart', out,
  ];
  const proc = spawn(ffmpeg, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise<number>((res) => proc.on('close', (code) => res(code ?? 1)));
  let failed = false;
  proc.stdin!.on('error', () => { failed = true; });
  return {
    proc,
    async write(png) {
      if (failed) throw new Error('ffmpeg stopped early.');
      if (!proc.stdin!.write(png)) await new Promise<void>((r) => proc.stdin!.once('drain', () => r()));
    },
    async finish() {
      proc.stdin!.end();
      const code = await closed;
      if (code !== 0) throw new Error(`ffmpeg failed (exit code ${code}).`);
    },
  };
}
