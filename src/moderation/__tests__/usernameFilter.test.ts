import { isOffensiveUsername, isReservedUsername, validateUsername } from "../usernameFilter";

describe("isOffensiveUsername", () => {
  it.each(["fuck", "FuUuCk_you", "sh1t", "putain", "Connard42", "fdp", "d1ck", "pd42", "pute_du_91"])(
    "blocks %s",
    (name) => expect(isOffensiveUsername(name)).toBe(true),
  );

  it.each(["classic", "computer", "peacock", "Stan", "cocktail_king", "Assassin", "Constance"])(
    "allows %s",
    (name) => expect(isOffensiveUsername(name)).toBe(false),
  );
});

describe("isReservedUsername", () => {
  it.each(["admin", "Admin_42", "SupportFR", "FaceUp", "dev", "dev42", "Joueur1234", "apple"])(
    "reserves %s",
    (name) => expect(isReservedUsername(name)).toBe(true),
  );

  it.each(["devon", "Aiden", "teamrocket_fan", "helpful", "pineapple", "googly"])("allows %s", (name) =>
    expect(isReservedUsername(name)).toBe(false),
  );
});

describe("validateUsername", () => {
  it("reports the first failing rule", () => {
    expect(validateUsername("   ")).toBe("required");
    expect(validateUsername("ab")).toBe("length");
    expect(validateUsername("a".repeat(21))).toBe("length");
    expect(validateUsername("héllo")).toBe("invalidChars");
    expect(validateUsername("with space")).toBe("invalidChars");
    expect(validateUsername("salope")).toBe("notAllowed");
    expect(validateUsername("moderator")).toBe("reserved");
    expect(validateUsername("Stan_75")).toBeNull();
  });
});
