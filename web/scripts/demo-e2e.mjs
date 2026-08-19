/**
 * Drives the full hackathon demo journey against the running dev server, exactly as the
 * browser would: a citizen signs in with a device key, institutions verify things, and every
 * anti-abuse rule is probed.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// Read from the environment so a deployment that changed its sign-in codes -- which any public
// one must -- is still testable without editing this file. The fallbacks are the codes a fresh
// clone ships with.
const OPERATOR_PIN = process.env.OPERATOR_PIN ?? "1234";
const ADMIN_PIN = process.env.ADMIN_PIN ?? "cityquest";
const WRONG_PIN = "0000";

const LIBRARY_SLUG = "melikgazi-library";
const SCIENCE_SLUG = "kayseri-science-center";

const BASE = "http://localhost:3000";

// Cookie jars, one per actor, mirroring separate browsers.
const jars = {
  citizen: new Map(),
  library: new Map(),
  science: new Map(),
  admin: new Map(),
  business: new Map(),
};

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function absorb(jar, response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const index = pair.indexOf("=");
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (value === "") jar.delete(name);
    else jar.set(name, value);
  }
}

async function call(actor, path, { method = "POST", body } = {}) {
  const jar = jars[actor];
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      // Pin the language: the app answers in the reader's language, and these assertions
      // compare against English strings.
      Cookie: [cookieHeader(jar), "cq_locale=en"].filter(Boolean).join("; "),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  absorb(jar, response);
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

let failures = 0;
function check(label, condition, detail = "") {
  const mark = condition ? "  ok  " : " FAIL ";
  if (!condition) failures += 1;
  console.log(`[${mark}] ${label}${detail ? ` — ${detail}` : ""}`);
}

const steps = [];
function step(n, text) {
  console.log(`\n── STEP ${n}: ${text}`);
  steps.push(n);
}

const key = generatePrivateKey();
const account = privateKeyToAccount(key);
console.log(`Citizen city account: ${account.address}`);

// ---------------------------------------------------------------------------- 1. sign in
step(1, "Citizen creates a city account and signs in");
{
  const { data: challenge } = await call("citizen", "/api/auth/nonce", {
    body: { address: account.address },
  });
  check("challenge issued", challenge.ok === true);

  const signature = await account.signMessage({ message: challenge.message });
  const { data } = await call("citizen", "/api/auth/session", {
    body: { address: account.address, nonce: challenge.nonce, signature },
  });
  check("signed in", data.ok === true, data.error);
  check("profile created with 0 XP", data.profile?.xp === 0);
}

// forged signature must be refused
{
  const { data: challenge } = await call("citizen", "/api/auth/nonce", {
    body: { address: account.address },
  });
  const impostor = privateKeyToAccount(generatePrivateKey());
  const badSignature = await impostor.signMessage({ message: challenge.message });
  const { data } = await call("citizen", "/api/auth/session", {
    body: { address: account.address, nonce: challenge.nonce, signature: badSignature },
  });
  check("signature from another key is refused", data.ok === false, data.error);
}

// ------------------------------------------------------------------- 2. operator sign-in
step(2, "Library staff sign in to the console");
{
  const { data: refused } = await call("library", "/api/institution/session", {
    body: { institutionSlug: LIBRARY_SLUG, pin: WRONG_PIN },
  });
  check("wrong staff code refused", refused.ok === false, refused.error);

  const { data } = await call("library", "/api/institution/session", {
    body: { institutionSlug: LIBRARY_SLUG, pin: OPERATOR_PIN },
  });
  check("correct staff code accepted", data.ok === true, data.error);
}

// unauthenticated check-in must be refused
{
  const { data } = await call("science", "/api/checkin", {
    body: { wallet: account.address, activitySlug: "library-daily-visit" },
  });
  check("check-in without staff sign-in refused", data.ok === false, data.error);
}

// ------------------------------------------------------------------------ 3. library visit
step(3, "Library confirms the visit");
let firstTx;
{
  const { data } = await call("library", "/api/checkin", {
    body: { wallet: account.address, activitySlug: "library-daily-visit" },
  });
  check("visit verified", data.ok === true, data.error);
  check("Library Visitor awarded", data.credential?.title === "Library Visitor");
  check("+10 XP", data.xpAwarded === 10, `got ${data.xpAwarded}`);
  check("issued by the library", data.issuer === "Melikgazi Library");
  check("has a transaction hash", typeof data.txHash === "string");
  firstTx = data.txHash;
}

// ------------------------------------------------------------- 4. same-day replay refused
step(4, "Second attempt the same day");
{
  const { data } = await call("library", "/api/checkin", {
    body: { wallet: account.address, activitySlug: "library-daily-visit" },
  });
  check("refused", data.ok === false, data.error);
  check("no second transaction was sent", data.txHash === undefined);
}

// ----------------------------------------------------------------------- 5. buy a ticket
step(5, "Citizen buys an Earthquake Experience ticket");
let passId;
{
  const { data } = await call("citizen", "/api/tickets/purchase", {
    body: { activitySlug: "earthquake-simulation" },
  });
  check("ticket issued", data.ok === true, data.error);
  check("costs 50 TL", data.ticket?.priceTry === 50);
  passId = data.ticket?.passId;
  check("has a ticket number", Boolean(passId), `#${passId}`);

  const { data: again } = await call("citizen", "/api/tickets/purchase", {
    body: { activitySlug: "earthquake-simulation" },
  });
  check("cannot buy a second unused ticket", again.ok === false, again.error);
}

// ------------------------------------------------------------------- 6. consume a ticket
step(6, "Science center scans the ticket");
{
  await call("science", "/api/institution/session", {
    body: { institutionSlug: SCIENCE_SLUG, pin: OPERATOR_PIN },
  });

  // The library must not be able to spend the science center's ticket.
  const { data: wrongVenue } = await call("library", "/api/tickets/consume", { body: { passId } });
  check("another venue cannot use this ticket", wrongVenue.ok === false, wrongVenue.error);

  // Nor may one institution issue another's achievements. The contract cannot catch this on its
  // own -- the app holds every institution's key, so signing with the wrong one still produces a
  // claim the registry accepts. The refusal has to happen here.
  const outsider = privateKeyToAccount(generatePrivateKey());
  const { data: wrongIssuer } = await call("science", "/api/checkin", {
    body: { wallet: outsider.address, activitySlug: "library-daily-visit" },
  });
  check(
    "the science center cannot issue a library achievement",
    wrongIssuer.ok === false && wrongIssuer.code === "WrongInstitution",
    wrongIssuer.error,
  );

  const { data } = await call("science", "/api/tickets/consume", { body: { passId } });
  check("ticket accepted", data.ok === true, data.error);
  check("Earthquake Experience awarded", data.credential?.title === "Earthquake Experience");
  check("+30 XP", data.xpAwarded === 30, `got ${data.xpAwarded}`);

  const { data: reuse } = await call("science", "/api/tickets/consume", { body: { passId } });
  check("the same ticket cannot be used twice", reuse.ok === false, reuse.error);
}

// ------------------------------------------------------------------------------ 7. quiz
step(7, "Citizen takes the science quiz");
{
  const { data: wrong } = await call("citizen", "/api/quiz/submit", {
    body: { activitySlug: "science-quiz", answers: [0, 0, 0, 0] },
  });
  check("failing score earns nothing", wrong.ok === true && wrong.passed === false, wrong.error);
  check("no XP for a failed quiz", wrong.xpAwarded === 0);

  const { data } = await call("citizen", "/api/quiz/submit", {
    body: { activitySlug: "science-quiz", answers: [1, 1, 3, 1] },
  });
  check("passing score accepted", data.ok === true && data.passed === true, data.error);
  check("+20 XP", data.xpAwarded === 20, `got ${data.xpAwarded}`);
}

// ----------------------------------------------------------------------------- 8. quest
step(8, "Municipality issues Young Scientist");
{
  const { data } = await call("citizen", "/api/quests/claim", { body: { questSlug: "science-quest" } });
  check("quest reward issued", data.ok === true, data.error);
  check("Young Scientist awarded", data.credential?.title === "Young Scientist");
  check("issued by the municipality", data.issuer === "Kayseri Municipality");
  check("+150 XP", data.xpAwarded === 150, `got ${data.xpAwarded}`);
  check("total XP is 210", data.totalXp === 210, `got ${data.totalXp}`);

  const { data: again } = await call("citizen", "/api/quests/claim", {
    body: { questSlug: "science-quest" },
  });
  check("cannot claim the quest twice", again.ok === false, again.error);
}

// ---------------------------------------------------------------------------- 9. reward
step(9, "Sponsor reward");
{
  const { data } = await call("citizen", "/api/rewards/claim", { body: { rewardSlug: "free-coffee" } });
  check("coupon issued", data.ok === true, data.error);
  check("coupon code looks right", /^CQ-[0-9A-F]{6}-[0-9A-F]{4}$/.test(data.couponCode ?? ""), data.couponCode);

  const { data: again } = await call("citizen", "/api/rewards/claim", {
    body: { rewardSlug: "free-coffee" },
  });
  check("claiming again returns the same coupon", again.couponCode === data.couponCode);
}

// ------------------------------------------------------- 10. ineligible citizen refused
step(10, "A citizen without the achievement cannot claim the reward");
{
  const stranger = privateKeyToAccount(generatePrivateKey());
  jars.stranger = new Map();
  const { data: challenge } = await call("stranger", "/api/auth/nonce", {
    body: { address: stranger.address },
  });
  const signature = await stranger.signMessage({ message: challenge.message });
  await call("stranger", "/api/auth/session", {
    body: { address: stranger.address, nonce: challenge.nonce, signature },
  });

  const { data } = await call("stranger", "/api/rewards/claim", { body: { rewardSlug: "free-coffee" } });
  check("refused for someone without the credential", data.ok === false, data.error);

  const { data: quest } = await call("stranger", "/api/quests/claim", {
    body: { questSlug: "science-quest" },
  });
  check("quest refused with unmet requirements", quest.ok === false, quest.error);
}

// -------------------------------------------------------------------- 11. admin console
step(11, "Municipality suspends an institution");
{
  await call("admin", "/api/admin/session", { body: { pin: ADMIN_PIN } });

  const museum = privateKeyToAccount(generatePrivateKey());
  const { data: created } = await call("admin", "/api/admin/institutions", {
    body: { address: museum.address, name: "Kayseri City Museum", kind: "Museum" },
  });
  check("new institution registered", created.ok === true, created.error);

  const { data: suspended } = await call("admin", "/api/admin/institutions", {
    method: "PATCH",
    body: { address: museum.address, active: false },
  });
  check("institution suspended", suspended.ok === true, suspended.error);
}

// A suspended library cannot issue anything.
step(12, "A suspended institution cannot issue achievements");
{
  // Look the library up rather than hard-coding it: the address differs per deployment, and a
  // stale constant here silently turns this step into a no-op that still reports success.
  const { data: registry } = await call("admin", "/api/admin/institutions", { method: "GET" });
  const library = (registry.institutions ?? []).find((i) => /library/i.test(i.name));
  check("found the library in the registry", Boolean(library), library?.name);
  const librarySigner = library?.address;

  const { data: off } = await call("admin", "/api/admin/institutions", {
    method: "PATCH",
    body: { address: librarySigner, active: false },
  });
  check("library suspended", off.ok === true, off.error);

  const fresh = privateKeyToAccount(generatePrivateKey());
  jars.fresh = new Map();
  const { data: challenge } = await call("fresh", "/api/auth/nonce", { body: { address: fresh.address } });
  const signature = await fresh.signMessage({ message: challenge.message });
  await call("fresh", "/api/auth/session", {
    body: { address: fresh.address, nonce: challenge.nonce, signature },
  });

  const { data } = await call("library", "/api/checkin", {
    body: { wallet: fresh.address, activitySlug: "library-daily-visit" },
  });
  check("check-in refused while suspended", data.ok === false, data.error);

  // Restore, so the demo is left in a working state.
  const { data: on } = await call("admin", "/api/admin/institutions", {
    method: "PATCH",
    body: { address: librarySigner, active: true },
  });
  check("library reactivated", on.ok === true, on.error);
  const { data: restored } = await call("library", "/api/checkin", {
    body: { wallet: fresh.address, activitySlug: "library-daily-visit" },
  });
  check("works again after reactivation", restored.ok === true, restored.error);
}

// -------------------------------------------------------------------------------------------
// A business joins, and the municipality reprices a ticket. Neither touches the chain, which is
// the point: an institution's authority is a public fact, a cafe's offer is a commercial one.
// -------------------------------------------------------------------------------------------
step(13, "The municipality changes a ticket price");
{
  const { data: up } = await call("admin", "/api/admin/prices", {
    method: "PATCH",
    body: { activitySlug: "earthquake-simulation", priceTry: 75 },
  });
  check("price raised to 75 TL", up.ok === true && up.priceTry === 75, up.error);

  const { data: free } = await call("admin", "/api/admin/prices", {
    method: "PATCH",
    body: { activitySlug: "library-daily-visit", priceTry: 10 },
  });
  check("a free check-in cannot be priced", free.ok === false, free.error);

  const { data: back } = await call("admin", "/api/admin/prices", {
    method: "PATCH",
    body: { activitySlug: "earthquake-simulation", priceTry: null },
  });
  check("reset returns the catalogue price", back.ok === true && back.priceTry === 50, back.error);
}

step(14, "A business joins and publishes an offer");
let businessSlug = null;
{
  const name = `Demo Coffee ${Date.now().toString().slice(-6)}`;
  const { data: created } = await call("admin", "/api/admin/sponsors", {
    body: { name, icon: "coffee" },
  });
  check("business added", created.ok === true, created.ok ? created.sponsor.slug : created.error);
  if (!created.ok) throw new Error("cannot continue without a business");
  businessSlug = created.sponsor.slug;
  check("starts unapproved", created.sponsor.approved === false);

  const { status: wrong } = await call("business", "/api/sponsor/session", {
    body: { accessCode: "WRONGCOD" },
  });
  check("a wrong code is refused", wrong === 401);

  const { data: signedIn } = await call("business", "/api/sponsor/session", {
    body: { accessCode: created.sponsor.accessCode },
  });
  check("business signed in with its own code", signedIn.ok === true, signedIn.error);

  const { data: offer } = await call("business", "/api/sponsor/offers", {
    body: {
      title: "Free filter coffee",
      description: "Show this at the counter.",
      icon: "coffee",
      // The strong form: the cafe reads this off the registry itself.
      requirement: { kind: "credential", credential: "YOUNG_SCIENTIST" },
    },
  });
  check("offer published", offer.ok === true, offer.ok ? offer.offer.slug : offer.error);

  const { status: junk } = await call("business", "/api/sponsor/offers", {
    body: { title: "x", requirement: { kind: "credential", credential: "NOT_A_CREDENTIAL" } },
  });
  check("an offer pointing at nothing is refused", junk === 400);

  step(15, "An unapproved business is invisible, an approved one is not");
  const { data: hidden } = await call("citizen", "/api/rewards/claim", {
    body: { rewardSlug: offer.offer.slug },
  });
  check("its offer cannot be claimed yet", hidden.ok === false, hidden.error);

  const { data: approved } = await call("admin", "/api/admin/sponsors", {
    method: "PATCH",
    body: { slug: businessSlug, approved: true },
  });
  check("municipality approved the business", approved.ok === true, approved.error);

  // The citizen earned Young Scientist in step 8, so the coffee is theirs.
  const { data: claimed } = await call("citizen", "/api/rewards/claim", {
    body: { rewardSlug: offer.offer.slug },
  });
  check("coupon granted for the on-chain achievement", claimed.ok === true, claimed.couponCode);

  const { data: again } = await call("citizen", "/api/rewards/claim", {
    body: { rewardSlug: offer.offer.slug },
  });
  check(
    "claiming again returns the same coupon",
    again.ok === true && again.couponCode === claimed.couponCode,
  );

  // Withdrawing an offer hides it, but does not take back a coupon already promised.
  await call("business", "/api/sponsor/offers", {
    method: "PATCH",
    body: { slug: offer.offer.slug, active: false },
  });
  const { data: afterHide } = await call("citizen", "/api/rewards/claim", {
    body: { rewardSlug: offer.offer.slug },
  });
  check(
    "a granted coupon survives the offer being withdrawn",
    afterHide.ok === true && afterHide.couponCode === claimed.couponCode,
  );

  // Leave the demo city as it was found. The registry has no way to remove an institution -- a
  // suspended one stays visible on purpose -- but a test business should not accumulate in the
  // municipality's console every time this runs.
  const { data: withdrawn } = await call("admin", "/api/admin/sponsors", {
    method: "PATCH",
    body: { slug: businessSlug, approved: false },
  });
  check("test business left unapproved", withdrawn.ok === true, withdrawn.error);
}

console.log(`\n${"=".repeat(60)}`);
console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
console.log(`first library transaction: ${firstTx}`);
process.exit(failures === 0 ? 0 : 1);
