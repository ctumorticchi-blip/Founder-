/**
 * RNG déterministe du moteur FOUNDER.
 *
 * Invariant central (spec P0 §3.2) : aucune source d'aléatoire hors de ce
 * module ne doit être utilisée dans le cœur de simulation. `Math.random` est
 * d'ailleurs interdit par la config ESLint du projet dans `src/**`.
 *
 * Un `Rng` est un générateur mulberry32 : algorithme simple, rapide, avec une
 * période suffisante pour un jeu de simulation, et surtout 100% reproductible
 * à partir d'une seed 32 bits.
 */

export interface WeightedItem<T> {
  readonly value: T;
  readonly weight: number;
}

export interface Rng {
  /** Flottant uniforme dans [0, 1). */
  next(): number;
  /** Entier uniforme dans [min, max] (bornes incluses). */
  nextInt(min: number, max: number): number;
  /** Flottant uniforme dans [min, max). */
  nextFloat(min: number, max: number): number;
  /** Tirage booléen ; `probabilityTrue` (défaut 0.5) est la proba de `true`. */
  nextBool(probabilityTrue?: number): boolean;
  /** Tirage gaussien (Box-Muller) de moyenne `mean` et écart-type `stdDev`. */
  nextGaussian(mean?: number, stdDev?: number): number;
  /** Choisit un élément uniformément dans un tableau non vide. */
  pick<T>(items: readonly T[]): T;
  /** Choisit un élément selon des poids relatifs (tous les poids doivent être > 0). */
  pickWeighted<T>(items: readonly WeightedItem<T>[]): T;
  /**
   * Dérive un nouveau RNG indépendant à partir de la seed d'origine de ce
   * RNG et d'un label. Déterministe et indépendant de l'état de
   * consommation courant : `rng.fork("x")` donne toujours le même flux,
   * peu importe combien de valeurs ont déjà été tirées sur `rng`.
   */
  fork(label: string): Rng;
}

/** Hash FNV-1a 32 bits, pur et déterministe. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Dérive une seed 32 bits déterministe à partir d'une seed de base et de
 * segments de contexte (ex. année, mois, nom d'étape). Fonction pure : mêmes
 * arguments -> même résultat, toujours.
 */
export function deriveSeed(baseSeed: number, ...parts: ReadonlyArray<string | number>): number {
  const key = [baseSeed, ...parts].join("|");
  return fnv1a(key);
}

class Mulberry32Rng implements Rng {
  private state: number;
  private readonly originalSeed: number;

  constructor(seed: number) {
    this.originalSeed = seed >>> 0;
    this.state = this.originalSeed;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new RangeError("nextInt: min et max doivent être des entiers.");
    }
    if (min > max) {
      throw new RangeError(`nextInt: min (${min}) > max (${max}).`);
    }
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    if (min > max) {
      throw new RangeError(`nextFloat: min (${min}) > max (${max}).`);
    }
    return this.next() * (max - min) + min;
  }

  nextBool(probabilityTrue = 0.5): boolean {
    return this.next() < probabilityTrue;
  }

  nextGaussian(mean = 0, stdDev = 1): number {
    const u1 = Math.max(this.next(), Number.EPSILON);
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + stdDev * z0;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError("pick: le tableau ne peut pas être vide.");
    }
    const index = this.nextInt(0, items.length - 1);
    return items[index] as T;
  }

  pickWeighted<T>(items: readonly WeightedItem<T>[]): T {
    if (items.length === 0) {
      throw new RangeError("pickWeighted: le tableau ne peut pas être vide.");
    }
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) {
      throw new RangeError("pickWeighted: la somme des poids doit être > 0.");
    }
    let threshold = this.nextFloat(0, totalWeight);
    for (const item of items) {
      threshold -= item.weight;
      if (threshold <= 0) {
        return item.value;
      }
    }
    // Filet de sécurité en cas d'imprécision flottante : dernier élément.
    return items[items.length - 1]!.value;
  }

  fork(label: string): Rng {
    return createRng(deriveSeed(this.originalSeed, label));
  }
}

/** Crée un RNG déterministe à partir d'une seed 32 bits. */
export function createRng(seed: number): Rng {
  return new Mulberry32Rng(seed);
}
