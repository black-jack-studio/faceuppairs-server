// Ported as-is from faceup-server/shared/usernameFilter.ts (App Store Guideline 1.2:
// user-generated content must be filtered). Keep both lists in sync with FaceUp's.
// Usernames are [a-zA-Z0-9_] only, so this normalizes leetspeak and repeated letters, then:
//  - SUBSTRING_TERMS match anywhere (long/unambiguous words, safe inside other words);
//  - TOKEN_TERMS only match a whole "_"-separated part, because as substrings they'd hit
//    innocent names ("ass" in "classic", "pute" in "computer", "cock" in "peacock").

const SUBSTRING_TERMS = [
  // English
  "fuck", "motherf", "shit", "bitch", "cunt", "whore", "nigger", "nigga", "faggot", "retarded",
  "pedophile", "paedophile", "rapist", "hitler", "pussy", "porn", "penis", "vagina", "dildo",
  "blowjob", "handjob", "cumshot", "slut", "twat", "wanker", "asshole", "bastard", "jizz",
  "nazi", "kkk", "heilhitler", "siegheil",
  // French
  "putain", "salope", "connard", "connasse", "encule", "enculer", "batard", "couille", "pedophil",
  "bougnoule", "youpin", "branleur", "branlette", "suceur", "sucemoi", "filsdepute", "niquetamere",
  "niquetonpere", "tamerelapute", "grossepute", "sallepute", "negre", "bamboula", "chintok",
];

const TOKEN_TERMS = [
  "ass", "cock", "dick", "retard", "cum", "fag", "tits", "boobs", "sex", "anal", "rape", "pedo", "nig",
  "pute", "pd", "fdp", "ntm", "tg", "bite", "chatte", "tapette", "merde", "con", "conne",
  "nique", "niquer", "zizi", "negro", "pedale", "gouine",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s" };

function deleet(s: string): string {
  return s.toLowerCase().replace(/[0134578@$]/g, (c) => LEET[c]);
}

// "fuuuck" -> "fuck". Compared collapsed-to-collapsed so double-letter terms ("connard") still
// match, but only for terms that stay 4+ letters once collapsed ("kkk" -> "k" would hit everything).
function collapseRepeats(s: string): string {
  return s.replace(/(.)\1+/g, "$1");
}

const COLLAPSED_SUBSTRINGS = SUBSTRING_TERMS.map(collapseRepeats).filter((t) => t.length >= 4);
const TOKENS = new Set(TOKEN_TERMS);

function tokenMatches(token: string): boolean {
  return TOKENS.has(token) || TOKENS.has(collapseRepeats(token));
}

export function isOffensiveUsername(username: string): boolean {
  const joined = deleet(username.replace(/_/g, ""));
  if (SUBSTRING_TERMS.some((term) => joined.includes(term))) return true;
  const collapsed = collapseRepeats(joined);
  if (COLLAPSED_SUBSTRINGS.some((term) => collapsed.includes(term))) return true;

  // "_" parts are de-leeted ("d1ck"); digit-split parts aren't, so "pd42" still yields "pd".
  const tokens = [
    ...username.split("_").map(deleet),
    ...username.toLowerCase().split(/[_0-9]+/),
    joined,
  ].filter(Boolean);
  return tokens.some(tokenMatches);
}

// Names that would let a player pass as staff, the app or a platform on a public leaderboard.
// Compared on the de-leeted, underscore-free form.
// Unambiguous words are blocked as prefixes ("Admin_42", "SupportFR").
const RESERVED_PREFIXES = [
  "admin", "moderator", "moderateur", "support", "staff", "official", "officiel",
  "faceup", "appstore", "playstore",
];
// Short or common words only when they are the whole name, optionally followed by digits:
// as prefixes they would block real names ("dev" -> "devon", "aide" -> "aiden").
// "joueur"/"player" are reserved because moderated names are renamed to "Joueur1234".
const RESERVED_EXACT = [
  "modo", "apple", "google", "system", "systeme", "root", "owner", "developer", "dev",
  "team", "equipe", "help", "aide", "joueur", "player", "anonymous", "anonyme",
];
const RESERVED_EXACT_PATTERN = new RegExp(`^(${RESERVED_EXACT.join("|")})\\d*$`);

export function isReservedUsername(username: string): boolean {
  const normalized = deleet(username.replace(/_/g, ""));
  return (
    RESERVED_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ||
    RESERVED_EXACT_PATTERN.test(normalized) ||
    // Digits were de-leeted above ("dev42" -> "devae"), so also test the raw lowercase form.
    RESERVED_EXACT_PATTERN.test(username.replace(/_/g, "").toLowerCase())
  );
}

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export type UsernameError = "required" | "length" | "invalidChars" | "notAllowed" | "reserved";

/** Same order of checks as FaceUp's ChangeUsernameModal, so the first failing rule is reported. */
export function validateUsername(raw: string): UsernameError | null {
  const username = raw.trim();
  if (!username) return "required";
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) return "length";
  if (!USERNAME_PATTERN.test(username)) return "invalidChars";
  if (isOffensiveUsername(username)) return "notAllowed";
  if (isReservedUsername(username)) return "reserved";
  return null;
}
