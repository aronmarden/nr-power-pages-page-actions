# New Relic Browser — automatic PageActions for Power Pages

Turn ordinary user activity on a **Microsoft Power Pages** site into New Relic
Browser **PageActions**, with no per-button or per-page coding. Drop in one small
script and every meaningful click becomes a `uiInteraction` PageAction you can
query, chart, and alert on.

> **Assumption:** the New Relic Browser agent is **already installed** on your
> site — its loader snippet is pasted into the **header or footer web template**.
> This project does not install the agent; it only adds the event wiring on top.

---

## Why the agent alone doesn't give you this

Installing the Browser snippet gets you the out-of-the-box telemetry automatically:
**PageViews, JavaScript errors, AJAX/backend calls, Core Web Vitals, and Session
Replay**. That's because the agent captures those on its own.

**PageActions are different** — they only exist when something calls the agent's
`newrelic.addPageAction()` API. Nothing in the base snippet does that, so out of
the box you get zero PageActions. This project is simply a bit of JavaScript that
listens for clicks and calls that API for you — the same idea used by code-based
instrumentation elsewhere, but Power Pages lets you add JavaScript directly, so no
extra components are needed.

---

## What you get

- **`uiInteraction` PageAction on every meaningful click** — captures the element's
  visible label, `id`, tag, link target, and the current path and page title.
- **(Optional) Friendly PageView names** — nicer than raw URL paths.
- **(Optional) User attribution** — stamp the signed-in contact onto the session.
- **(Optional) Curated business events** — e.g. `enquirySubmitted`, `orderPlaced`.

No input/field values are captured by the click handler, so it won't record what
users typed.

---

## Step 1 — Add the click-capture script (required)

Copy the contents of [`nr-page-actions.js`](nr-page-actions.js) and add it to your
site **after** the New Relic snippet. Two common placements:

- **Site-wide (recommended):** paste it inside the **Footer** web template, in its
  own `<script>` block, below the New Relic loader.
- **Per page:** paste it into an individual page's **JavaScript** (Power Pages
  design studio → the page → *Edit → </> code*), or the page's `OnLoad` script.

You end up with **two separate `<script>` blocks** — the agent first, the
click-capture script under it:

```html
<!-- New Relic loader — pasted verbatim from New Relic. It already includes its
     own <script> tags, so don't wrap it in another pair. -->
<script type="text/javascript">
  ;window.NREUM||(NREUM={});NREUM.init=...   // New Relic's snippet, as copied
</script>

<!-- Auto PageActions — nr-page-actions.js is raw JavaScript, so you wrap it. -->
<script>
  (function () { "use strict"; /* ...contents of nr-page-actions.js... */ })();
</script>
```

Two things that commonly trip people up:

- **The New Relic snippet already ships with its own `<script>…</script>` tags.**
  Paste it exactly as copied — don't add an extra wrapper around it.
- **`nr-page-actions.js` is raw JavaScript (no tags).** That one you *do* wrap in
  `<script>…</script>` yourself, as shown above.

The two blocks don't have to live in the same web template. The click script waits
until the agent's API is ready (`whenReady`), so it's forgiving about order and
placement — the New Relic loader in the **header** with the click script in the
**footer** works just as well. The only hard rule is that **the agent loads first**.

That's it — clicks now produce `uiInteraction` PageActions. Everything below is
optional polish.

---

## Step 2 — Friendly PageView names (optional)

By default the agent names each PageView after its URL path. To use nicer names,
call `setPageViewName()` **in the header, immediately after the New Relic loader**
— it must run before the page finishes loading, or the initial PageView is already
sent with the default name.

```html
<script>
  // In the HEADER web template, right after the New Relic loader snippet.
  (function () {
    var map = {
      "/": "/Home"
      // "/enquiry/": "/Enquiry",
      // "/orders/":  "/Orders"
    };
    var name = map[location.pathname] || location.pathname;
    if (window.newrelic && newrelic.setPageViewName) {
      newrelic.setPageViewName(name);
    }
  })();
</script>
```

Because Power Pages serves real pages with real URLs, each navigation is already a
distinct PageView — you only need this if you want prettier names.

---

## Step 3 — Attribute activity to the signed-in user (optional)

Power Pages exposes the authenticated contact through Liquid, so you can stamp a
stable user id onto the session. Put this in the **header**, after the loader:

```html
{% if user %}
<script>
  if (window.newrelic && newrelic.setUserId) {
    newrelic.setUserId("{{ user.id }}");
  }
</script>
{% endif %}
```

Use whatever Liquid attribute suits you (`user.id` is stable and non-identifying).
Avoid stamping personal data such as email addresses.

---

## Step 4 — Curated business events (optional)

For high-value moments, fire a named PageAction with your own attributes — for
example on a form submit:

```html
<script>
  // Attach to the relevant form's submit, button click, or success handler.
  if (window.newrelic) {
    newrelic.addPageAction("enquirySubmitted", {
      category: "support",
      path: location.pathname
    });
  }
</script>
```

These sit alongside the automatic `uiInteraction` events and are ideal for funnels
and conversion tracking.

---

## Verify in New Relic

Give it a minute after clicking around, then run these in **Query builder** (NRQL):

```sql
-- Are the automatic click events arriving?
FROM PageAction SELECT count(*) FACET label
WHERE actionName = 'uiInteraction' SINCE 30 minutes ago

-- Inspect a few raw events
FROM PageAction SELECT * WHERE actionName = 'uiInteraction'
SINCE 30 minutes ago LIMIT 20

-- Any curated business events?
FROM PageAction SELECT count(*) FACET actionName SINCE 30 minutes ago
```

Scope to your app if you have several:
`... WHERE appName = 'Your Browser app name'`.

---

## Notes & gotchas

- **Serve over HTTP(S), not `file://`.** The Browser agent won't initialise from a
  local file, so test on the deployed site or a proper local server.
- **Don't double-install the agent.** This project assumes the loader is already
  present. Adding a second copy will double-count telemetry.
- **Ad/script blockers** can drop the New Relic beacon; if you see nothing, test
  with blockers off.
- **Timing.** `addPageAction` and `setPageViewName` are available as soon as the
  loader snippet has run — that's why the loader must come first. The click script
  includes a short guard in case load order varies.
- **Privacy.** The click handler records visible labels and ids only, never input
  values. If any button label itself contains sensitive text, trim or omit it in
  the `label` mapping before shipping.
- **Extending coverage.** Add your own CSS selectors or `data-*` attributes to
  `CLICK_SELECTOR` in `nr-page-actions.js` to capture custom components.

---

## Files

| File | Purpose |
|---|---|
| [`nr-page-actions.js`](nr-page-actions.js) | The paste-in click-capture script (Step 1). |
| `README.md` | This guide. |

## Licence

MIT — see [`LICENSE`](LICENSE).
