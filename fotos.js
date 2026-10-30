// Fotos de los competidores: se achican en el navegador antes de enviarlas
// (240×240, recortada al centro) para que pesen poco y carguen rápido en las llaves.
import {esc} from './motor.js';

export function achicarFoto(file, lado = 240){
  return new Promise((ok, fail) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const cv = document.createElement('canvas');
      cv.width = cv.height = lado;
      cv.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, lado, lado);
      URL.revokeObjectURL(url);
      ok(cv.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('foto')); };
    img.src = url;
  });
}

// Cara del competidor (o sus iniciales si no tiene foto).
export function cara(c, cls = ''){
  const ini = esc(String(c?.name || '?').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase());
  const base = `<span class="face ${cls}" aria-hidden="true"><span>${ini}</span>`;
  return c?.foto ? `${base}<img src="/api/foto?id=${encodeURIComponent(c.id)}&v=${c.foto}" alt="" loading="lazy" onerror="this.remove()"></span>` : base + '</span>';
}
