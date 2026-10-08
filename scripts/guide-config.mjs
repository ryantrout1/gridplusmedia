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
