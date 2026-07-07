# New Relic Browser — user attribution for Power Pages

Stamp the signed-in user onto **every** New Relic Browser event — PageViews, Core
Web Vitals, AJAX, JavaScript errors and PageActions — and keep each browser session
tied to a single user.

> Assumes the New Relic Browser agent is already installed on the site. This adds
> user attribution on top of it.

---

## Paste this

Add the block below to your **Header** web template, **immediately after the New
Relic loader snippet**. This is the whole change — nothing else to add.

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

---

## The one rule: header, right after the loader

This has to run **after** the New Relic loader (so `window.newrelic` exists) and
**before** the first PageView is sent (so the id attaches to it). The header, right
below the loader, satisfies both.

If your loader currently sits in the **footer**, move it — and this block — up into
the header. Otherwise this runs before the agent exists, the
`if (!(window.newrelic ...))` guard skips it, and nothing is set.

Set the id any later — from a footer script, or by reading it off the page after it
renders — and the first PageView, timings and AJAX have already gone out with no
user. Only clicks that happen afterwards get attributed, which leaves most of the
telemetry blank.

---

## What each part does

- **`{{ user.fullname }}`** — the signed-in user, rendered server-side by Power
  Pages. Swap in whichever Liquid attribute you want as the id (e.g. `{{ user.id }}`).
- **`resetSession: true`** — starts a fresh New Relic session. A session otherwise
  outlives a sign-out, so a shared browser (sign out, then sign in as someone else)
  merges two people into a single session — two users in one journey.
- **The `localStorage` guard** — fires the reset **only when the user actually
  changes** (sign-in, user switch, sign-out). Ordinary page-to-page navigation keeps
  the same id, takes the `else` branch, and the session continues. Without the guard,
  every page load would start a new session and destroy session continuity.

---

## Verify (NRQL)

```sql
-- Attribution should now be on PageViews, not just clicks:
FROM PageView SELECT percentage(count(*), WHERE `enduser.id` IS NOT NULL)
SINCE 30 minutes ago

-- One user per session — each session should show a single id:
FROM PageAction SELECT uniques(`enduser.id`) FACET session
SINCE 30 minutes ago LIMIT 20
```

`enduser.id` must be backtick-quoted in NRQL — the dot breaks parsing otherwise.
