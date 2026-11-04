// Diploma digital con el nombre del ganador: el fondo de cada categoría y lugar está en diplomas/ (carta horizontal, sin nombre)
// y aquí se escribe el nombre sobre la línea "Se otorga a".
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {PDFDocument, rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const ANCHO = 792, ALTO = 612;
// Línea del nombre, medida en el diseño (puntos, desde la esquina inferior izquierda).
const LINEA = {x:266.4, y:ALTO - 380.7, ancho:478.8};
const carpeta = () => join(process.cwd(), 'diplomas');
let fuente;

export async function diplomaPDF(nombre, catId, lugar){
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  fuente ||= readFileSync(join(carpeta(), 'anton.ttf'));
  const anton = await doc.embedFont(fuente, {subset:true});
  const fondo = await doc.embedJpg(readFileSync(join(carpeta(), `${catId}-${lugar}.jpg`)));
  const page = doc.addPage([ANCHO, ALTO]);
  page.drawImage(fondo, {x:0, y:0, width:ANCHO, height:ALTO});
  const texto = String(nombre).toUpperCase();
  let size = 40;
  while (size > 16 && anton.widthOfTextAtSize(texto, size) > LINEA.ancho - 10) size--;
  const w = anton.widthOfTextAtSize(texto, size);
  page.drawText(texto, {x:LINEA.x + (LINEA.ancho - w) / 2, y:LINEA.y + 8, size, font:anton, color:rgb(0.05, 0.05, 0.06)});
  doc.setTitle(`Diploma · ${nombre}`);
  doc.setAuthor('Campeonato de Lucha de Brazos Mecánica 2026');
  return Buffer.from(await doc.save());
}
