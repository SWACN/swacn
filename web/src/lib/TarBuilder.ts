export class TarBuilder {
  private buffers: Uint8Array[] = [];

  private createHeader(name: string, size: number, mode: string = '0644', mtime: number = Math.floor(Date.now() / 1000), typeflag: string = '0'): Uint8Array {
    const header = new Uint8Array(512);
    let offset = 0;

    const writeString = (str: string, length: number) => {
      for (let i = 0; i < str.length && i < length; i++) {
        header[offset + i] = str.charCodeAt(i);
      }
      offset += length;
    };

    const writeOctal = (num: number, length: number) => {
      const str = num.toString(8).padStart(length - 1, '0') + ' ';
      writeString(str, length);
    };

    writeString(name, 100);       // name
    writeString(mode, 8);         // mode
    writeOctal(0, 8);             // uid
    writeOctal(0, 8);             // gid
    writeOctal(size, 12);         // size
    writeOctal(mtime, 12);        // mtime
    
    const chksumOffset = offset;
    writeString('        ', 8);   // chksum
    
    writeString(typeflag, 1);     // typeflag
    writeString('', 100);         // linkname
    writeString('ustar', 6);      // magic
    writeString('00', 2);         // version
    writeString('', 32);          // uname
    writeString('', 32);          // gname
    writeOctal(0, 8);             // devmajor
    writeOctal(0, 8);             // devminor
    writeString('', 155);         // prefix

    // Calculate checksum
    let chksum = 0;
    for (let i = 0; i < 512; i++) {
      chksum += header[i];
    }

    // Write checksum
    const chksumStr = chksum.toString(8).padStart(6, '0');
    for (let i = 0; i < 6; i++) header[chksumOffset + i] = chksumStr.charCodeAt(i);
    header[chksumOffset + 6] = 0;
    header[chksumOffset + 7] = 32;

    return header;
  }

  public addFile(name: string, content: Uint8Array) {
    const header = this.createHeader(name, content.length);
    this.buffers.push(header);
    this.buffers.push(content);
    
    const paddingLength = (512 - (content.length % 512)) % 512;
    if (paddingLength > 0) {
      this.buffers.push(new Uint8Array(paddingLength));
    }
  }

  public addDirectory(name: string) {
    if (!name.endsWith('/')) name += '/';
    const header = this.createHeader(name, 0, '0755', Math.floor(Date.now() / 1000), '5');
    this.buffers.push(header);
  }

  public build(): Blob {
    this.buffers.push(new Uint8Array(1024));
    return new Blob(this.buffers as any, { type: 'application/x-tar' });
  }
}
