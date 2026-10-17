# Cluster-Level Configuration

## What it is

A **cluster** is a regional or business grouping that sits between the global setup of the platform and the individual policy. Clusters exist because Nacora's book spans multiple regions with meaningfully different operating conditions — the clauses that apply by default in EMEA-North are not the same as those in APAC, and the underwriters responsible for one part of the world are usually not the same people responsible for another. Rather than duplicate configuration on every policy in a region, or force everything into the global library, clusters let administrators say once: *these clauses, these settings, this routing applies across every policy inside this region unless the policy overrides it.*

Typical clusters in the current deployment include groupings such as EMEA-North, APAC, and LATAM-South. The exact list is deployment-specific and lives in the Choices module. Clusters can be granular (one cluster per country) or broad (one cluster per continent) depending on how the business wants to organise itself. What matters is that once a cluster exists, every configuration that supports cluster scope — clauses, referral routing, visibility, and reporting — can be attached to that cluster and inherited by everything within it.

## Who uses it & where

- **Administrators** create clusters, define which countries and broker companies belong to which cluster, and configure the cluster-level clause library and default behaviours. This is a governance-level task, usually done once at deployment and adjusted rarely.
- **Broker managers and cluster-level underwriters** see the effects of cluster configuration when they set up policies. Clauses, defaults, and routing already reflect the cluster their policies live under.
- **Every user working inside a policy** benefits transparently — the right clauses are already available, referrals route to the right people, and data visibility respects the cluster boundary.
- **Nacora's referral routing model** uses cluster (combined with country and region) as one of the inputs when deciding which underwriter should own a referral.

Cluster configuration surfaces in a few places: the Choices module (where clusters are defined as a list), a dedicated Cluster Clauses management area, the Broker Company creation form (where a cluster is assigned to each broker), and the policy setup wizard (where cluster context influences the clauses that are pre-selected and available).

## How it works

### The three-scope model

Configuration on the platform follows a three-scope hierarchy:

- **Global scope.** The top level — the Global Clauses Library, global choice lists, global business rule templates. Everything defined here is potentially available to every policy on the platform. This is the widest scope and the one administrators curate most cautiously, because a change here ripples everywhere.
- **Cluster scope.** The regional layer. Configuration here is available to every policy whose broker company belongs to the cluster, but not to policies outside it. This is where regional operating norms live — the clauses a UK underwriter expects to see by default, the referral routing for GFH's Eastern Europe book, the default insurers used in APAC.
- **Policy scope.** The narrowest layer. Configuration here applies to exactly one policy. Policy-level clauses, policy-specific business rules, the participants and rating tables of that policy alone. When a policy is quoted, the platform sees the union of global, cluster, and policy configuration — with the tighter scope winning in case of conflict.

Inheritance flows top-down. A policy inherits everything from its cluster, which inherits everything from global, unless the intermediate or narrower scope explicitly overrides or opts out. Nothing flows sideways — one cluster does not see another cluster's clauses.

### Cluster-level clause library

The most substantive use of clusters today is the **Cluster Clauses** section — a clause library scoped to a single cluster, sitting between the Global Clauses Library and policy-level clauses.

An administrator or broker with cluster-level permissions can pull clauses from the Global Clauses Library into a cluster (making them available to every policy in that cluster without a per-policy import step) and can create custom clauses directly at cluster level (for regional wording that does not belong in the global library). Every clause available inside a policy shows its **source indicator** — Global, Cluster, or Policy — so a broker managing clauses on an individual policy can see at a glance where each clause came from.

The intent is to eliminate repeated setup work. Before cluster clauses, every policy that needed the same regional wording had to import it independently from the global library or recreate it manually. Now a cluster administrator sets it up once and every current and future policy in the cluster picks it up.

### Auto-assignment and the opt-out toggle

Cluster clauses can be **auto-assigned** to policies in the cluster. When auto-assignment is on, every policy under that cluster automatically has the cluster's clauses attached — no per-policy import required. The clauses show up on the policy's clause list with the Cluster source indicator, and business rules can attach them to shipments just like any other clause.

Auto-assignment is not always desirable. Nacora specifically asked for the option to **disable cluster-specific clause auto-assignment** on a per-policy basis so that a policy which needs a bespoke clause set is not silently loaded with regional defaults. The toggle sits on the policy configuration and defaults to on; turning it off means the policy will only pick up the cluster's clauses that the broker explicitly imports, treating the cluster library as a menu rather than a default set.

