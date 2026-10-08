// Shared by scripts/build-guides.mjs and the tests. Plain words only: no em or en dashes in anything here.
//
// A guide picks its topic with one line of front matter:  topic: reviews
// and says how long it takes with:                        minutes: 20   (a whole number, about how long to read and do it)
// A guide with no topic, or a topic that is not listed here, appears under "More guides" until someone sets it.
// To add a topic, add one entry below. Sections show in this order, and a topic with no guides is not shown.
export const TOPICS = [
  { id: "google-profile", label: "Your Google profile", blurb: "Claim it, fill it in and keep it right." },
  { id: "found", label: "Getting found nearby", blurb: "What helps people near you find you on Google." },
  { id: "reviews", label: "Reviews", blurb: "Ask for them, answer them and make it a habit." },
  { id: "posting", label: "Posting and content", blurb: "What to post, how often, and how to keep it going." },
  { id: "measure", label: "Plan and check your results", blurb: "A simple plan, and a quick way to see what is working." },
  { id: "industry", label: "For your type of business", blurb: "Plans for restaurants, salons and home service pros." },
  { id: "hiring", label: "Before you spend money", blurb: "What things cost, and what to ask before you pay anyone." },
];

// "About 20 minutes", "About an hour", "About 2 and a half hours".
export function timeLabel(minutes) {
  if (minutes === 60) return "About an hour";
  if (minutes < 120) return `About ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.round(minutes / 30) / 2;
  return Number.isInteger(hours) ? `About ${hours} hours` : `About ${Math.floor(hours)} and a half hours`;
}

// "6 steps, about 3 hours". With no total (some step has no minutes) it is just "6 steps".
export function pathLabel(steps, minutes) {
  const n = `${steps} ${steps === 1 ? "step" : "steps"}`;
  return minutes ? `${n}, ${timeLabel(minutes).replace(/^About/, "about")}` : n;
}

// Learning paths: a few guides in a set order, with a page of their own at /guides/paths/<id>/.
// "steps" are guide slugs (the file name in content/guides, without .md), in the order to do them.
// A guide can be in one path only. The time shown for a path is the sum of its guides' minutes, so every step needs minutes.
// A new guide does not have to be in a path. To add it to one, put its slug in the list. To add a path, add an entry here.
// A slug that has no guide, or a guide already in an earlier path, is left out and named in the build log.
export const PATHS = [
  {
    id: "get-found",
    title: "Get found on Google",
    blurb: "Claim your listing, fill it in, add photos and check how it shows up.",
    steps: [
      "claim-and-verify-your-google-business-profile",
      "choose-your-google-categories-services-and-service-area",
      "write-your-google-business-description",
      "photos-that-get-you-found-on-google",
      "make-your-name-address-and-phone-match",
      "check-how-your-business-shows-up-on-google-and-fix-it",
    ],
  },
  {
    id: "review-habit",
    title: "Build a review habit",
    blurb: "Ask for reviews, get more of them and answer every one.",
    steps: [
      "get-more-google-reviews",
      "ask-for-reviews-without-feeling-awkward",
      "how-to-answer-a-google-review",
    ],
  },
  {
    id: "posting-habit",
    title: "Start a posting habit you can keep",
    blurb: "Pick a pace you can hold, know what to post and plan your first 90 days.",
    steps: [
      "social-media-posting-frequency",
      "what-to-post-when-you-have-nothing-to-say",
      "what-to-post-on-your-google-profile",
      "90-day-posting-plan-you-can-copy",
    ],
  },
  {
    id: "before-you-hire",
    title: "Before you hire anyone",
    blurb: "Know what marketing costs and what to ask before you pay.",
    steps: [
      "what-marketing-really-costs",
      "what-an-seo-audit-is-and-what-to-ask-before-you-pay",
      "local-seo-in-plain-words",
    ],
  },
];
