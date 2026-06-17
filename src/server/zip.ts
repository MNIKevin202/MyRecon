// Minimal ZIP encoder (store method — no compression).
//
// We only bundle small text .cs files, so compression isn't worth a new
// dependency. Produces a standard .zip that Windows Explorer, macOS, and
// 7-Zip all open natively.

type ZipFile = { name: string; data: Buffer };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// DOS date/time for a fixed, deterministic timestamp (2026-01-01 00:00)
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

export function createZip(files: ZipFile[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const crc = crc32(file.data);
    const size = file.data.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
    localHeader.writeUInt16LE(20, 4);          // version needed
    localHeader.writeUInt16LE(0, 6);           // flags
    localHeader.writeUInt16LE(0, 8);           // compression (store)
    localHeader.writeUInt16LE(DOS_TIME, 10);
    localHeader.writeUInt16LE(DOS_DATE, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18);       // compressed size
    localHeader.writeUInt32LE(size, 22);       // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);          // extra length

    localParts.push(localHeader, nameBuf, file.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // central dir header signature
    centralHeader.writeUInt16LE(20, 4);          // version made by
    centralHeader.writeUInt16LE(20, 6);          // version needed
    centralHeader.writeUInt16LE(0, 8);           // flags
    centralHeader.writeUInt16LE(0, 10);          // compression
    centralHeader.writeUInt16LE(DOS_TIME, 12);
    centralHeader.writeUInt16LE(DOS_DATE, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);          // extra length
    centralHeader.writeUInt16LE(0, 32);          // comment length
    centralHeader.writeUInt16LE(0, 34);          // disk number start
    centralHeader.writeUInt16LE(0, 36);          // internal attrs
    centralHeader.writeUInt32LE(0, 38);          // external attrs
    centralHeader.writeUInt32LE(offset, 42);     // local header offset

    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + file.data.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central dir signature
  end.writeUInt16LE(0, 4);          // disk number
  end.writeUInt16LE(0, 6);          // disk with central dir
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(localData.length, 16); // central dir offset
  end.writeUInt16LE(0, 20);                // comment length

  return Buffer.concat([localData, centralDir, end]);
}
