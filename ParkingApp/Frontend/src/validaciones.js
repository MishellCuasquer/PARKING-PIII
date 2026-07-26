/**
 * Patrones de validación compartidos por los formularios.
 *
 * Son un espejo de los que aplica el backend; están aquí solo para avisar al
 * usuario antes de enviar el formulario. La validación que manda es siempre la
 * del servidor: el navegador se puede saltar.
 */

/**
 * Nombres, apellidos y nacionalidad.
 *
 * Espejo de UserCreateRequest.PATRON_NOMBRE (ms-usuarios): letras con tilde y
 * ñ, y espacio / apóstrofo / guion como separadores internos —nunca al
 * principio ni al final—. Sin los espacios no se podían escribir dos
 * apellidos, que es el caso normal.
 */
export const PATRON_NOMBRE = "[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+([ '\\-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*";

export const TITULO_NOMBRE =
  'Solo letras, espacios, apóstrofo y guion. Ej: Cuasquer Chisaguano';

export const TITULO_NACIONALIDAD = 'La nacionalidad es un texto, no admite números';
