const zlib = require("zlib");

// Lector ZIP minimo y sin dependencias: extrae una entrada por nombre.
// Recorre el Directorio Central (EOCD) para obtener metodo, tamano y offset,
// y luego lee el Local File Header para localizar el inicio real de los datos.

function findEOCD(buf) {
  // EOCD signature 0x06054b50, buscada desde el final (comentario <= 65535)
  const min = Math.max(0, buf.length - (22 + 65535));
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

// Devuelve el buffer descomprimido de una entrada, o null si no existe.
function readEntry(buf, wantedName) {
  const eocd = findEOCD(buf);
  if (eocd < 0) throw new Error("ZIP invalido (no se encontro EOCD).");

  const cdCount = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < cdCount; n++) {
    if (buf.readUInt32LE(cdOffset) !== 0x02014b50) break; // central dir header
    const method = buf.readUInt16LE(cdOffset + 10);
    const compSize = buf.readUInt32LE(cdOffset + 20);
    const nameLen = buf.readUInt16LE(cdOffset + 28);
    const extraLen = buf.readUInt16LE(cdOffset + 30);
    const commentLen = buf.readUInt16LE(cdOffset + 32);
    const localOffset = buf.readUInt32LE(cdOffset + 42);
    const name = buf.toString(
      "utf-8",
      cdOffset + 46,
      cdOffset + 46 + nameLen
    );

    if (name === wantedName) {
      // Local File Header: los tamanos de nombre/extra pueden diferir del central
      if (buf.readUInt32LE(localOffset) !== 0x04034b50)
        throw new Error("Local header invalido.");
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(dataStart, dataStart + compSize);
      if (method === 0) return Buffer.from(data); // stored
      if (method === 8) return zlib.inflateRawSync(data); // deflate
      throw new Error("Metodo de compresion no soportado: " + method);
    }

    cdOffset += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

module.exports = { readEntry };
