/*!
 * New Relic Browser — automatic PageActions for Microsoft Power Pages
 *
 * Prerequisite: the New Relic Browser agent is ALREADY installed on the site
 * (its loader snippet lives in the header or footer web template). This script
 * does NOT load the agent — it only wires user activity to PageActions.
 *
 * Placement: paste the contents of this file into the site Footer web template,
 * after the New Relic snippet — or add it as page-level JavaScript. See README.md.
 *
 * What it emits: one PageAction named "uiInteraction" per meaningful click, with
 * the element's visible label, id, tag, link target, and the current path/title.
 * It deliberately does NOT read input values, so no field data is captured.
 */
(function () {
  "use strict";

  // The agent's API (newrelic.addPageAction) is defined by the loader snippet.
  // Guard in case this script happens to run before the snippet has executed.
  function whenReady(fn, tries) {
    tries = tries || 0;
    if (window.newrelic && typeof window.newrelic.addPageAction === "function") {
      fn(window.newrelic);
    } else if (tries < 50) {
      setTimeout(function () { whenReady(fn, tries + 1); }, 100);
    }
  }

  // Elements worth recording a click on. Add your own selectors/classes here.
  var CLICK_SELECTOR = [
    "a",
    "button",
    "[role='button']",
    "input[type='submit']",
    "input[type='button']",
    ".btn"
  ].join(", ");

  whenReady(function (newrelic) {
    document.addEventListener("click", function (e) {
      if (!(e.target instanceof Element)) return;
      var el = e.target.closest(CLICK_SELECTOR);
      if (!el) return;
      try {
        newrelic.addPageAction("uiInteraction", {
          label: (el.innerText || el.value || el.getAttribute("aria-label") || "")
            .trim().replace(/\s+/g, " ").slice(0, 120),
          controlId: el.id || "",
          tag: el.tagName.toLowerCase(),
          href: el.getAttribute("href") || "",
          path: location.pathname,
          pageTitle: document.title
        });
      } catch (err) {
        /* never break the host page */
      }
    }, true); // capture phase: fires even if a handler stops propagation
  });
})();
