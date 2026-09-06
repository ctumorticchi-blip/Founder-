/**
 * Génère une seed 32 bits pour une nouvelle partie. Utilise l'API Web
 * Crypto (jamais `Math.random`) : ce n'est pas une exigence du moteur
 * (qui n'est pas exécuté ici), simplement une bonne pratique côté UI.
 */
export function generateSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0]!;
}
