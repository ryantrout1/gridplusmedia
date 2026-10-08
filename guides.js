// Wires up the search box and chips on /guides/. The controls ship hidden in the page, and this script shows them,
// so a visitor without JavaScript sees the full list and no controls that do nothing. The matching is in guides-filter.js.
import { matches, countLabel, isFiltered } from "./guides-filter.js";

const finder = document.querySelector(".guide-finder");

if (finder) {
  const input = finder.querySelector(".finder-input");
  const status = finder.querySelector(".finder-status");
  const clear = finder.querySelector(".finder-clear");
  const timeChips = [...finder.querySelectorAll(".chip[data-time]")];
  const topicChips = [...finder.querySelectorAll(".chip[data-topic]")];
  const topicLabels = new Map(topicChips.map((c) => [c.dataset.topic, c.dataset.label || ""]));
  const start = document.querySelector(".start-here");
  const topics = document.querySelector(".topics");
  const sections = [...document.querySelectorAll(".topics .topic")];

  const cards = [...document.querySelectorAll(".guide-card")].map((el) => ({
    el,
    title: el.querySelector("h3")?.textContent ?? "",
    description: el.querySelector("p:not(.guide-meta)")?.textContent ?? "",
    topic: el.dataset.topic ?? "more",
    topicLabel: topicLabels.get(el.dataset.topic) ?? "",
    keywords: el.dataset.keywords ?? "",
    minutes: Number(el.dataset.minutes) || null,
  }));

  const state = { q: "", topic: "all", time: "any" };

  const update = () => {
    let shown = 0;
    for (const c of cards) {
      const ok = matches(c, state);
      c.el.hidden = !ok;
      if (ok) shown += 1;
    }
    for (const s of sections) s.hidden = !s.querySelector(".guide-card:not([hidden])");
    const filtered = isFiltered(state);
    if (start) start.hidden = filtered;
    clear.hidden = !filtered;
    if (topics) topics.hidden = shown === 0;
    status.textContent = shown === 0 ? `${countLabel(0)}. Try fewer words, or clear the filters.` : countLabel(shown);
    // On a phone the chips can push the message off the top of the screen, so bring it back into view.
    if (shown === 0 && finder.offsetParent !== null) status.scrollIntoView({ block: "nearest" });
  };

  // Chips work like radio buttons: one is on in each row, and picking another moves it.
  const pick = (chips, chip) => {
    for (const c of chips) c.setAttribute("aria-pressed", String(c === chip));
  };
  for (const chip of timeChips) {
    chip.addEventListener("click", () => {
      state.time = chip.dataset.time === "any" ? "any" : Number(chip.dataset.time);
      pick(timeChips, chip);
      update();
    });
  }
  for (const chip of topicChips) {
    chip.addEventListener("click", () => {
      state.topic = chip.dataset.topic;
      pick(topicChips, chip);
      update();
    });
  }
  input.addEventListener("input", () => {
    state.q = input.value;
    update();
  });
  clear.addEventListener("click", () => {
    Object.assign(state, { q: "", topic: "all", time: "any" });
    input.value = "";
    pick(timeChips, timeChips.find((c) => c.dataset.time === "any"));
    pick(topicChips, topicChips.find((c) => c.dataset.topic === "all"));
    update();
    input.focus();
  });

  update();
  finder.hidden = false;
}
