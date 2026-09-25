# Card image sources for a paid TCG price tracker

Researched 2026-09-25. Every claim links to its source. Labels:

- **[UNVERIFIED]**: no primary source confirms it.
- **[INFERENCE]**: my reasoning from the cited facts. It is not a documented statement.
- **[PROBED]**: observed directly with one to four HTTP requests per source on 2026-09-25.

This doc builds on `price-data-sources.md` and does not repeat it: Scrydex (§1.2 there, parked because ToS §4 needs written authorization), Scryfall basics (§1.7), and JustTCG v1 serving no images (§1.1). Nothing here is legal advice.

**Repo state today.** `cards.image_url` exists but nothing fills it (`packages/db/src/schema.ts:73`). Cards render as typographic placeholders (`CardFace` in `apps/web/app/components/terminal/card-grid.tsx`). The v2 code no longer builds TCGplayer CDN URLs; the hotlinking risk in `price-data-sources.md` §4.4 applied only to the removed Phase 0 code. The agreed strategy says "licensed only, no scraping" and parks card images (`tasks/todo.md`, Strategy).

## TL;DR

- **No source licenses card images for commercial use, for any launch game. No publisher does either.**
  - Every community API or dataset either disclaims ownership of the images or says nothing about them.
  - Vendors that sell "commercial use" plans (PokeTrace, TCGGO, tcgapi.dev, PokéWallet) license only their own data. Each one disclaims the game IP (§6.3).
  - The publishers reserve the images:
    - **The Pokémon Company International (TPCi):** "our policy is to decline use of our trademarks and copyrights" ([pokemon.com ToS §3](https://web.archive.org/web/20260910072907/https://www.pokemon.com/us/legal/terms-of-use)).
    - **The Pokémon Company, Japan:** personal enjoyment only, and not on public networks ([pokemon-card.com policy](https://www.pokemon-card.com/policy.html)).
    - **Bandai:** "All images, text and data on this website may not be reproduced without permission" ([OPCG card list footer](https://en.onepiece-cardgame.com/cardlist/)).
    - **Ravensburger:** there is no Lorcana fan-content policy, and the site's Legal Notice bars reuse of its images ([legal notice](https://www.disneylorcana.com/en-US/legal-notice)).
  - **Wizards of the Coast (WotC)** is the only publisher that permits card art on fan websites at all, and only when the content is free ([Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy)).
- **Best technical source per game.** "Technical" means fresh, keyless or cheap, and joinable to our catalog. None of these is licensed.

  | Game | Best source | Join to our catalog | Verdict |
  |---|---|---|---|
  | Pokémon (EN) | TCGdex | `variants_detailed[].thirdParty.tcgplayer` = our `tcgplayerId` | Usable on free pages under the fan-site practice (option 2 below) |
  | Pokémon Japan | none adequate | TCGdex JA has no TCGplayer ids | TCGdex has 0 images for current JP sets. The complete official source forbids reuse. Keep placeholders. |
  | One Piece | none adequate | Base cards: `OP17-001` style set + number. Parallels have no deterministic mapping. | Bandai blocks hotlinking and forbids reproduction. The only API with TCGplayer ids serves TCGplayer CDN URLs. Keep placeholders and ask Bandai. |
  | Lorcana | Lorcast | `tcgplayer_id` = our `tcgplayerId` | Usable on free pages under the fan-site practice |
  | MTG (later) | Scryfall | JustTCG `scryfallId` → Scryfall `id` | The only source that is explicitly permitted, via the WotC Fan Content Policy. Free pages only. |

- **Practical options.** Pick one per game.
  1. **No images.** Keep the typographic placeholders. This carries zero IP risk and is the current state.
  2. **The tolerated fan-site practice.** Show images only on the free public card pages, unaltered, with a copyright line and a "not affiliated" notice. Use no publisher logos and run a fast takedown process. TCGdex, Lorcast, Limitless and every Scryfall-based site work this way. It is industry tolerance, not a license [INFERENCE].
  3. **Ask for permission.**
     - Bandai: [inquiry form](https://global.carddass.com/inquiry.php).
     - Ravensburger: press contact lorcanapress@ravensburger.com [UNVERIFIED as the right channel].
     - WotC: [support](https://support.wizards.com), for images inside paid screens.
     - TPCi: expect a no, given its stated policy.
     - JustTCG: its llms.txt says "Commercial image partnerships are being explored" ([llms.txt](https://justtcg.com/llms.txt)).
  4. **User photos of their own cards.** These fall under DMCA §512(c) safe harbor as user-stored material. The photos still reproduce the card art (§9, risk 2).

---

## 1. What "commercial" means for us

The images would appear in two places:

- **Free, public, indexed card pages.** These are the price guide.
- **Paid Pro screens.** These are portfolio, P&L and alerts, and they list the user's cards, so thumbnails would appear there too.

Two separate permissions apply:

- **The source's terms** (API or CDN): rate limits, hotlinking, attribution.
- **The rights holder's IP.** A source's "commercial license" can only cover the source's own work (data, code, hosting). None of them owns the artwork. For example, TCGdex says "Pokémon card information and images are licensed by The Pokémon Company" ([terms](https://www.tcgdex.net/terms-and-conditions)), and PokéWallet says "We do not claim any ownership of Pokémon intellectual property" ([terms](https://pokewallet.io/terms-conditions)).

---

## 2. Pokémon (English and Japanese)

### 2.1 TCGdex (api.tcgdex.net, assets.tcgdex.net)

| Aspect | Finding | Source |
|---|---|---|
| Coverage | Pokémon only, 14+ languages including `ja`. Image coverage: **EN 21,987 of 23,964 cards (91.75%)**, **JA 3,882 of 18,031 (21.53%)**. | [tcgdex.dev](https://tcgdex.dev/), [status](https://api.tcgdex.net/status) |
| Images | `card.image` is a base URL; append `/{high\|low}.{png\|webp\|jpg}`. `high` is 600×825 and `low` is 245×337 [PROBED on me05/001]. PNG and WebP are transparent. Headers: `access-control-allow-origin: *`, `cache-control: public, max-age=31536000, immutable` [PROBED]. | [assets docs](https://tcgdex.dev/assets) |
| Freshness, EN | 30th Celebration (released 2026-09-16) has 158 of 158 images, with asset `Last-Modified` on release day. Pitch Black (me05, released 2026-07-17) images arrived 2026-08-03, **17 days later** [PROBED]. Some promo sets (`mep`, `mee`, `30th-c`) have 0% images. | [status](https://api.tcgdex.net/status) |
| Freshness, JA | **Unusable for current sets.** Every MEGA-era JP set has 0% images (M1L, M1S, M2, M2a, M3–M6, MC, M-P), and so do SV11B/SV11W. `GET /v2/ja/sets/M6` returned 113 cards, none with an image, and `thirdParty: null` [PROBED]. Only older JA SV sets (SV7–SV10) have full images. | [status](https://api.tcgdex.net/status), [JA set M6](https://api.tcgdex.net/v2/ja/sets/M6) |
| Terms and cost | Free, no key: "The TCGdex API is free to use and requires no API key." Limits: "There are no published hard rate limits, but please be considerate. For bulk data needs, cache responses locally." No attribution or hotlinking rule is stated for images, and I found no API ToS. | [FAQ](https://tcgdex.dev/faq) |
| License of the data | Two licenses conflict. The repo is MIT ([LICENSE](https://github.com/tcgdex/cards-database/blob/master/LICENSE)). The website says "The content on the site is licensed under the Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)" ([terms](https://www.tcgdex.net/terms-and-conditions)). It is unclear which one covers API data [INFERENCE]. | as linked |
| Image ownership | Disclaimed: "Pokémon card information and images are licensed by The Pokémon Company." Footer: "not produced, endorsed, supported, or affiliated with The Pokémon Company, Creatures Inc, Game Freak or Nintendo." **TCGdex grants no image rights.** | [terms](https://www.tcgdex.net/terms-and-conditions), [tcgdex.net](https://www.tcgdex.net/) |
| **Join key** | EN: `variants_detailed[].thirdParty.tcgplayer`, the TCGplayer **product id** (632829 for `sv10-001`), plus `thirdParty.cardmarket`. The id is also in `pricing.tcgplayer.*.productId`. Sets carry `thirdParty.tcgplayer`, the TCGplayer group id. There is **no SKU id**. Card id is `{setId}-{localId}`. JA cards have at most a Cardmarket id, so a JA join needs a JustTCG set slug → TCGdex set id map plus `localId` [INFERENCE]. The FAQ admits some third-party ids are wrong, and `variants_detailed` exists to fix that. | [PROBED `/v2/en/cards/sv10-001`](https://api.tcgdex.net/v2/en/cards/sv10-001), [interfaces.d.ts](https://raw.githubusercontent.com/tcgdex/cards-database/master/interfaces.d.ts), [FAQ](https://tcgdex.dev/faq) |

### 2.2 Official EN card database (pokemon.com/us/pokemon-tcg/pokemon-cards)

- **Current.** The set filter already lists Pitch Black and 30th Celebration ([archive 2026-09-19](https://web.archive.org/web/2026/https://www.pokemon.com/us/pokemon-tcg/pokemon-cards)).
- **Low resolution.** Images are 245×342 PNG ([sample](https://assets.pokemon.com/static-assets/content-assets/cms2/img/cards/web/ME01/ME01_EN_1.png)) [PROBED].
- **Join key:** set code + number in the URL. No TCGplayer id.
- **Bot-walled.** The site is behind Incapsula [PROBED].
- **Terms forbid our use.** The pokemon.com ToS covers the website, its apps and **Pokémon TCG Live**. §5 grants use "for personal, noncommercial home use only" and forbids the following ([ToS, archive 2026-09-10](https://web.archive.org/web/20260910072907/https://www.pokemon.com/us/legal/terms-of-use)):
  - "(ii) Modify, or create derivative works based on, the content"
  - "(v) Download quantities of content to a database for any reason"
  - "(vi) Decompose, disassemble, or reverse engineer any part of any Service"
  - "(ix) Use the Service or content for commercial purposes, including… selling access to all or part of the Service"
- **Not usable**, and neither are Pokémon TCG Live assets.

### 2.3 Official JP card search (pokemon-card.com)

- **Freshest and largest JP source.** It already has M6a "30th CELEBRATION" (released 2026-09-16) [PROBED via one `resultAPI.php` call].
- **Images:** `…/assets/images/card_images/large/{SET}/{cardID}_{P|T|E}_{ROMAJI}.jpg`, 868×1212 JPG [PROBED].
- **Join key:** internal `cardID` + set folder. No TCGplayer or Cardmarket id, and the collector number is not in the filename.
- **Policy forbids reuse** ([サイトのご利用 §著作権について](https://www.pokemon-card.com/policy.html)):
  - 「データは、個人的に楽しむ場合に限って使用を許諾されるものであり…このサイトからは、データのコピー、複製、改変、出版、掲示、電送、配布することは固くお断りします。またこれらのデータを、他のインターネットなどの公衆ネットワーク上で利用することはできません。」 (Use is licensed for personal enjoyment only. Copying, reproduction, modification, publication, posting, transmission and distribution are refused. The data may not be used on the internet or any other public network.)
  - The same page permits text links only (「必ずテキストリンクでお願いいたします」).
- **Not usable.**

### 2.4 PokeTrace (api.poketrace.com): paid, has JP

- **Plans** ([pricing](https://poketrace.com/pricing)):
  - Free: 250 requests/day, "personal/non-commercial use only".
  - Pro $19.99/mo, Growth $49.99/mo, Scale $98/mo: "include full commercial usage rights".
- **Join fields** ([OpenAPI](https://api.poketrace.com/v1/openapi.json)): `image`, `refs.tcgplayerId`, `refs.cardmarketId`, `cardNumber`, `set.slug`. `game` covers `pokemon` and `pokemon-japanese`. That is a clean TCGplayer join for EN and JP.
- **Images are low resolution.** The sample was a 255×361 JPEG whose EXIF names a "PFU Scan" scanner [PROBED].
- **Terms:**
  - §6 disclaims affiliation with Nintendo and TPC ([terms](https://poketrace.com/terms)).
  - §8 forbids "Resell, sublicense, or redistribute our data without explicit written authorization".
  - Its "commercial usage" covers PokeTrace data, not TPC artwork [INFERENCE].

### 2.5 Limitless TCG and pkmn.gg: not sources

- **Limitless TCG** has fresh EN and JP images on its own CDN (`limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/…`, `/tpc/…`), but **no card API**.
  - Its legal page is an imprint only ([legal](https://limitlesstcg.com/legal)).
  - Footer: "card images and text, is copyright The Pokémon Company (Pokémon), Nintendo, Game Freak and/or Creatures. This website is not produced by, endorsed by, supported by, or affiliated with…" ([card page](https://limitlesstcg.com/cards/PBL/1)).
  - Using it would mean scraping.
- **pkmn.gg** has no API, and its ToS bans "any robot, spider, scraper, crawler" ([ToS](https://www.pkmn.gg/tos)).

### 2.6 Scrydex (overlap only)

- Scrydex covers Pokémon EN and JA with images, and would be the strongest JP option ([Scrydex docs](https://scrydex.com/docs)) [INFERENCE].
- It is still parked for the same two reasons: ToS §4 needs written authorization, and it disclaims image ownership. See `price-data-sources.md` §1.2.

### 2.7 Publisher: The Pokémon Company International and The Pokémon Company (Japan)

- **Neither has a fan-content policy for card images** [UNVERIFIED as a negative; none found on pokemon.com, pokemon.co.jp or pokemon-card.com].
- **TPCi default: decline.** "Unless otherwise noted, all content on the Service, including… artwork… is the property of Pokémon… Because we receive thousands of such requests, our policy is to decline use of our trademarks and copyrights." ([pokemon.com ToS §3](https://web.archive.org/web/20260910072907/https://www.pokemon.com/us/legal/terms-of-use))
- **TPCi fan art:** nothing grants a creator the right "to use the Pokémon intellectual property or Fan Art beyond a personal, noncommercial home use" ([Legal Information](https://web.archive.org/web/20260907053951/https://www.pokemon.com/us/legal/information)).
- **TPCi press assets** are "limited strictly to non-commercial uses". "In no event are you authorized to commercialize the Content, including… charging a fee for access to it." Branding Material may not be used "in the name of your business, product, service, app, domain name". ([Media Usage Guidelines](https://pokemon.gamespress.com/Media-Usage-Guidelines))
- **TPC Japan** ([pokemon.co.jp rules](https://www.pokemon.co.jp/rules/)):
  - Its data clause matches pokemon-card.com: personal enjoyment only, and not on public networks.
  - On derivative content: 「当社及び関係者による二次コンテンツのいかなる利用も、お客様に対し、個人的な利用を超えたポケモン財産…の利用を許諾するものではありません。」 (Nothing permits use of Pokémon property beyond personal use.)
- **No public licensing program for apps.** TPC's licensing page describes partner and licensee deals only ([licences](https://corporate.pokemon.co.jp/en/business/licences/)).
- **Answer to Q4:** no permission exists for free or paid fan tools. Every Pokémon aggregator relies on a copyright line plus a "not affiliated" notice (§2.1, §2.5).

---

## 3. One Piece Card Game

### 3.1 Official card list (Bandai): en / asia-en / www.onepiece-cardgame.com

- **Languages:** EN, English-Asia, JP, Simplified and Traditional Chinese, Thai, Korean and French ([language switcher](https://en.onepiece-cardgame.com/news/02_382.html)).
- **Format:** HTML only, no API.
- **Images:** `https://{en|asia-en|www}.onepiece-cardgame.com/images/cardlist/card/{CARD_ID}.png?{YYMMDD}`, with alt arts as `_p1`/`_p2`/`_p3`. There is one size, 600×838 PNG [PROBED].
- **Freshness:**
  - The EN OP-17 image has `last-modified: Fri, 21 Aug 2026`, which matches the prerelease date [PROBED; prerelease date from secondary sources].
  - OP-18 (EN release 2026-11-20, [products](https://en.onepiece-cardgame.com/products/)) is not in the card list yet, so sets appear at release, not before [INFERENCE].
- **Hotlinking is blocked.** The image responses send `cross-origin-resource-policy: same-site` [PROBED]. A test page on another origin failed to load the image in headless Chromium. Any use would mean re-hosting, which is reproduction.
- **Terms:**
  - EN footer: "All images, text and data on this website may not be reproduced without permission." JP footer: 「このwebサイトに記載されているすべての画像・テキスト・データの無断転用、転載をお断りします。」 ([card list](https://en.onepiece-cardgame.com/cardlist/))
  - The [Bandai Terms of Use](https://www.bandai.co.jp/en/site/notice/) say: "Any use of the Published Information (including but not limited to reproduction, modification, display, distribution, licensing, sale, and publication) beyond personal use or other use permitted by applicable laws and regulations is prohibited without the prior consent of Bandai."
- **Owners:** "©Eiichiro Oda/Shueisha ©Eiichiro Oda/Shueisha, Toei Animation". The JP footer adds Fuji TV. Bandai publishes the cards under license.
- **Join key:** card id `{SET}-{NNN}` (e.g. `OP17-001`). No TCGplayer id.

### 3.2 optcgapi.com

- **Coverage:** English only. `/api/allSets/` returned 22 sets, including OP-16, OP-17 and EB-03 [PROBED]. Prices are scraped daily (`date_scraped` 2026-09-24).
- **Images are Bandai's files.** `card_image` (e.g. `/media/static/Card_Images/OP01-001.jpg`) is labeled JPEG, but the bytes are a PNG with the same signature as Bandai's: 600×838, colormap [PROBED].
- **Terms:** none. There is no ToS or license page.
  - Home page: "Free For anyone to use!" ([home](https://optcgapi.com/))
  - Docs: "please try not to do an insane amount of API calls each day!… the API is run by me on my VPS" ([docs](https://optcgapi.com/documentation))
  - About page: "the API will have some limits on how much data can be pulled each day" ([about](https://optcgapi.com/about/general))
  - No image rights are claimed or granted.
- **Join key:**
  - `card_set_id` (`OP01-001`), `set_id`, `card_image_id` (`OP01-001_p1`).
  - `card_name` follows TCGplayer naming (`"Roronoa Zoro (001) (Parallel)"`). It is a name bridge, not an id [INFERENCE].
  - **No TCGplayer id.**

### 3.3 apitcg.com

- **Coverage:** 16 games, including One Piece, Pokémon, Lorcana and MTG ([OpenAPI](https://docs.apitcg.com/openapi.json)).
- **Access:** needs a free API key.
- **Terms:** none. `/terms`, `/tos` and `/legal` all return 404 [PROBED].
- **Images:**
  - The live API's images are **TCGplayer CDN URLs** (`tcgplayer-cdn.tcgplayer.com/product/500009_in_1000x1000.jpg`), so §6.2 applies.
  - Its GitHub dataset hotlinks Bandai URLs, stops at OP-12, and has no license ([repo](https://github.com/apitcg/one-piece-tcg-data)).
- **Join key:** `markets.tcgplayer.id`, `code`, `set.code`. This is the only OP API with TCGplayer ids and open keys, but its images are the prohibited TCGplayer ones.

### 3.4 Limitless TCG One Piece

- **Images:** `limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/{SET}/{ID}_EN.webp`, 600×838 WebP (Bandai's art re-encoded) [PROBED; INFERENCE on origin]. OP-17 is present.
- **No card API.** Limitless's API covers tournaments only ([developer docs](https://docs.limitlesstcg.com/developer)). TCGplayer ids appear only in HTML affiliate links.
- **Footer:** "card images and text, is copyright Eiichiro Oda/Shueisha, Toei Animation and/or Bandai. This website is not produced by, endorsed by, supported by, or affiliated with any of those copyright holders." ([site](https://onepiece.limitlesstcg.com/))
- Using it would mean scraping. **Not a source.**

### 3.5 Other One Piece options (brief)

- **arjunkai/optcg-api** (backs opbindr.com; [repo](https://github.com/arjunkai/optcg-api)):
  - It has the cleanest Bandai-id ↔ TCGplayer map: `tcg_ids[]` ("array of TCGPlayer product IDs"), plus `variant_type` and `base_id`.
  - Data keys are for "non-commercial dev use" only.
  - "No rights to the images are claimed by this project."
  - Not usable.
- **vegapull** ([GPL-3.0](https://github.com/Coko7/vegapull)) and **punk-records** ([repo](https://github.com/buhbbl/punk-records)): scrapers and static JSON of Bandai ids and image URLs in 7 languages, including JP. No TCGplayer ids. "All trademarks and images are property of their respective owners."
- **Scrydex One Piece (beta):** images at `images.scrydex.com/onepiece/{id}/{size}`, English only. Variant ids are Scrydex's own (e.g. `OP13-118C`). No TCGplayer id is documented ([docs](https://scrydex.com/docs/onepiece/cards)). Parked as in §2.6.

### 3.6 Publisher: Bandai, Shueisha, Toei

- **No One Piece Card Game fan-content or content-creator policy exists** [UNVERIFIED as a negative].
- **The only published permission is narrow.** Bandai's "Guidelines for Gameplay Videos and Streaming" ([PDF, 2026-07-31](https://www.carddass.com/bcg/en/pdf/movie-guideline.pdf)) cover gameplay videos of the BANDAI TCG＋D app only.
  - They exclude businesses: "these Guidelines do not apply to creation, publication, or similar acts by corporations or other organizations".
  - They forbid "Clipping or extracting materials included in the Company Apps (including illustrations, logos, ...)".
  - They do not cover websites or apps.
- **The One Piece IP regulations target physical goods.** They add: "These regulations do not signify formal permission or consent" ([news](https://en.onepiece-cardgame.com/news/02_382.html)).
- **Bandai has objected to this use in a sister game.** On the Digimon card site: "we have found some websites and applications that illegally duplicate and use the images from the Digimon Card Game… Bandai and Toei Animation have never given any license or permission to use such images." ([Digimon Card Game](https://world.digimoncard.com/))
- **Toei:** 「個人の方へ画像の使用許可は行っておりません。」 (Toei does not grant image permission to individuals.) ([FAQ](https://corp.toei-anim.co.jp/ja/faq.html))
- **Shueisha:**
  - No permission for individuals ([FAQ](https://faq.shueisha.co.jp/faq/show/27?category_id=8&site_domain=default)).
  - Corporate applications are accepted "on condition of showing Shueisha's specified credit" ([FAQ](https://faq.shueisha.co.jp/faq/show/85?category_id=3&site_domain=business)).
- **Route to a license:** Bandai Card Games, via the [inquiry form](https://global.carddass.com/inquiry.php) [INFERENCE that Bandai, as the card's publisher, is the first stop].

### 3.7 One Piece join problem

- **Bandai's ids are not TCGplayer's product granularity.**
  - Bandai uses one card number plus `_pN` image suffixes.
  - TCGplayer creates a separate product per art. For example, OP01-001 maps to 454512 (base) and 454513 ("Parallel"), and promo reprints live in other TCGplayer sets (e.g. 485262 in "One Piece Promotion Cards"). These ids are visible in Limitless's HTML links [PROBED].
  - `_pN` → `tcgplayerId` therefore has **no deterministic rule**. Base cards can join on set + number; parallels need name heuristics or a third-party map.
- JustTCG's OP `number` format (`OP01-001`?) is [UNVERIFIED]. Check one JustTCG OP card before building any join.

---

## 4. Disney Lorcana

### 4.1 Lorcast (api.lorcast.com)

| Aspect | Finding | Source |
|---|---|---|
| Coverage | Lorcana; `lang` = `en` in probes. Other languages [UNVERIFIED]. | [cards docs](https://lorcast.com/docs/api/cards) |
| Images | `image_uris.digital.{small,normal,large}`, all **AVIF**: 146×204, 488×681 and 674×940. A `full` 1468×2048 JPG exists but appears only in page og:image tags. Hosted on `cards.lorcast.io` behind Cloudflare. "You should not assume that the URL structure or domain will stay the same forever. Instead, use the card URIs returned from the API." | [images docs](https://lorcast.com/docs/api/images), [PROBED `/v0/cards/13/1`](https://api.lorcast.com/v0/cards/13/1) |
| Freshness | Set 14 (Hyperia City, `released_at` 2026-10-16) is already listed. The image for set 13 card 1 dates from 2026-07-04, about **two weeks before** the 2026-07-17 release [PROBED]. "Images should update infrequently, most commonly once the full set has been spoiled and high definition images are acquired." | [images docs](https://lorcast.com/docs/api/images) |
| Terms and cost | **No ToS page**: /terms, /tos, /legal and /terms-of-service all 404 [PROBED]. Free, no key. "Insert 50–100 milliseconds of delay between the requests… 10 requests per second on average." Overloading may lead to "a temporary or permanent ban of your IP address". "The file origins used by the API, located at `*.lorcast.io` do not have these rate limits." Caching of at least 24h is encouraged. v0 is "Beta… safe to use for production code." Nothing is said about commercial use, attribution or hotlinking. | [API overview](https://lorcast.com/docs/api) |
| Image ownership | Claims none. Footer: "Lorcast uses trademarks and/or copyrights associated with Disney Lorcana TCG, used under Ravensburger's Community Code Policy… **We are expressly prohibited from charging you to use or access this content.** Lorcast is not published, endorsed, or specifically approved by Disney or Ravensburger." The Community Code contains no such license (§4.4). The images appear to come from Ravensburger's app assets, given the same 1468×2048 native size [INFERENCE]. | [card page footer](https://lorcast.com/cards/3/25/bosss-orders) |
| **Join key** | `tcgplayer_id` (int; 702669 for set 13 #1) = our `tcgplayerId`. Also `purchase_uris.tcgplayer`, `set.code` + `collector_number`, and `GET /v0/cards/:set/:number`. Foil shares the product (`prices.usd_foil`). No SKU. | [PROBED](https://api.lorcast.com/v0/cards/13/1) |

### 4.2 LorcanaJSON

- **Coverage:** en, fr, de, it; sets 1–13 plus quests and decks.
  - Set 14 is partial: 12 cards, `hasAllCards: false` [PROBED].
  - "Once the new set cards get added to the official app, they will also get added… within a few days." ([lorcanajson.org](https://lorcanajson.org/))
- **Images:**
  - `full` is "usually 1468 by 2048" and `thumbnail` is 367×512.
  - "These images are the same ones as used in the official Disney Lorcana app."
  - The URLs point at **Ravensburger's own CDN** (`api.lorcana.ravensburger.com/images/…`) [PROBED].
- **How it gets the URLs:** the generator calls the app's private catalog API with the app's embedded client credential ([`RavensburgerApiHandler.py`](https://github.com/LorcanaJSON/LorcanaJSON)).
  - Hotlinking those URLs means depending on a private, undocumented CDN [INFERENCE].
  - It also runs into the Ravensburger ToU scraping clause (§4.4).
- **License:** the repo is MIT (code). No data or image license is stated, only "not affiliated with Ravensburger or Disney".
- **Join key:**
  - `externalLinks.tcgPlayerId`, `cardmarketId`, `cardTraderId`. These are sourced from CardTrader's `tcg_player_id`.
  - `setCode` + `number` (+ `variant`).
  - Set 14 has no `tcgPlayerId` yet.
- **Verdict:** Lorcast is better on every axis we care about.

### 4.3 Others (brief)

- **lorcana-api.com:**
  - "completely free to use and has no ads"; the code is MIT ([site](https://lorcana-api.com/), [repo](https://github.com/Dogloverblue/Lorcana-API)).
  - Images are Ravensburger CDN URLs. There is no TCGplayer id (`Unique_ID` like `AOV-001`) [PROBED].
  - Set 13 was added about 2.5 weeks after release.
  - No terms.
- **Dreamborn.ink:** no public API or terms found.
- **Lorcania:** footer "copyrighted by Disney and Ravensburger… not produced, supported, or affiliated with" ([cards](https://lorcania.com/cards)). No API.
- **Official gallery:** [cards.disneylorcana.com](https://cards.disneylorcana.com/en-US/) lists "3327 Cards", including set 14. There is no public API; the app API needs an SSO token.

### 4.4 Publisher: Ravensburger and Disney

- **The "Community Code" is a conduct code, not an IP license.** Fan sites cite it ([PDF](https://cdn.ravensburger.com/lorcana/community-code-en)), but it says nothing about fan sites, images, monetization or paywalls.
  - The "expressly prohibited from charging you" wording is Lorcast's own. It echoes WotC's FCP and does not come from Ravensburger [INFERENCE from reading the full PDF].
- **The Marketing Materials Policy is for retailers only.** Its assets "can be used in your store, on your retail store website, and through your retail store social media accounts" ([policy](https://brand.ravensburger-group.com/d/e1vhRSQ7WeNy)). Materials may not be used "in a way that implies… official sponsorship or endorsement", and "We reserve the right to deny the use of our Materials at any time for any reason or for no reason."
- **The disneylorcana.com Legal Notice bars reuse:** "Users of this website may not reuse, reproduce, publish, transmit, distribute, display, modify, create derivative works from, sell or participate in any sale or exploit in any manner, in whole or in part, any of the Contents." ([legal notice](https://www.disneylorcana.com/en-US/legal-notice))
- **The Ravensburger US Terms of Use (2026-02-06)** grant only "personal use… and not for redistribution of any kind". They also say: "You may not access, use, or copy any portion of the Site or Content through the use of indexing agents, spiders, scrapers, bots, web crawlers, or other automated devices" ([ToU](https://www.ravensburger.us/en-US/start/terms-of-use)).
- **The Disney Terms of Use** reserve "images and artwork". "Except as expressly licensed, we do not allow uses of the Disney Products, or other Disney intellectual property, that are commercial or business-related" (§3.H, [Disney ToU](https://disneytermsofuse.com/english/)). This governs Disney's own products, but it states the IP owner's position [INFERENCE].
- The content-creation FAQ only points to the Ambassador Program and the press page ([FAQ](https://ravensburger-en.mindtouch.us/Disney_Lorcana/Disney_Lorcana_FAQs/Disney_Lorcana_Content_Creation)).
- **Answer to Q4:** no permission exists for fan sites or tools, free or paid.

---

## 5. MTG (later add): Scryfall

`price-data-sources.md` §1.7 already covers the no-paywall and no-alteration rules. This section adds image specifics.

| Aspect | Finding | Source |
|---|---|---|
| Images | `png` 744×1040 (transparent). JPG: `small` 146×204, `normal` 488×680, `large` 672×936, `border_crop` 480×680, `art_crop` (varies). WebP: `thumb`, `grid`, `display`, `crop`, `art`. `image_status` is one of `missing`, `placeholder`, `lowres`, `highres_scan`. All printed languages are covered; placeholders are "most common on localized cards". | [imagery](https://scryfall.com/docs/api/images) |
| Freshness | Spoilers are added "within 24 hours of the news breaking", with `preview.*` fields. Early images may be `lowres`. | [spoiler FAQ](https://scryfall.com/docs/faqs/what-is-scryfall-s-spoiler-policy-9) |
| Hotlink / re-host | Embedding is expected: grantlist `img-src *.scryfall.io` in the CSP, and the file origins have no rate limits. "You may not simply repackage, republish, or proxy Scryfall data." Re-hosting unaltered images inside a value-add app is not forbidden by the terms, but a pure image proxy would conflict with "proxy" [INFERENCE]. | [HTTP concerns](https://scryfall.com/docs/api/http-concerns), [rate limits](https://scryfall.com/docs/api/rate-limits), [API](https://scryfall.com/docs/api) |
| Attribution / branding | Do not "cover, crop, or clip off the copyright or artist name", and do not "add your own watermarks, stamps, or logos". Art crops need the artist and copyright shown. Scryfall's name must not imply endorsement. | [imagery](https://scryfall.com/docs/api/images), [API](https://scryfall.com/docs/api) |
| **Join key** | JustTCG `scryfallId` → Scryfall `id` (best). Alternatively `tcgplayerId` → `GET /cards/tcgplayer/:id`, which matches `tcgplayer_id` or `tcgplayer_etched_id`. Scryfall also has `set` + `collector_number` + `lang`. Use bulk data for large lookups. | [cards](https://scryfall.com/docs/api/cards), [rate limits](https://scryfall.com/docs/api/rate-limits) |

**Publisher: WotC Fan Content Policy** ([FCP](https://company.wizards.com/en/legal/fancontentpolicy))
- **It covers our use case, but only for free content.**
  - "Q: Can I create a fan page about your games? And use Wizards' art? A: Yes!"
  - The IP it covers includes "the cards… pictures… artwork", and Fan Content includes "websites".
- **It must be free.** "One word: F-R-E-E": "You can't require payments, surveys, downloads, subscriptions, or email registration to access your Fan Content".
- **Ads are allowed.** "Sponsorships, ad revenue, and donations" are fine "so long as it doesn't interfere with the Community's access".
- **Required notice:** "[Title] is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC."
- **Other conditions:**
  - "Don't use Wizards' logos and trademarks."
  - Fan Content "does not include the verbatim copying and reposting of Wizards' IP".
  - "We have the right to stop or restrict your use of Wizards' IP at any time".
  - Uses the policy doesn't cover need "our prior, written approval."
- **WotC's Terms call the policy noncommercial.** Their streaming section describes it as "(reminder-this policy only permits noncommercial activities)" (§14.1), and §6.2 bars using Game Content except as the Terms or FCP permit ([Terms](https://company.wizards.com/en/legal/terms)) [PROBED].
- **Where our model lands** [INFERENCE]:
  - Free card pages with images fit the FCP.
  - Card images inside paid-only Pro screens fall outside it. Either render those rows without images, or get WotC's written approval.

---

## 6. Vendors and CDNs

### 6.1 JustTCG: still no images, in v1 or v2

- **llms.txt:** "Card images are not served by the API. Non-commercial projects can pair JustTCG with a public-domain image source such as Scryfall or MTGJSON. Commercial image partnerships are being explored." ([llms.txt](https://justtcg.com/llms.txt)) [PROBED]
  - Calling Scryfall images "public-domain" is wrong: they are WotC IP used under the FCP (§5).
- **No image fields in the schema.** The OpenAPI spec (updated 2026-09-22 to include `/v2/cards`) has no image, thumbnail or picture fields in `Card`, `Variant`, `CardV2` or `VariantV2` ([swagger.json](https://justtcg.com/docs/swagger.json)).
- **Ids for third-party images:** llms-full.txt says responses include "external product identifiers (TCGplayer ID, Scryfall ID, MTGJSON ID) which developers can use to construct image URLs from third-party sources" ([llms-full.txt](https://justtcg.com/llms-full.txt)).
- **Join fields:**
  - v1: `uuid`, `tcgplayerId`, `scryfallId`, `mtgjsonId`, `set`, `number`, and `variants[].tcgplayerSkuId`.
  - v2: `external_ids.{tcgplayer,scryfall,mtgjson}`.
- **Open question:** ask JustTCG what its "commercial image partnerships" are and when they will be available.

### 6.2 TCGplayer CDN (tcgplayer-cdn.tcgplayer.com, product-images.tcgplayer.com): prohibited

- **Technically trivial.** Our `tcgplayerId` joins perfectly: `tcgplayer-cdn.tcgplayer.com/product/{id}_in_1000x1000.jpg` [PROBED on 454512, 600×838 JPEG].
- **The API is closed to new developers:** "We are no longer granting new API access at this time." ([getting started](https://docs.tcgplayer.com/docs/getting-started))
- **API Terms** ([API Terms & Conditions](https://help.tcgplayer.com/hc/en-us/articles/360061115874-TCGplayer-API-Terms-Conditions)):
  - The API exists "solely for the purpose of (a) academic research or (b) promoting and facilitating access to and use of the Site".
  - Prohibited: "Develop, promote, or enable any product, application, or service similar to or that competes with TCGplayer's current or planned offerings".
  - Prohibited: "Distribute TCG Content or otherwise make it available to your end users or third parties… for commercial or competitive purposes".
  - Prohibited: "Obtain content or information… from a third-party that was collected from the Site using our API or otherwise using automated means".
  - Prohibited: "Copy, reproduce, distribute, republish, download, display, post or transmit in any form or any way any part of the Site".
- **Site ToS** ([ToS](https://help.tcgplayer.com/hc/en-us/articles/205004918-Terms-of-Service)):
  - "All of the content found on TCGplayer.com…, including graphics… are the property of TCGplayer, Inc."
  - "You agree not to crawl, scrape or spider any of our websites without express permission".
- **The affiliate program grants no image rights.** Its docs and Partner Guidelines cover links and disclosure only ([affiliate](https://docs.tcgplayer.com/docs/tcgplayer-affiliate-program), [guidelines](https://help.tcgplayer.com/hc/en-us/articles/31411199594391-TCGplayer-Partner-Guidelines)). The Impact contract terms are [UNVERIFIED].
- **Rights stay upstream anyway.** Even with TCGplayer's consent, the art belongs to the publisher [INFERENCE].
- **Verdict: confirmed prohibited, directly and through resellers** (tcgapi.dev, apitcg).

### 6.3 Other paid or multi-game APIs: none licenses artwork

| Service | Images | "Commercial" claim | Image-rights position | Join key |
|---|---|---|---|---|
| tcgapi.dev | `image_url` on TCGplayer's CDN | Pro $49.99 / Business $99.99 "include an explicit commercial license" ([pricing](https://tcgapi.dev/pricing/)). `/terms` is 404. | Cannot sublicense TCGplayer content, and TCGplayer forbids getting its content from third parties (§6.2) | `tcgplayer_id` |
| TCGGO (cardmarket-api.com, pokemon-api.com, lorcana-prices.com; sold via RapidAPI) | self-hosted `images.tcggo.com` | "Our paid plans are designed for commercial use" ([site](https://www.cardmarket-api.com/)) | "All product names, logos, and trademarks are property of their respective owners." Docs return 403 to curl [PROBED]; RapidAPI terms not read [UNVERIFIED]. | `card_number`, `episode.code`; TCGplayer id [UNVERIFIED] |
| PokéWallet | `GET /images/:id` returns JPEG or WebP. Pokémon, plus a One Piece API. | License covers "our Services for your personal or commercial purposes" ([terms](https://pokewallet.io/terms-conditions)) | "We do not claim any ownership of Pokémon intellectual property." | `set_code`, `card_number`, and a TCGplayer URL to parse ([docs](https://pokewallet.io/api-docs)) |
| CardTrader | Blueprint `image_url` | API is for managing your own inventory; "market APIs upon request" ([ToS](https://static.cardtrader.com/en/pages/terms-of-service)) | Game trademarks and graphics "not be owned by CardTrader" | `tcg_player_id`, `card_market_ids`, `scryfall_id` ([API](https://www.cardtrader.com/en/docs/api/full/reference)) |
| Cardmarket | — | "Currently, we are not accepting applications for access to the Cardmarket API." ([help](https://help.cardmarket.com/en/cardmarket-api)) | GTC: presentation of cards and prices needs "our prior written agreement" | — |
| PokemonPriceTracker | JP images mentioned | Business plan only (see `price-data-sources.md` §1.8) | "claims no partnership with or authorization from" Nintendo or TPC ([terms](https://www.pokemonpricetracker.com/terms)) | `tcgPlayerId` |

---

## 7. Comparison table

✅ yes · ⚠️ partial or conditional · ❌ no · — not applicable

| Source | Games | Image size / format | New-set freshness | Commercial image license | Claims image rights? | Hotlink / re-host | Cost / limits | Join key to our catalog |
|---|---|---|---|---|---|---|---|---|
| **TCGdex** | Pokémon, 14+ langs | 600×825 / 245×337; PNG, WebP, JPG | EN: release day to +17 days. JA: 0% for current sets | ❌ | ❌ disclaims (TPC) | Technically open (CORS `*`, immutable cache); no rule stated | Free, no key, no hard limit | EN `thirdParty.tcgplayer` ✅; JA set + `localId` only |
| pokemon.com card DB | Pokémon EN | 245×342 PNG | current | ❌ ToS forbids | TPCi owns | ❌ | — | set + number |
| pokemon-card.com | Pokémon JP | 868×1212 JPG | freshest (M6a present) | ❌ policy forbids | TPC owns | ❌ text links only | — | internal `cardID` |
| PokeTrace | Pokémon EN + JP | ~255×361 scan | [UNVERIFIED] | ❌ (data only) | ❌ disclaims | [UNVERIFIED] | $19.99+/mo for commercial | `refs.tcgplayerId` ✅ |
| Limitless TCG | Pokémon, One Piece | 600×838 WebP (OP) | very fresh | ❌ | ❌ disclaims | no API (scraping) | — | TCGplayer id in HTML only |
| Scrydex (parked) | Pokémon EN + JA, OP beta, Lorcana, MTG | small/medium/large | see other doc | ⚠️ needs written authorization | ❌ disclaims | re-host recommended | $29+/mo | see other doc |
| Bandai OPCG card list | One Piece, 8 langs | 600×838 PNG | at prerelease | ❌ "may not be reproduced" | Bandai / Shueisha / Toei | ❌ CORP `same-site` blocks hotlinking | — | `OP17-001` + `_pN` |
| optcgapi.com | One Piece EN | 600×838 (Bandai's PNG) | current (OP-17) | ❌ | silent | no rule | Free, informal daily cap | `card_set_id`; no TCGplayer id |
| apitcg.com | 16 games incl. OP | TCGplayer CDN URLs | [UNVERIFIED] | ❌ | silent | ❌ (TCGplayer images) | Free key, no terms | `markets.tcgplayer.id` ✅ |
| **Lorcast** | Lorcana EN | AVIF 146–674 px (+1468×2048 JPG in og:image) | ~2 weeks before release | ❌ | ❌ ("prohibited from charging you") | No rule; file origin has no rate limit | Free, no key, ~10 req/s | `tcgplayer_id` ✅, `set.code` + `collector_number` |
| LorcanaJSON | Lorcana en/fr/de/it | 1468×2048 / 367×512 JPG on Ravensburger's CDN | days after the app | ❌ | ❌ | hotlinks a private app CDN | Free | `externalLinks.tcgPlayerId` ✅ (not yet for set 14) |
| lorcana-api.com | Lorcana | Ravensburger CDN URLs | ~2.5 weeks after | ❌ | silent | same as above | Free | `Unique_ID` only |
| **Scryfall** | MTG, all langs | 146–744 px; JPG, PNG, WebP | ≤24h after a spoiler | ⚠️ WotC FCP (free content only) | ❌ (WotC's) | Embedding expected; no image rate limits | Free | `scryfallId` ✅, `tcgplayer_id` ✅ |
| JustTCG | 20 games | none | — | — ("partnerships being explored") | — | — | — | (our source) |
| TCGplayer CDN | all | 200w / 400w / 1000×1000 JPG | — | ❌ prohibited | TCGplayer / publishers | ❌ | API closed | `tcgplayerId` ✅ |
| tcgapi.dev, TCGGO, PokéWallet, CardTrader | various | various | — | ❌ (data only) | ❌ disclaim | — | $ plans | varies (§6.3) |

---

## 8. Recommendation per game

Across every game: **no path is licensed except asking.** Option 2 (the tolerated fan-site practice) is a business risk decision, not a legal permission. If we take it, these conditions apply to all games [INFERENCE, modeled on the WotC FCP, Scryfall's rules and TPCi's media guidelines]:

- **Where images appear:**
  - Show images only on the free, anonymous card, set and search pages.
  - Paid-only Pro screens (portfolio, P&L, alerts) render text rows, or link to the free card page.
- **The images themselves:**
  - Re-host copies on our own storage and CDN rather than hotlinking a hobby server.
  - Never crop, watermark, recolor or clip copyright lines.
  - Record the source URL and fetch date for each image.
- **Branding:**
  - Show a per-game copyright line plus "not produced by, endorsed by, supported by, or affiliated with…".
  - Use no publisher logos or trade dress.
  - Keep game trademarks out of our brand name and domain. TPCi forbids its branding "in the name of your business, product, service, app, domain name" ([media guidelines](https://pokemon.gamespress.com/Media-Usage-Guidelines)), and WotC says "Don't use Wizards' logos and trademarks" ([FCP](https://company.wizards.com/en/legal/fancontentpolicy)). The brand name is still open in `tasks/todo.md`.
- **Takedowns:**
  - Publish a takedown contact and a per-game kill switch that blanks `image_url` and purges the CDN.
  - Honor any publisher request the same day.
- **Credits:** name the source (TCGdex, Lorcast, Scryfall) without implying endorsement.

| Game | Recommendation | Conditions / join |
|---|---|---|
| **Pokémon (EN)** | **TCGdex**, under option 2, or keep placeholders if we hold the "licensed only" line. The rights holder's stated default is to decline. | Join `variants_detailed[].thirdParty.tcgplayer` = `cards.tcgplayer_id`. Fall back to a JustTCG-set → TCGdex-set map plus `localId`. Use `high.webp` (600×825). Expect 0–17 days of lag on new sets and gaps in promo sets. Credit TCGdex; its site claims CC BY-SA 4.0, so resolve the ShareAlike question if we store its data beyond ids and URLs [INFERENCE]. |
| **Pokémon Japan** | **Placeholders at launch.** No usable source: TCGdex JA has no images for current sets and no TCGplayer ids. pokemon-card.com forbids reuse and would mean scraping. PokeTrace images are low-resolution scans with no TPC license. | Revisit if Scrydex authorization happens (it has JA). Weakest game for images, and it matters because "best Japanese Pokémon coverage" is in the pitch. |
| **One Piece** | **Placeholders at launch, and ask Bandai** ([inquiry form](https://global.carddass.com/inquiry.php)). Bandai's is the most explicit prohibition: its footer bans reproduction, CORP blocks hotlinking, and its Digimon notice attacks sites that reuse images. | If Bandai says yes, the images are Bandai's own 600×838 PNGs, keyed `OP17-001` / `_pN`. Base cards join on set + number; parallels need name matching against TCGplayer product names. |
| **Lorcana** | **Lorcast**, under option 2, or placeholders. It is the freshest and has the cleanest join. | Join `tcgplayer_id` = `cards.tcgplayer_id`. Fall back to `set.code` + `collector_number`. Store `large` AVIF (674×940). Keep a request delay of 50–100 ms. Lorcast's own stance ("prohibited from charging you to use or access this content") matches free pages only. Avoid LorcanaJSON and lorcana-api.com image URLs: they point at Ravensburger's private app CDN. |
| **MTG (later)** | **Scryfall.** It is the only source whose rights holder permits fan-site use, via the FCP. | Join `scryfallId` → `id` (or `tcgplayerId` → `/cards/tcgplayer/:id`), using bulk data. Free pages only, with the FCP notice verbatim. No mana-symbol or MTG logos. For images inside paid screens, get WotC's written approval. |

---

## 9. Risks and open questions

1. **No commercial license exists for any launch game** (§2.7, §3.6, §4.4). Every option except "no images" or "written permission" is unlicensed copyright use that rights holders tolerate but can end at any time.
   - Bandai has said publicly that it never licensed sites and apps that reuse Digimon images ([Digimon Card Game](https://world.digimoncard.com/)). One Piece is the highest risk.
2. **DMCA safe harbor does not cover images we ingest ourselves** [INFERENCE].
   - §512(c) protects service providers for material "users… post or store" and requires a designated agent registered with the Copyright Office ([DMCA directory](https://www.copyright.gov/dmca-directory/), [17 U.S.C. §512](https://www.copyright.gov/title17/92chap5.html#512)).
   - Catalog images we fetch and host are our own acts, so a takedown process lowers the practical risk but gives no legal shield.
   - User-uploaded photos would qualify for the safe harbor if we register an agent.
3. **Paid screens.** Portfolio thumbnails in Pro make the images part of a paid feature.
   - Scryfall's test ("end-users should be able to access card data anonymously or with free accounts") can still pass while the card pages stay free.
   - WotC's FCP ("F-R-E-E", "only permits noncommercial activities") and TPCi's "charging a fee for access" language point the other way.
   - **Decision needed:** text-only Pro screens, or ask each publisher.
4. **"Licensed only, no scraping."** TCGdex, Lorcast, optcgapi and Limitless all get their images from publisher sites or apps whose terms forbid scraping (Ravensburger ToU, pokemon.com ToS (v), Bandai's footer).
   - Using them keeps our own hands clean of scraping, but not the spirit of the rule [INFERENCE].
   - **Decision needed:** does "licensed only" extend to images?
5. **Fragile upstreams.**
   - TCGdex, Lorcast and optcgapi are hobby projects with no ToS, no SLA and no stated image rules. optcgapi runs on one person's VPS ([docs](https://optcgapi.com/documentation)).
   - Lorcast warns its URL structure may change ([images](https://lorcast.com/docs/api/images)).
   - LorcanaJSON depends on a private Ravensburger API and credential.
   - *Mitigation:* re-host, store the source URL, and treat `image_url` as optional everywhere. The UI already has a placeholder.
6. **Join quality.**
   - TCGdex admits some third-party ids are wrong ([FAQ](https://tcgdex.dev/faq)).
   - One Piece parallels have no deterministic id mapping (§3.7).
   - JP Pokémon lacks TCGplayer ids in TCGdex.
   - JustTCG set ids are slugs (e.g. `mcdonald-s-promos-2014-pokemon`), so every set + number fallback needs a hand-checked set map.
   - *Mitigation:* join on `tcgplayerId` first, and log unmatched cards instead of guessing.
7. **Unverified items:**
   - JustTCG's One Piece `number` format.
   - Whether Lorcast has non-English cards.
   - TCGGO's RapidAPI terms and TCGplayer-id field.
   - The terms of the Impact affiliate contract.
   - The right Ravensburger licensing contact.
   - Whether TPCi, Bandai or Ravensburger would grant a license on request.
8. **Open outreach, cheapest first:**
   1. Ask JustTCG about its "commercial image partnerships" ([llms.txt](https://justtcg.com/llms.txt)). It is already our vendor.
   2. Bandai Card Games inquiry form (One Piece).
   3. Ravensburger (Lorcana).
   4. WotC support, for images in paid screens (MTG, later).
   5. Scrydex, whose authorization request (already parked) would cover prices and images for Pokémon EN/JA, One Piece and Lorcana but not the publishers' rights.
   6. TPCi. Its stated policy is to decline.
