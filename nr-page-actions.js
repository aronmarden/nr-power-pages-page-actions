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
 *
 * Privacy: labels pass through safeLabel() below, which masks emails and long
 * digit runs (account / invoice / amount) before sending. To drop a specific
 * button's label entirely, add the attribute data-nr-nolabel to it — the click,
 * id, tag and path are still recorded, only the text is omitted.
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

  // Build the label we send from an element's visible text.
  //   - data-nr-nolabel on the element → omit the text entirely (click still recorded)
  //   - mask obvious PII: email addresses, and runs of 4+ digits (account /
  //     invoice numbers, dollar amounts). This is a coarse net, not a validator —
  //     digits split by separators (e.g. "12,340") and non-numeric secrets slip
  //     through, so use data-nr-nolabel for anything you know is sensitive.
  //   - collapse whitespace and cap length. Ordinary labels ("Save",
  //     "Add supplier") pass through unchanged.
  function safeLabel(el) {
    if (el.hasAttribute("data-nr-nolabel")) return "";
    return (el.innerText || el.value || el.getAttribute("aria-label") || "")
      .replace(/\S+@\S+/g, "[email]")
      .replace(/\d{4,}/g, "[num]")
      .trim().replace(/\s+/g, " ").slice(0, 120);
  }

  whenReady(function (newrelic) {
    document.addEventListener("click", function (e) {
      if (!(e.target instanceof Element)) return;
      var el = e.target.closest(CLICK_SELECTOR);
      if (!el) return;
      try {
        newrelic.addPageAction("uiInteraction", {
          label: safeLabel(el),
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
