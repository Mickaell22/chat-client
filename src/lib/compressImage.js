// Compresion de imagenes en el navegador antes de subirlas: se reescala con
// canvas al lado maximo y se exporta a JPEG. Una foto de celular de 8-10 MB
// queda en unos cientos de KB, asi la subida es rapida y el chat no pesa.
// ponytail: siempre JPEG (un PNG con transparencia pierde el alfa y un GIF
// animado queda en un solo frame); techo aceptado, upgrade: respetar el tipo
// original cuando convenga.

export const MAX_IMAGE_SIDE = 1600;
export const JPEG_QUALITY = 0.8;

export async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) throw new Error('No se pudo procesar la imagen.');
  return new File([blob], 'imagen.jpg', { type: 'image/jpeg' });
}
