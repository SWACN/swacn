export interface TarFile {
  name: string;
  data: Uint8Array;
}

export class TarReader {
  public static extractFiles(buffer: Uint8Array): TarFile[] {
    const files: TarFile[] = [];
    let offset = 0;

    while (offset < buffer.length - 512) {
      // Check for end of archive (two null blocks)
      if (buffer[offset] === 0 && buffer[offset + 1] === 0) {
        break;
      }

      // Read filename (100 bytes)
      let name = '';
      for (let i = 0; i < 100; i++) {
        if (buffer[offset + i] === 0) break;
        name += String.fromCharCode(buffer[offset + i]);
      }

      // Read size (12 bytes at offset 124, octal)
      let sizeStr = '';
      for (let i = 0; i < 12; i++) {
        const char = String.fromCharCode(buffer[offset + 124 + i]);
        if (char === ' ' || char === '\0') continue;
        sizeStr += char;
      }
      const size = parseInt(sizeStr, 8);

      // Read typeflag (1 byte at offset 156)
      const typeflag = String.fromCharCode(buffer[offset + 156]);

      offset += 512;

      if (typeflag === '0' || typeflag === '\0') {
        // Regular file
        if (size > 0) {
          const data = buffer.slice(offset, offset + size);
          files.push({ name, data });
        } else {
          files.push({ name, data: new Uint8Array(0) });
        }
      }

      // Move to next block (aligned to 512)
      offset += Math.ceil(size / 512) * 512;
    }

    return files;
  }
}
