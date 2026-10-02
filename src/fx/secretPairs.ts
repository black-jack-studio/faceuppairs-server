import type { Fx } from "./store";

// Each pack hides one pair that sets off its own little show when it's found.
const SECRET_PAIRS: Record<string, { slot: number; fx: Fx }> = {
  party: { slot: 4, fx: { kind: "fountain", sprites: ["party_popper", "bubble_tea", "sparkles"] } },
  animals: { slot: 20, fx: { kind: "flyby", sprite: "unicorn", trail: "sparkles" } },
  food: { slot: 16, fx: { kind: "fountain", sprites: ["birthday_cake", "partying_face", "sparkles"] } },
  space: { slot: 20, fx: { kind: "flyby", sprite: "flying_saucer", trail: "star" } },
  nature: { slot: 20, fx: { kind: "rain", sprites: ["cherry_blossom", "blossom", "four_leaf_clover"] } },
  travel: { slot: 12, fx: { kind: "flyby", sprite: "airplane", trail: "dizzy" } },
  sports: { slot: 21, fx: { kind: "rain", sprites: ["1st_place_medal", "2nd_place_medal", "3rd_place_medal", "trophy"] } },
  faces: { slot: 22, fx: { kind: "fountain", sprites: ["partying_face", "grinning_squinting_face", "sparkles"] } },
};

/** The effect for a pair just found, if it is the equipped pack's secret pair. */
export function secretPairFx(packId: string, slot: string): Fx | null {
  const secret = SECRET_PAIRS[packId];
  return secret && Number(slot) === secret.slot ? secret.fx : null;
}
