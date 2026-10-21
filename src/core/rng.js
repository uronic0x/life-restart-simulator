/**
 * Deterministic PRNG (mulberry32) so a life can be reproduced from its seed.
 */
export function createRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    /** float in [min, max) */
    float: (min, max) => min + next() * (max - min),
    /** integer in [min, max] inclusive */
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle(arr) {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    /** Pick from [{weight}] objects; weight may be 0 to exclude. */
    weighted(items, weightOf = (i) => i.weight ?? 1) {
      const pool = items.filter((i) => weightOf(i) > 0);
      if (!pool.length) return null;
      let total = 0;
      for (const i of pool) total += weightOf(i);
      let r = next() * total;
      for (const i of pool) {
        r -= weightOf(i);
        if (r <= 0) return i;
      }
      return pool[pool.length - 1];
    },
  };
}

export function randomSeed() {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}
