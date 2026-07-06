import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, readdir } from 'fs/promises';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

/** Convert the first page of a PDF (as bytes) to a PNG base64 string.
 *  Tries pdftoppm first, then Ghostscript (gs / gswin64c) as a fallback.
 *  Throws if neither tool is available. */
export async function pdfToPng(pdfBytes: Uint8Array, dpi = 150): Promise<string> {
  const id = randomUUID();
  const tmpDir = os.tmpdir();
  const pdfPath = path.join(tmpDir, `epoch-${id}.pdf`);
  const pngPrefix = path.join(tmpDir, `epoch-${id}`);
  let pngPath: string | null = null;

  try {
    await writeFile(pdfPath, pdfBytes);

    // Try pdftoppm (poppler-utils, available on Linux/Mac and Windows with poppler installed)
    try {
      await execAsync(`pdftoppm -r ${dpi} -png -l 1 "${pdfPath}" "${pngPrefix}"`);
      const tmpFiles = await readdir(tmpDir);
      const match = tmpFiles.find((f) => f.startsWith(`epoch-${id}`) && f.endsWith('.png'));
      if (match) {
        pngPath = path.join(tmpDir, match);
        return (await readFile(pngPath)).toString('base64');
      }
    } catch { /* pdftoppm not available — try Ghostscript */ }

    // Try Ghostscript (gs on Linux/Mac, gswin64c on Windows)
    const gsBin = process.platform === 'win32' ? 'gswin64c' : 'gs';
    const gsPng = path.join(tmpDir, `epoch-${id}-gs.png`);
    await execAsync(
      `${gsBin} -dNOPAUSE -dBATCH -sDEVICE=png16m -r${dpi} -dFirstPage=1 -dLastPage=1 ` +
      `-sOutputFile="${gsPng}" "${pdfPath}"`,
    );
    pngPath = gsPng;
    return (await readFile(pngPath)).toString('base64');
  } finally {
    await Promise.all([
      unlink(pdfPath).catch(() => {}),
      pngPath ? unlink(pngPath).catch(() => {}) : Promise.resolve(),
    ]);
  }
}
