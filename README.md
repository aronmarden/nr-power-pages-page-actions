# New Relic Browser — user attribution for Power Pages

Get the signed-in user onto **every** New Relic Browser event — PageViews, Core Web
Vitals, AJAX, JavaScript errors and PageActions — and keep each browser session tied
to a single user.

This fixes two things at once:

- **Most events show no user (null / "unknown" `enduser.id`).** Today only the clicks
  are attributed; page views, timings, AJAX and errors come through with no user.
- **Sessions that mix two people.** A New Relic session outlives a sign-out, so one
  shared browser can merge two users into a single session.

> Assumes the New Relic Browser agent is already installed on the site. This just adds
> user attribution on top of it.

---

## Steps

### 1. Find your New Relic loader

It's the `<script>` block you pasted from New Relic (it starts with
`;window.NREUM||(NREUM={})...`). Note whether it's in your **Header** or **Footer**
web template.

### 2. Make sure the loader is in the Header

If it's currently in the Footer, move it up to the **Header** web template. The reason:
the user id has to be set *before* the first page view is sent, and it can only run
*after* the loader — so both need to be in the header, loader first. If the loader
stays in the footer, the snippet in Step 3 runs before New Relic exists and does
nothing.

### 3. Paste this block right after the loader

In the **Header** web template, immediately below the New Relic loader:

```liquid
{% if user %}
<script>
  (function () {
    if (!(window.newrelic && newrelic.setUserId)) return;
    var current = "{{ user.fullname }}";
    if (localStorage.getItem("nrUser") !== current) {
      // First sign-in, or a different user on this browser: start a clean session.
      newrelic.setUserId(current, { resetSession: true });
      localStorage.setItem("nrUser", current);
    } else {
      // Same user, ordinary navigation: keep the session going.
      newrelic.setUserId(current);
    }
  })();
</script>
{% else %}
<script>
  (function () {
    if (!(window.newrelic && newrelic.setUserId)) return;
    if (localStorage.getItem("nrUser")) {
      // Just signed out: close that user's session cleanly.
      newrelic.setUserId(null, { resetSession: true });
      localStorage.removeItem("nrUser");
    }
  })();
</script>
{% endif %}
```

### 4. Publish

Publish the site (or just the templates you changed).

### 5. Verify in New Relic

Click through a few authenticated pages, wait a minute, then run these in **Query
builder** (NRQL):

```sql
-- Attribution should now be on PageViews, not just clicks. This climbs toward 100%:
FROM PageView SELECT percentage(count(*), WHERE `enduser.id` IS NOT NULL)
SINCE 30 minutes ago

-- One user per session — each session should show a single id:
FROM PageAction SELECT uniques(`enduser.id`) FACET session
SINCE 30 minutes ago LIMIT 20
```

`enduser.id` must be backtick-quoted in NRQL — the dot breaks parsing otherwise.

---

## What each part does

- **Placement (header, after the loader, before the first page view)** — this is what
  gets the id onto the load-time events (page views, timings, AJAX, errors), not just
  the clicks that happen later.
- **`{{ user.fullname }}`** — the signed-in user, rendered server-side by Power Pages.
  Swap in whichever Liquid attribute you want as the id (e.g. `{{ user.id }}`).
- **`resetSession: true`** — starts a fresh New Relic session when the user changes, so
  a shared browser (sign out, then sign in as someone else) doesn't merge two people
  into one session.
- **The `localStorage` guard** — fires the reset **only when the user actually changes**
  (sign-in, user switch, sign-out). Ordinary page-to-page navigation keeps the same id
  and the same session. Without the guard, every page load would start a new session.