The same principle applies at cluster level. A cluster administrator can restrict which policies auto-inherit cluster clauses (for example, only new policies created after a certain date, or only policies under a specific sub-cluster). Whether auto-assignment applies to *newly-added clauses only, existing policies only, or both* is a per-cluster configuration choice — and it is currently an open question in the design discussions with Nacora.

### Data visibility scoping by cluster

Clusters also scope what data a user can see. A broker company belongs to exactly one cluster; a user attached to that broker company sees the broker's own policies and shipments but not those of broker companies outside the cluster. A cluster-level underwriter sees every policy and shipment in their cluster but not those in a different cluster.

This is the same visibility mechanism the platform already uses for broker-level data isolation, extended one level up. The rule is: *a user sees what their broker company's cluster allows, and no wider.* Global roles (Nacora administrators) transcend cluster boundaries; every other role is capped at the cluster it belongs to.

Practically this matters for two surfaces: the shipment listing and the referrals dashboard. Both are filtered by the cluster of the signed-in user's broker company, and the filtering happens at the query level — a user cannot uncover another cluster's shipments by manipulating filters.

### The Cluster field on the Broker Company form

The Broker Company creation form (the Business Partner setup for the Broker Company role) now includes a **Cluster** field. The field is optional but strongly recommended. Selecting a value from the cluster dropdown (sourced from the Choices module) assigns the broker company to that cluster; every policy created under that broker inherits the cluster association automatically.

The cluster shown on the Broker Company record is also displayed when hovering over the broker in the organisation tree, so a user browsing the tree can see the cluster context without opening the record. Editing the cluster on an existing broker is allowed but rare — it means moving every policy under that broker into a different regional context and should be done with intention.

### Referral routing by cluster, country, and region

Cluster feeds into referral routing. When a shipment triggers a referral, the platform decides which underwriter to notify based on a chain of inputs: the policy's assigned underwriter (if configured), the broker company's cluster, and the shipment's country and region.

The interim routing model for the current deployment — until a scalable configuration lands — routes referrals to individual named underwriters by country and region. For KN Poland and Eastern Europe, that means the GFH underwriter Marcel Behnke. For other regions, other named underwriters will be nominated as they onboard. The future scalable model is expected to configure an underwriter (or a team) at the policy level, so that referrals under that policy route to the designated owner automatically without hard-coding names into rules.

Ownership is separate from access. When a referral is routed to Marcel Behnke, the platform notifies him and marks him as the primary owner — but every other GFH underwriter can still open, review, assign, or approve the referral. Routing determines the notification recipient, not the pool of people permitted to act.

### Who configures clusters

Cluster creation and configuration is an **Administrator** task. The specific admin roles that can do it are:

- Adding a new cluster to the choice list.
- Populating the Cluster Clauses library for that cluster.
- Setting auto-assignment defaults on the cluster.
- Assigning broker companies to a cluster.
- Configuring cluster-scope referral routing.

Individual brokers and underwriters do not configure clusters — they consume them. A broker managing a policy sees the effect of cluster configuration in the clauses available on the policy and the default routing on referrals, but they do not edit the cluster itself.

## Business rules & calculations

- **Inheritance flows top-down.** Global feeds into cluster, cluster feeds into policy. Policies see the union of all three scopes.
- **The tighter scope wins.** A clause defined at policy level with the same identifier as a cluster clause overrides the cluster version for that policy only.
- **Clause source is always visible.** Every clause available on a policy carries a Global, Cluster, or Policy source indicator so users understand where the wording came from.
- **Auto-assignment is opt-out at policy level.** Cluster clauses default to being auto-assigned to policies in the cluster; individual policies can turn the auto-assignment off.
- **Data visibility respects cluster boundaries.** Broker-level users cannot see policies or shipments in a cluster their broker company does not belong to; global administrators see everything.
- **Referral ownership routes by policy, cluster, country, and region.** Routing determines the notification recipient. Every underwriter in the assigned group retains full access and can act on the referral regardless of who owns it.
- **The Cluster field on Broker Company is optional but effectively required for cluster benefits.** A broker with no cluster gets global-and-policy scope only; the cluster layer is inert for that broker.

## Related concepts

- Clauses
- Business Partner
- Business Partner — Broker Companies
- Choices
- Referral Management
- Policy Creation
