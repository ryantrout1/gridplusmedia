// The filter behind the search box and chips on /guides/. Plain functions only, so node can test them (tests/guides-filter.test.js).
// guides.js reads the cards off the page, calls these, and shows or hides what comes back.
//
// A card is { title, description, topic, topicLabel, keywords, minutes }. The state is { q, topic, time }:
//   q      what was typed. Every word has to match the start of a word in the title, description, topic name or keywords.
//   topic  a topic id, "more" for guides with no topic yet, or "all".
//   time   "any", or a number of minutes. A chip means "up to": a 60 chip shows guides of 60 minutes or less.
//          A guide with no minutes is hidden while a time chip is on, because we cannot say how long it takes.

// Lowercase, no accents, no apostrophes, everything else that is not a letter or digit becomes one space.
export function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const words = (text) => normalize(text).split(" ").filter(Boolean);

// A typed word matches a word that starts with it. A plural also matches the word it came from ("postcards" finds "postcard").
const found = (tokens, word) => {
  const single = word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : null;
  return tokens.some((t) => t.startsWith(word) || (single !== null && t.startsWith(single)));
};

export function matches(card, state = {}) {
  const { q = "", topic = "all", time = "any" } = state;
  if (topic !== "all" && card.topic !== topic) return false;
  if (time !== "any" && !(card.minutes > 0 && card.minutes <= time)) return false;
  const typed = words(q);
  if (!typed.length) return true;
  const tokens = words([card.title, card.description, card.topicLabel, card.keywords].join(" "));
  return typed.every((w) => found(tokens, w));
}

export const filterCards = (cards, state) => cards.filter((c) => matches(c, state));

export const isFiltered = ({ q = "", topic = "all", time = "any" } = {}) => words(q).length > 0 || topic !== "all" || time !== "any";

export const countLabel = (n) => (n === 0 ? "No guides match" : n === 1 ? "1 guide" : `${n} guides`);
