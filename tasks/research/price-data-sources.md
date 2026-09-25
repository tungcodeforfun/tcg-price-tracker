# Price data sources for a paid TCG collection tracker

Researched 2026-09-25. Sources are official docs, pricing pages, ToS, and official announcements, linked next to each claim. Labels:

- **[UNVERIFIED]**: no primary source confirms it.
- **[INFERENCE]**: my reasoning from the cited facts. It is not a documented statement.
- **[PROBED]**: I observed it directly with an HTTP request on 2026-09-25.

Nothing here is legal advice. Before launch, have counsel review the ToS and image-rights points in §4.

## TL;DR

- **Primary price source: JustTCG, Professional plan ($49/mo).** It is the only candidate whose Terms explicitly allow display, derived analytics, storage and charging users on any paid tier ([Terms §7.1](https://justtcg.com/terms), [commercial-use guide](https://justtcg.com/docs/commercial-use)). It covers 17+ games with per-condition and per-printing prices, refreshes every 6 hours, and supports 100-card batches.
- **Fallback, plus card images and metadata: Scrydex, Starter plan ($29/mo) as a warm standby.** Scrydex is the successor to pokemontcg.io. It has raw and graded prices, card images and pop reports. **Blocker:** its ToS bans "commercially exploit[ing] the Services without prior written authorization" ([Terms §4](https://scrydex.com/terms)), so get written authorization before relying on it.
- **Not usable for a paid product today:**
  - TCGplayer API: closed to new developers.
  - eBay Marketplace Insights (sold data): Limited Release; the docs themselves are now behind a login.
  - Cardmarket API: closed to new applications.
  - TCGCSV: re-hosts TCGplayer API data, which TCGplayer's terms forbid obtaining from a third party.
  - PriceCharting: internal use only unless you negotiate a commercial license.
- **Launch games: Pokémon (English) and One Piece, with Lorcana as a cheap third.** All three are covered raw by both JustTCG and Scrydex, and Scrydex also has graded prices for Pokémon and Lorcana, which makes a premium tier possible. Defer MTG: it has 100K+ cards and 5M+ variants, and Scryfall's "no paywall" rule applies. Defer Yu-Gi-Oh: Scrydex marks it "Soon".
- **Monthly cost does not grow with user count** if prices are mirrored into our DB by scheduled set-level batch jobs. For Pokémon + One Piece + Lorcana:
  - 1k users: about **$78/mo** (JustTCG Pro + Scrydex Starter).
  - 10k users: the same $78/mo; about **$178/mo** if we move to JustTCG Enterprise for 6-hourly refresh or add MTG/YGO.

---

## 1. Provider evaluations

### 1.1 JustTCG (recommended primary)

| Aspect | Finding | Source |
|---|---|---|
| Games | 17 per llms.txt: Digimon, Lorcana, DBS Fusion World, Flesh and Blood, Grand Archive, Gundam, hololive, MTG, One Piece, Pokémon, Pokémon Japan, Riftbound, Sorcery, Star Wars: Unlimited, Union Arena, UniVersus, Yu-Gi-Oh!. The supported-games page says "20 trading card games" and also lists DBS Masters, Palworld and Cyberpunk TCG. | [llms.txt](https://justtcg.com/llms.txt), [supported-games](https://justtcg.com/supported-games) |
| Catalog size | 279K+ cards and 1M+ variants. Pokémon 30K+, Pokémon Japan 30K+, One Piece 7K+, Lorcana 3K+, MTG 100K+ (5M+ variants), YGO 50K+, Digimon 9K+. | [supported-games](https://justtcg.com/supported-games) |
| Data type | Per-variant prices, where a variant is one condition (NM → Damaged) × printing (normal/foil). Prices are a "volume-weighted average of observed market activity" that blends online marketplace activity with in-store sales reported by 65+ partner game stores. JustTCG says to describe them as market value, not a quote. The upstream online marketplaces are not named. | [commercial-use](https://justtcg.com/docs/commercial-use), [features](https://justtcg.com/features), [llms.txt](https://justtcg.com/llms.txt) |
| History / stats | 24h/7d/30d/90d stats: % change, min/max, stddev, IQR, trend slope. `priceHistoryDuration`, `include_price_history`, `include_statistics` and `updated_after` are query params on `GET /v1/cards`. | [features](https://justtcg.com/features), [OpenAPI](https://justtcg.com/docs/swagger.json) |
| Graded | Only in the `/v2/cards` **beta** (PSA/BGS/CGC variants). v2 batch is not live yet. `graded=include` "adds a surcharge" of an unspecified amount **[UNVERIFIED]**. Only the NA region returns data. JustTCG says production integrations should stay on v1. | [cards-v2](https://justtcg.com/docs/api/cards-v2), [OpenAPI](https://justtcg.com/docs/swagger.json) |
| Freshness | "Updated every 6 hours" / "rolling six-hour cycle". | [supported-games](https://justtcg.com/supported-games), [features](https://justtcg.com/features) |
| Pricing and limits | Free $0: 1,000 req/mo, 100/day, 10/min, 20 cards/request.<br>Starter $19: 10,000 req/mo, 1,000/day, 50/min, 100 cards/request.<br>Professional $49: 50,000 req/mo, 5,000/day, 100/min, 100 cards/request.<br>Enterprise $149: 500,000 req/mo, 50,000/day, 500/min, 200 cards/request.<br>Prices exclude tax. A batch `POST /cards` counts as 1 request. Going over the monthly quota means upgrading; there is no overage billing. | [pricing](https://justtcg.com/pricing), [rate-limits](https://justtcg.com/docs/rate-limits) |
| Commercial ToS | Any paid tier may display prices and history to end users, build derived analytics, cache and store with "no maximum retention period", combine with other sources, and charge users. Prohibited: reselling the raw feed, proxying endpoints, bulk dataset exports, or building a competing pricing API. The free tier is non-commercial only. Attribution is appreciated but not required. | [Terms §6–7](https://justtcg.com/terms), [commercial-use](https://justtcg.com/docs/commercial-use) |
| ToS gotchas | §7.2: the license to stored data **ends when the subscription ends**, so accumulated history cannot keep serving users after cancelling. §9: prices can change with 30 days' notice. §12: no accuracy warranty. §13: we indemnify JustTCG. | [Terms](https://justtcg.com/terms) |
| Metadata / images | Card fields: `uuid`, `name`, `game`, `set`, `set_name`, `number`, `rarity`, `tcgplayerId`, `mtgjsonId`, `scryfallId`, `variants[]`. **No images.** llms.txt says "Card images are not served by the API". | [card schema](https://justtcg.com/docs/schema/card), [llms.txt](https://justtcg.com/llms.txt) |
| Access | Self-serve with no approval step. Auth is an `x-api-key` header. Base URL is `https://api.justtcg.com/v1`. [PROBED] `GET /v1/games` without a key returns HTTP 401 `MISSING_API_KEY`. | [quickstart](https://justtcg.com/docs/quickstart) |

### 1.2 Scrydex, formerly pokemontcg.io (recommended fallback and image source)

| Aspect | Finding | Source |
|---|---|---|
| Status | pokemontcg.io now shows only "The Pokémon TCG API is now part of Scrydex". The Scrydex docs call Scrydex its "natural evolution". | [pokemontcg.io](https://pokemontcg.io/), [Scrydex docs](https://scrydex.com/docs) |
| Games | Pokémon (EN + JA), MTG, Lorcana, Gundam, One Piece (beta), Riftbound (beta). The homepage also shows Yu-Gi-Oh! and Digimon logos marked "Soon", and neither appears in the docs' per-game API list. | [docs](https://scrydex.com/docs), [homepage](https://scrydex.com/) |
| Data type | Raw prices by condition (NM/LP/MP/HP/DM) with `low` and `market`. Graded prices (PSA, CGC, BGS, TAG, SGC…) with `low`, `mid`, `high` and `market`. Trends for 1/7/14/30/90/180 days. Currencies are USD and JPY; EUR is "future". | [prices guide](https://scrydex.com/docs/getting-started/prices) |
| Graded coverage | Pokémon ✅, Lorcana ✅, One Piece beta. MTG, Gundam and Riftbound are "Coming Soon". The homepage advertises historical eBay and auction-house sold data for graded cards; raw sold data is "coming soon". | [prices guide](https://scrydex.com/docs/getting-started/prices), [homepage](https://scrydex.com/) |
| Extras | Pop reports, price history endpoints, webhooks, and Vision image identification (card scanning). | [pricing](https://scrydex.com/pricing), [docs](https://scrydex.com/docs) |
| Freshness | Prices change "at most once per day"; Scrydex recommends caching for ≥24h. | [best practices](https://scrydex.com/docs/getting-started/best-practices) |
| Pricing and limits | Starter $29: 5,000 credits, then $0.006 per overage credit.<br>Growth $99: 50,000 credits, then $0.002.<br>Professional $399: 250,000 credits, then $0.0016.<br>Enterprise: custom, 1M+ credits.<br>Most requests cost 1 credit, price history 3, Vision 5. The pricing page example uses "up to 100 cards per request". Rate limit is 100 req/s on every plan. Overage is billed automatically; usage is visible at `/account/v1/usage`, which updates every 20–30 min. | [pricing](https://scrydex.com/pricing), [rate limits](https://scrydex.com/docs/getting-started/rate-limits) |
| Commercial ToS | No explicit display license. §4 prohibits: "Resell, sublicense, redistribute, mirror, or commercially exploit the Services without prior written authorization from Scrydex" and "Use the Services primarily as a substitute backend… for a competing commercial product". The pricing page's "Growing Storefront" example suggests commercial use is expected, but that example is not a license grant. **Action: get written authorization.** §2 lets terms change "immediately upon posting". | [Terms](https://scrydex.com/terms), [pricing](https://scrydex.com/pricing) |
| Images | Card, set-logo and set-symbol images at `images.scrydex.com`, in small/medium/large. Image fetches cost no credits. Scrydex says "you are free to include the provided card images" and recommends re-hosting them on your own CDN. It also says it "does not claim ownership… All images belong to their respective copyright holders", so rights compliance is on us. | [best practices](https://scrydex.com/docs/getting-started/best-practices), [Pokémon cards doc](https://scrydex.com/docs/pokemon/cards) |

### 1.3 PriceCharting

| Aspect | Finding | Source |
|---|---|---|
| Games | Pokémon, Lorcana, Magic, One Piece, YuGiOh and "Other Cards". Its sister site SportsCardsPro covers sports cards. | [API docs card categories](https://www.pricecharting.com/api-documentation), [methodology](https://www.pricecharting.com/page/methodology) |
| Data type | **Sold-based.** "We collect sold listing data from eBay and our own… Marketplace" and run it through outlier removal. Prices are for ungraded cards and grades 1–10 (7, 8, 9, 9.5, PSA 10, BGS 10, CGC 10, SGC 10, CGC Pristine, BGS Black, TAG 10, ACE 10). Shipping is excluded. | [methodology](https://www.pricecharting.com/page/methodology), [API key descriptions](https://www.pricecharting.com/api-documentation) |
| History | "The API and CSV only support current item values… Historic prices and historic sales are not supported." | [API docs](https://www.pricecharting.com/api-documentation) |
| Freshness | The CSV is generated every 24h. | [API docs](https://www.pricecharting.com/api-documentation) |
| Pricing and limits | API and CSV require the **Legendary** subscription ($49/mo). The API allows 1 call/second, with account revocation "if it persists". The CSV allows 1 download per 10 minutes. | [Pro page](https://www.pricecharting.com/pricecharting-pro?f=api), [API docs](https://www.pricecharting.com/api-documentation) |
| Commercial ToS | "Licensed for internal use only. Sharing our price data… within an application or service used by others requires a commercial license and express written permission". The commercial license price is not published **[UNVERIFIED]**. All data must be purged when the subscription ends. Caching is encouraged. | [API docs §Usage & Attribution](https://www.pricecharting.com/api-documentation) |
| Metadata / images | Product id, name, console/set, release date, UPC, eBay ePID and `tcg-id` (a TCGplayer ID). No image fields are documented. | [API docs](https://www.pricecharting.com/api-documentation) |
| Verdict | This is the best graded and sold-comps source *if* a commercial license can be negotiated. Without one it cannot be shown to users. | — |

### 1.4 TCGplayer API

| Aspect | Finding | Source |
|---|---|---|
| Access | "We are no longer granting new API access at this time." | [Getting started](https://docs.tcgplayer.com/docs/getting-started) |
| Terms (for existing keys) | The API is provided "solely for the purpose of (a) academic research or (b) promoting and facilitating access to and use of the Site". Prohibited uses include: combining TCGplayer pricing with any other pricing data; distributing TCG Content to end users "for commercial or competitive purposes"; and "Obtain[ing]… pricing information from a third-party that was collected from the Site using our API or otherwise using automated means". Required attribution: "This product uses TCGplayer data but is not endorsed or certified by TCGplayer", plus a link to the product page. | [API Terms & Conditions](https://help.tcgplayer.com/hc/en-us/articles/360061115874-TCGplayer-API-Terms-Conditions) |
| Legit alternative | The affiliate program through Impact pays commission on referred sales, with 48h first-click attribution. Deep-linking to TCGplayer product pages (using `tcgplayerId` from JustTCG) needs no API access. | [Affiliate program](https://docs.tcgplayer.com/docs/tcgplayer-affiliate-program) |
| Verdict | Not available. The TCGplayer-derived aggregators in §1.8 carry TCGplayer's "no third-party-sourced data" clause as supply risk. | — |

### 1.5 eBay: Browse API and Marketplace Insights

| Aspect | Finding | Source |
|---|---|---|
| Browse API | Searches **active** listings. The default limit is 5,000 calls/day. All methods use an application token from the client-credentials grant. Buy APIs "require an additional license" for production. | [Browse API overview](https://developer.ebay.com/develop/api/buy/browse_api), [API call limits](https://developer.ebay.com/develop/get-started/api-call-limits) |
| Buy API production access | Buy APIs in production are "intended for eBay partners only". You apply through the eBay Partner Network and approval depends on the business model; there is "no guarantee" of approval. | [Buy API requirements](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html) |
| Marketplace Insights (sold data, 90 days) | "(Limited Release) API available only to select developers approved by business units". [PROBED] The docs URL now redirects to a sign-in page (`/api-docs/marketplace-insights-private/...`), and the API is missing from the public API catalog on the call-limits page. Third-party write-ups in 2026 report it is "not open to new users". | [edp.ebay.com overview](https://edp.ebay.com/api-docs/buy/marketplace-insights/static/overview.html) (mirror; developer.ebay.com version requires login) |
| License terms that matter | Displayed listing data must be ≤6h old and other content ≤24h old. You may not "use eBay Content, either alone or in combination with third-party information, to suggest or model prices" without prior written consent. Using eBay Content in a way that enables derivation of "Average selling price… for any eBay category" also needs prior written permission. Restricted-API data may feed pricing tools "only upon receiving eBay's express prior written consent". eBay Content may not be used to train ML models. | [API License Agreement](https://developer.ebay.com/join/api-license-agreement) |
| Verdict | We have no sold data. Browse can power an "active listings on eBay" panel with affiliate links, but **not** a price estimate. | — |

### 1.6 Cardmarket (EU)

| Aspect | Finding | Source |
|---|---|---|
| API | "Currently, we are not accepting applications for access to the Cardmarket API". Existing users may not share credentials with third-party apps. The base URL moved to `apiv2.cardmarket.com` (switch deadline 2026-05-01). | [Help: Cardmarket API](https://help.cardmarket.com/en/cardmarket-api), [API docs](https://apiv2.cardmarket.com/ws/documentation) |
| Public price guide | Since June 2024 the price guide and product catalogue are downloadable for all games and updated daily. [PROBED] The files are public and unauthenticated. `price_guide_1.json` (MTG) has 127,782 rows and `price_guide_6.json` (Pokémon) has 79,277 rows, both `createdAt` 2026-09-25. Fields: `idProduct`, `avg`, `low`, `trend`, `avg1/7/30`, plus foil/holo variants, in EUR. | [Cardmarket announcement](https://news.cardmarket.com/en/Magic/were-making-the-price-guide-and-product-catalogue-available-for-download) |
| Commercial ToS | I found no license terms for the price-guide files; the download page is behind Cloudflare, and treat redistribution rights as unknown **[UNVERIFIED]**. TCGCSV's maintainer says the dumps lack set info and need reverse-engineering to match cards. | [TCGCSV FAQ](https://tcgcsv.com/faq) |
| Verdict | A possible future EUR price column, pending written permission from Cardmarket. Not for launch. | — |

### 1.7 Scryfall (MTG only)

| Aspect | Finding | Source |
|---|---|---|
| Data | Full MTG metadata. `prices` holds `usd`, `usd_foil`, `usd_etched`, `eur`, `eur_foil` and `tix`, updated once a day. Cards also carry `tcgplayer_id` and `cardmarket_id`. | [Card objects](https://scryfall.com/docs/api/cards), [rate limits](https://scryfall.com/docs/api/rate-limits) |
| Limits | 2 req/s on search, named, random and collection endpoints; 10 req/s elsewhere; image CDN unlimited. Scryfall asks clients to use daily bulk files for large lookups. | [rate limits](https://scryfall.com/docs/api/rate-limits) |
| Terms | Free, under the WotC Fan Content Policy. **You may not "paywall" access to Scryfall data**: "end-users should be able to access card data anonymously or with free accounts". Data may not simply be repackaged; you must add value. Images must not be cropped, watermarked or color-shifted, and art crops need artist and copyright credit. | [API overview](https://scryfall.com/docs/api), [imagery](https://scryfall.com/docs/api/images) |
| Verdict | Good for MTG metadata and images in the free tier. Paid features must be add-ons on top of free card data. | — |

### 1.8 Other 2026 options (not recommended as primary)

| Provider | Summary | Commercial terms | Risk | Source |
|---|---|---|---|---|
| **TCGCSV** (tcgcsv.com) | Daily re-host of TCGplayer API categories, groups, products and prices (~20:00 UTC). There is no per-condition SKU data. Archives go back to 2024-02-08. It is a free hobby project run by one person. | None published. The data comes "directly from TCGplayer's API". | TCGplayer's API Terms forbid obtaining TCGplayer pricing "from a third-party that was collected… using our API". The operator is a single person. **Do not use in a paid product.** | [tcgcsv.com](https://tcgcsv.com/), [FAQ](https://tcgcsv.com/faq), [TCGplayer API Terms](https://help.tcgplayer.com/hc/en-us/articles/360061115874-TCGplayer-API-Terms-Conditions) |
| **tcgapi.dev** | "Covers every game on TCGPlayer". Market/low prices, per-condition data on Pro+, history since March 2025, and image URLs on `tcgplayer-cdn.tcgplayer.com`. | Commercial use requires Pro ($49.99/mo, 10K req/day) or Business ($99.99/mo, 50K/day). | Built openly on TCGplayer data, so the same TCGplayer third-party clause applies. | [pricing](https://tcgapi.dev/pricing/), [intro](https://tcgapi.dev/introduction/) |
| **PokemonPriceTracker** | Pokémon only. Raw and PSA prices, sealed products, JP cards, Cardmarket EUR (beta), pop reports, eBay dumps. | The pricing page lists "Commercial use license" even on Free and API $9.99. **But the ToS §6 requires Business ($99/mo) or Enterprise ($300/mo) for any commercial use**, and the ToS governs. | Single game; TCGplayer-derived [INFERENCE from third-party summaries]. | [pricing](https://www.pokemonpricetracker.com/pricing), [terms](https://www.pokemonpricetracker.com/terms) |
| **MTGJSON** | MTG metadata and price files, under the MIT license. | The MIT license covers MTGJSON's own work. [INFERENCE] It cannot relicense price data owned by the upstream sellers it aggregates. | Price provenance. | [license](https://mtgjson.com/license/) |
| **YGOPRODeck** | Yu-Gi-Oh! metadata, images, and per-vendor prices from Cardmarket, CoolStuffInc, eBay and Amazon. The v7 changelog (2026-09-03) says "`tcgplayer_data` has been removed". Limit is 20 req/s; images must be downloaded and re-hosted, and hotlinking gets you IP-blacklisted. | "Completely free to use". No explicit commercial grant was found **[UNVERIFIED]**. | Hobby service. Useful for YGO images and metadata later. | [API guide](https://ygoprodeck.com/api-guide/) |
| **PSA Public API** | Cert verification (OAuth with your PSA login). | Not a price feed. | — | [PSA public API](https://www.psacard.com/publicapi) |

---

## 2. Comparison summary

| | JustTCG | Scrydex | PriceCharting | TCGplayer | eBay MI | Cardmarket | Scryfall | TCGCSV |
|---|---|---|---|---|---|---|---|---|
| New access today | ✅ self-serve | ✅ self-serve | ✅ ($49 Legendary) | ❌ closed | ❌ limited release | ❌ closed (files public) | ✅ free | ✅ free |
| Paid-app display allowed | ✅ explicit (paid tiers) | ⚠️ needs written authorization | ❌ needs commercial license | ❌ | ❌ | ❓ | ✅ if card data stays free | ❌ (TCGplayer terms) |
| Games of interest (Pokémon / OP / Lorcana / MTG / YGO) | all | Pokémon, OP (beta), Lorcana, MTG; YGO "Soon" | Pokémon, OP, Lorcana, MTG, YGO | all | all | all | MTG | all |
| Conditions | NM–DMG × printing | NM–DM | ungraded only | SKU-level (closed) | n/a | avg/trend | nonfoil/foil/etched | market/low/mid/high |
| Graded | v2 beta | ✅ (Pokémon, Lorcana) | ✅ best | ❌ | sold comps | ❌ | ❌ | ❌ |
| History | 24h–90d stats + history | 1–180d trends + history endpoint | ❌ | ❌ | 90d sold | 1/7/30d avgs | ❌ | archive since 2024-02 |
| Refresh | 6h | daily | daily | — | — | daily | daily | daily |
| Images | ❌ | ✅ | ❌ | — | listing photos | — | ✅ | TCGplayer CDN links |
| Entry cost for commercial use | $19 | $29 (+ authorization) | $49 + license (price unknown) | — | — | — | $0 | — |

---

## 3. Recommendation

### 3.1 Architecture assumption behind the costs

Mirror the catalog and prices into Postgres with scheduled **set-level batch jobs**. Serve every user read (search, collection valuation, charts) from our own DB. JustTCG explicitly permits this caching and storage ([Terms §7.1](https://justtcg.com/terms)), and Scrydex recommends it ([best practices](https://scrydex.com/docs/getting-started/best-practices)). With this design, vendor cost depends on **catalog size × refresh frequency**, not on the number of users.

The current code calls vendors per card and on demand (`api/v1/prices.py:37` does a name search and then a price call for each card), which would make cost grow with users. That code has to change.

### 3.2 Primary: JustTCG

- **Launch catalog:** Pokémon EN 30K+ + One Piece 7K+ + Lorcana 3K+ ≈ **40K cards** ([supported-games](https://justtcg.com/supported-games)).
- **One full refresh:** `GET /v1/cards?game=…&set=…&limit=100` paged by set, which is ≈ **400 requests**. Walking the set lists adds a small number more. `updated_after` could reduce this further **[UNVERIFIED how much]**.
- **Daily refresh:** 400 × 30 ≈ **12,000 req/mo**. That exceeds Starter (10K/mo), so **Professional, $49/mo** (50K/mo, 5K/day).
- **6-hourly refresh**, matching JustTCG's cadence: ≈ 48,000 req/mo. That fits Professional but with no headroom, so use **Enterprise, $149/mo**. Enterprise also has 200-card batches, which halves the call count.
- **Adding MTG (100K+) and YGO (50K+):** ≈ 190K cards, so ≈ 1,900 req/day at 100/batch (57K/mo, too much for Pro). Enterprise at 200/batch needs ≈ 950/day (≈ 28.5K/mo).

### 3.3 Fallback and images: Scrydex

- **Standby role:** run a weekly metadata and image sync for the launch games, plus a pull on each new set. Keep Scrydex IDs mapped next to JustTCG UUIDs. A few thousand credits per month fits **Starter, $29/mo**.
- **Cutover:** if JustTCG fails, a daily 40K-card price sweep is ≈ 12K credits/mo. That costs $29 + 7,000 × $0.006 = **$71/mo** on Starter, or $99 on Growth. A 190K-card sweep is ≈ 57K credits/mo, so Growth $99 + 7K × $0.002 ≈ **$113/mo**.
- **Premium graded tier:** Scrydex graded prices (Pokémon, Lorcana) are the most production-ready graded source that is self-serve. JustTCG v2 graded is beta with an unpriced surcharge. A daily graded sweep of the launch catalog needs Growth, $99.

### 3.4 Monthly vendor cost

Prices exclude sales tax.

| Scenario | 1k users | 10k users |
|---|---|---|
| **Launch** (Pokémon + OP + Lorcana, daily raw prices, Scrydex standby + images) | **$78** (JustTCG Pro $49 + Scrydex Starter $29) | **$78**, unchanged because cost is catalog-bound |
| **Growth** (6-hourly refresh, or + MTG/YGO) | $178 (JustTCG Enterprise $149 + Scrydex Starter $29) | $178 |
| **Premium graded tier via Scrydex** | +$70 (Starter → Growth) → $148–$248 | same |
| **Degraded mode** (JustTCG down, Scrydex primary) | $71–$113 on Scrydex alone | same |

Per-user vendor cost at launch is about $0.078/user/mo at 1k users and $0.0078 at 10k.

eBay Browse is free (5,000 calls/day default), but see §4 for what it can show. The TCGplayer affiliate program earns revenue rather than costing anything.

### 3.5 Launch games

1. **Pokémon (English): must-have.** It has the deepest coverage in every source and graded prices on Scrydex. The repo already models it (`TCGType.POKEMON`).
2. **One Piece: launch.** Both JustTCG and Scrydex cover it (Scrydex prices/graded are beta), and the repo already models it.
3. **Lorcana: launch if cheap.** 3K cards adds about 30 requests per refresh. JustTCG covers it raw and Scrydex covers raw and graded.
4. **Defer MTG.** It is 100K+ cards with 5M+ variants, which pushes JustTCG to Enterprise. Scryfall's no-paywall rule and the WotC "F-R-E-E" Fan Content Policy ([WotC FCP](https://company.wizards.com/en/legal/fancontentpolicy)) constrain how MTG content can sit behind a subscription.
5. **Defer Yu-Gi-Oh and Digimon.** JustTCG covers both, but Scrydex (fallback and images) does not yet, and YGO images would need YGOPRODeck re-hosting.

---

## 4. Risks

1. **Upstream provenance, which affects every aggregator.** JustTCG does not name its "online marketplace" sources. It exposes TCGplayer product and SKU IDs as lookup keys ([OpenAPI](https://justtcg.com/docs/swagger.json)), and Scrydex variants link to TCGplayer ([homepage sample](https://scrydex.com/)). TCGplayer forbids obtaining its pricing through third parties, and eBay forbids using its content to model prices without consent (§1.4, §1.5). [INFERENCE] A marketplace enforcement action against a vendor could cut off our supply even though our own contract with that vendor is clean. Both vendors disclaim accuracy and warranties, and both make **us** indemnify **them** ([JustTCG §12–13](https://justtcg.com/terms), [Scrydex §13–15](https://scrydex.com/terms)).
   - *Mitigation:* keep two vendors behind one `PriceProvider` interface. Ask JustTCG in writing about source rights before launch.
2. **We don't own price history.** JustTCG's stored-data license ends when the subscription ends (§7.2), and PriceCharting requires a purge. A "5-year portfolio chart" is effectively rented.
   - *Mitigation:* tag every price point with its source. Plan to re-backfill history from the new vendor if we switch; Scrydex history costs 3 credits per card.
3. **Scrydex commercial-use ambiguity.** §4's "commercially exploit… without prior written authorization" clause blocks it as a production source until Scrydex confirms in writing. The confirmation must cover prices **and** images.
4. **Image rights.** No vendor licenses card art: Scrydex disclaims ownership and JustTCG serves no images. The WotC Fan Content Policy requires content to be free. Scryfall prohibits paywalling its data. I could not load Pokémon's legal page (bot wall); **[UNVERIFIED]** whether Pokémon offers any license for images in commercial apps.
   - *Mitigation [INFERENCE]:* keep card pages, images and current prices viewable on the free tier, and put only value-add behind the paywall (portfolio analytics, alerts, deep history, graded). Re-host images and never alter them. Get legal review.
   - **Current code hotlinks TCGplayer's CDN** (`justtcg.py:295-299` builds `product-images.tcgplayer.com/...` URLs). There is no license for this; remove it.
5. **Graded data maturity.** JustTCG graded is v2 beta: no batch, an unpriced surcharge, NA only. Scrydex graded covers only Pokémon and Lorcana (OP beta). PriceCharting graded needs a negotiated license.
6. **Quota cliffs and bills.** JustTCG hard-stops at the monthly quota with no overage, so a runaway job could blank prices until an upgrade. Scrydex bills overage automatically.
   - *Mitigation:* read `_metadata.apiRequestsRemaining` (JustTCG, [cards docs](https://justtcg.com/docs/api/cards)) and `/account/v1/usage` (Scrydex) and alert at 80%.
7. **Vendor concentration and size.** JustTCG LLC and Scrydex are small vendors. JustTCG can change prices with 30 days' notice. Scrydex can change terms "immediately upon posting".
8. **Coverage limits.** JustTCG prices are USD and English-only except Pokémon Japan ([llms.txt](https://justtcg.com/llms.txt)). Scrydex has USD and JPY with EUR "future". There is no licensed EU price source yet: the Cardmarket API is closed and its file terms are unknown.
9. **eBay.** Showing Browse listings is allowed within 6h freshness. Computing an average or median from them is a license violation ([ALA](https://developer.ebay.com/join/api-license-agreement)), and today the code does exactly that (see §5).

---

## 5. Existing integration code: what to reuse

The files are in `tcgtracker/src/tcgtracker/integrations/`.

| File | Keep | Must change | Evidence |
|---|---|---|---|
| `base.py` | `BaseAPIClient` with retries, circuit breaker, and the per-minute/per-hour `RateLimiter` (lines 21–82). | Add daily and monthly quota awareness, since JustTCG caps per day and per month. | [JustTCG rate limits](https://justtcg.com/docs/rate-limits) |
| `justtcg.py` | Class shell, base URL `https://api.justtcg.com/v1` (`config.py:47-48`), `X-API-Key` header (line 65), `_parse_price`. | See the list below this table. | [OpenAPI](https://justtcg.com/docs/swagger.json), [card schema](https://justtcg.com/docs/schema/card), [pricing](https://justtcg.com/pricing) |
| `pricecharting.py` | Shell only, and only if a commercial license is signed. | See the list below this table. | [API docs](https://www.pricecharting.com/api-documentation) |
| `ebay.py` | App-token client-credentials flow (lines 86–133) and Browse `item_summary/search` (line 288). This is correct for an "active listings" panel. | See the list below this table. | [Browse overview](https://developer.ebay.com/develop/api/buy/browse_api), [ALA](https://developer.ebay.com/join/api-license-agreement) |
| `tcgplayer.py` | Nothing. | No new keys are issued. It also uses a nonexistent `/oauth/authorize` code flow, while the real flow is `POST /token` with `client_credentials`. `TCGPlayerClient.__init__` raises `ValueError` when credentials are missing (line 48), and `prices.py:80` / `search.py:42` construct it. | [Getting started](https://docs.tcgplayer.com/docs/getting-started) |
| `config.py` | Settings pattern. | `justtcg_rate_limit=30`/min, while the plans allow Starter 50, Pro 100 and Enterprise 500. `pricecharting_rate_limit=60`/min matches the 1/s rule. | [pricing](https://justtcg.com/pricing) |

**`justtcg.py`: must change**
- The endpoints used (`/cards/search`, `/prices/batch`, `/prices/history/{id}`, `/sets/{game}`, `/sets/{code}/cards`) are **not in the OpenAPI spec**. The real API has `GET /v1/games`, `GET /v1/sets?game=`, `GET /v1/cards` (with `q`, `game`, `set`, `condition`, `printing`, `priceHistoryDuration`, `include_statistics`, `updated_after`, `limit`, `offset`) and `POST /v1/cards` for batches.
- The transforms read fields that don't exist (`set_code`, `collector_number`, `prices.market/low/mid/high`, `market_price`, `updated_at`). The real fields are `set`, `number`, `variants[].{condition,printing,price,lastUpdated,priceHistory[{p,t}]}`.
- Remove the TCGplayer CDN image URL (lines 295–299).
- Update the free-tier comments ("100 requests/day, ~4/hour") and the `limit` cap of 20. Paid plans allow 100–200 per request.

**`pricecharting.py`: must change**
- Auth must be the `t=<token>` query param, not an `X-API-Key` header (line 64).
- The real endpoints are only `/api/product` (`id`/`upc`/`q`) and `/api/products?q=` (first 20 results). `/product/{id}/prices` and `/product/{id}/history` do not exist; history is unsupported.
- Prices are integer pennies.
- Grade fields are overloaded video-game keys: `loose-price` = ungraded, `graded-price` = grade 9, `manual-only-price` = PSA 10, and so on. `api/v1/prices.py:55-60` maps `complete_price`, `loose_price` and `new_price` into market/low/high, which is semantically wrong for cards.

**`ebay.py`: must change**
- `sold_items=True` adds `buyingOptions:AUCTION` (line 283). That does **not** return sold items; Browse returns active listings only.
- `get_price_statistics` (lines 438–496) and `prices.py:89-101`, which stores a listing price as `PriceHistory` under source `EBAY`, compute or store price estimates from eBay content. The ALA prohibits that without written consent, so remove both from the price pipeline.

**Cross-cutting:** replace per-card, name-based on-demand lookups (`prices.py:37-101`, `justtcg.get_card_price` search-then-price) with keyed set-level batch sync by JustTCG `uuid` / `tcgplayerId`. This is what keeps vendor cost flat as users grow (§3.1).
