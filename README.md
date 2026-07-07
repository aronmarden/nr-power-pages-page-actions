# Power Pages server-side logs → New Relic (via Azure Blob Storage)

Power Pages writes its **server-side** logs (ASP.NET exceptions and the like) to a
container in **Azure Blob Storage** — not to Application Insights or Log Analytics.
This guide forwards those blobs into **New Relic Logs**, so you can see the
server-side errors next to the browser telemetry the New Relic Browser agent already
sends.

The supported path is New Relic's official **Azure Blob Storage forwarder** — an
Azure Function that triggers whenever a new blob is written, reads it, and POSTs it
to the New Relic Log API. No VM, no re-architecting.

---

## Before you start

- **The log container exists.** Power Pages writes server-side logs to a blob
  container (default name `telemetry-logs`) in a storage account you nominate,
  configured in the Power Platform admin centre (connection string + retention). If
  that isn't set up yet, do it first — there's nothing to forward otherwise.
- **A New Relic ingest (licence) key.** New Relic → *API keys* → an **INGEST - LICENSE**
  key.
- **Your New Relic region** — US or EU (the forwarder asks which).
- **Permission to deploy** an ARM template / resource into the Azure subscription that
  holds the storage account.

---

## Steps

### 1. Confirm where the logs land

In the Power Platform admin centre, note the **storage account name** and the
**container name** that Power Pages writes server-side logs to (default
`telemetry-logs`). That's the container the forwarder will watch.

### 2. Deploy the New Relic Blob Storage forwarder

Use New Relic's maintained function. Two ways to deploy:

- **Azure Marketplace** — search **"New Relic Azure Blob Storage"** and follow the
  create flow, or
- **One-click ARM template** — `azuredeploy-blobforwarder.json` from the New Relic
  functions repo: https://github.com/newrelic/newrelic-azure-functions

During deploy you'll supply:

| Setting | Value |
|---|---|
| New Relic licence key | your INGEST - LICENSE key |
| New Relic region / endpoint | US → `https://log-api.newrelic.com/log/v1` · EU → `https://log-api.eu.newrelic.com/log/v1` |
| Storage account | the one from Step 1 |
| Container | the log container from Step 1 (e.g. `telemetry-logs`) |

Deploy into the same subscription/region as the storage account.

### 3. Generate a log

Trigger a server-side error on the portal (or wait for the next log blob to roll), so
Power Pages writes a new blob. The Blob-trigger function fires on that write and
forwards it.

### 4. Verify in New Relic

Wait a minute, then in **Query builder** (NRQL):

```sql
-- Are the forwarded logs arriving?
FROM Log SELECT count(*) SINCE 30 minutes ago

-- Inspect a few
FROM Log SELECT * SINCE 30 minutes ago LIMIT 20
```

If nothing shows, check the Function App's invocation logs in Azure (it logs each
trigger and any POST error), and confirm the licence key and region endpoint.

---

## Correlate with the browser telemetry

To line these server-side logs up with the front-end data the Browser agent sends,
carry a **shared attribute** on both sides — at minimum an app/environment name, and
ideally a session or trace id if your logs include one. Then you can pivot from a
browser error to the matching server log.

---

## Good to know

- **Event-driven, not tailing.** The function fires on each new blob write. A blob
  that is *modified* is resent in full, which can duplicate — fine for discrete
  per-error / rolled log blobs, worth knowing if you ever point it at append blobs.
- **Size cap.** The Node blob binding fails above ~105 MB per blob. Power Pages error
  blobs are well under that.
- **This is separate from Azure Monitor / Event Hub.** Those carry Azure *platform*
  metrics and diagnostic logs, not the application logs Power Pages writes to blob —
  so they don't replace this.

Reference: https://docs.newrelic.com/docs/logs/forward-logs/azure-log-forwarding/
