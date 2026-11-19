# Analytics Feed

The analytics feed is a reusable data pipeline that produces daily exports of Nacora shipment data for external analytics platforms. The first consumer is a KN Tableau dashboard that receives a 15-column parquet file each day.

## Who uses it and where

The KN analytics team consumes the daily parquet feed in their Tableau dashboards. Administrators configure feeds and monitor delivery in the back office at nacora-bo.i2go.io. The feed infrastructure lives in the analytics module and is designed to serve additional consumers in future.

## How it works

### Feed architecture

The data feed framework is a general-purpose pipeline with four stages:

1. **Source** — a configured query that reads shipment or policy data from the database
2. **Staging** — the query results are staged as Arrow rows for efficient columnar processing
3. **Format** — staged rows are written to the chosen output format (parquet, ORC, CSV or JSON Lines)
4. **Sink** — the formatted file is delivered to its destination (S3 bucket or local directory)

Each feed is configured in the admin with its source, format and sink. A periodic Celery beat task runs each active feed on its schedule.

### KN Tableau feed

The KN feed is the first concrete feed. It produces a 15-column export covering certificate-level shipment data. When multiple certificates exist for the same shipment, the newest wins (deduplication per certificate). A setup command creates the feed, its S3 destination and the periodic task in an inactive state, ready to be switched on in production.

### Delivery and retry

- Each delivery window is tracked in a run log. If a window was already delivered, it is skipped.
- Failed deliveries are retried on the next run. Only the failed window is re-attempted.
- Gaps between the last delivered window and today are caught up automatically — the feed produces one file per missed day.
- A stale lock (from a crashed run) is recovered so the next scheduled run is not blocked.

### Manual runs

Administrators can run a feed manually from the command line for a single day, a date range or a full export. Manual runs default to dry run and write only when committed. A local directory or a pre-signed S3 link can be used for hand-off.

## Business rules and calculations

- The feed is controlled by a feature flag. It is off by default in core settings and on only in Nacora production.
- Each feed has its own schedule, format and sink. Adding a new consumer means adding a new feed configuration, not changing the pipeline.
- The parquet format is the default for Tableau. Other formats are available for different consumers.
- Deduplication is per certificate within each shipment — newest certificate wins

## Related concepts

- Dashboard and Home — the in-app analytics page shows similar data in the browser
- Rating — shipment pricing data flows into the feed columns
- Billing — charge and premium data are part of the exported columns
- Shipment Search — the feed covers the same shipment universe as search
