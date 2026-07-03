import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, readdir } from 'fs/promises';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

/** Convert the first page of a PDF (as bytes) to a PNG base64 string via pdftoppm. */
export async function pdfToPng(pdfBytes: Uint8Array, dpi = 216): Promise<string> {
  const id = randomUUID();
  const pdfPath = `/tmp/epoch-${id}.pdf`;
  const pngPrefix = `/tmp/epoch-${id}`;
  const pngGlob = `epoch-${id}`;
  let pngPath: string | null = null;

  try {
    await writeFile(pdfPath, pdfBytes);
    await execAsync(`pdftoppm -r ${dpi} -png -l 1 "${pdfPath}" "${pngPrefix}"`);

    const tmpFiles = await readdir('/tmp');
    const match = tmpFiles.find((f) => f.startsWith(pngGlob) && f.endsWith('.png'));
    if (!match) throw new Error('pdftoppm produced no PNG output');
    pngPath = `/tmp/${match}`;

    return (await readFile(pngPath)).toString('base64');
  } finally {
    await Promise.all([
      unlink(pdfPath).catch(() => {}),
      pngPath ? unlink(pngPath).catch(() => {}) : Promise.resolve(),
    ]);
  }
}
