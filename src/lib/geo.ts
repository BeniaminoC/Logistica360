/** Distancia en línea recta (km) entre dos coordenadas. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Distancia estimada por carretera: la línea recta suele quedarse corta ~30 %. */
export function distanciaCarreteraKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.max(5, Math.round(haversineKm(lat1, lng1, lat2, lng2) * 1.3));
}

/** Avanza `km` desde A hacia B en línea recta. Devuelve la nueva posición y si llegó. */
export function avanzar(
  lat: number, lng: number, destLat: number, destLng: number, km: number
): { lat: number; lng: number; llego: boolean; restanteKm: number } {
  const resto = haversineKm(lat, lng, destLat, destLng);
  if (resto <= km || resto < 0.3) return { lat: destLat, lng: destLng, llego: true, restanteKm: 0 };
  const f = km / resto;
  return { lat: lat + (destLat - lat) * f, lng: lng + (destLng - lng) * f, llego: false, restanteKm: resto - km };
}
