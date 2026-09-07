# Quality assessment — runde 4 retting (Simple saving / `create_club_v3`)

Dato: 7. september 2026

## Arbeidsgrunnlag

- Branch: `design/club-dashboard-spike`
- Avtalt baseline: `46b0654fe241d8480e5bda9ed7ff3213ef2f40c6` (`fix: make investment cycles deterministic`)
- Opprinnelig Simple saving-migrering, uendret: `supabase/migrations/20260907192616_single_fund_club_v1.sql`
- Ny korrigerende migrering, opprettet med Supabase CLI: `supabase/migrations/20260907203455_single_fund_club_rectification_v1.sql`
- Ingen commit, push, deploy eller ekstern migrering i denne runden.
- Lokal hoveddatabase `postgres` ble ikke resatt.
- Custom strategy, markedsdata, NAV og brokerhandel er ikke implementert.
- Node: `v22.23.2`

## Rettelser per reviewerfunn

### 1. Create Club-utkast per profil

Global nøkkel `vesty.createClub.draft.v1` er erstattet av `vesty.createClub.draft.v2.${profileId}`.

| Krav | Resultat |
| --- | --- |
| Nøkkelen inkluderer autentisert `profile_id` | `createClubDraftStorageKey(profileId)` |
| Profil A laster aldri draft, Flexible-beløp eller `clientCreationId` fra B | Last skjer bare fra profilnøkkelen |
| Auth-brukerbytte mens Create Club er montert | `CreateClubSession` remountes med `key={profileId}` |
| Utlogging | `AuthProvider` kaller `clearSignedOutUserStorage` med aktiv `profile_id` før sesjonen tømmes |
| Vellykket opprettelse | `clearCreateClubDraft` på riktig profilnøkkel |
| Eksplisitt Discard / Start a new setup | Rydder profilnøkkelen og lagrer ny UUID |
| Vanlig navigering bort | Draften beholdes for samme profil |
| Gammel v1-nøkkel | Fjernes ved load/save/clear og vises aldri til ny bruker |
| Korrupt eller utdatert data | `parseStoredCreateClubDraft` returnerer `null`; `custom_portfolio` tvinges til `null` |

Auth importerer ikke Clubs-modulen. Oppryddingen går gjennom `clearSignedOutUserStorage` — en liten storage-grense som bare kjenner draft-nøklene.

Tester dekker profil A → logg ut → profil B, app-restart for samme profil, suksessrydding, eksplisitt discard, gammel global nøkkel, korrupt data og separat UUID per profil. Profilbytte mens skjermen er montert dekkes av remount-nøkkelen pluss draft-isolasjonstestene.

#### `vesty.selectedClubId`

Nøkkelen er fortsatt enhetsglobal. Oppgaven er ikke utvidet. `ClubsProvider.pickSelectedClub` velger bare en ID som finnes i `fetchActiveClubs(user.id)`. En fremmed klubb-ID fra en tidligere bruker blir ignorert, og valget faller tilbake til første klubb i den innloggede brukerens sett. Ved tomt sett fjernes nøkkelen.

### 2. Vei ut av `creation_conflict`

Submit er ikke lenger permanent deaktivert uten handling. Review viser konflikteksten og to knapper:

- **Go to clubs** — refresh av klubboversikten og `replace('/club')`
- **Start a new setup** — krever eksplisitt trykk, sender aldri create automatisk, nullstiller submit/error-state, rydder gammel draft, lager og lagrer ny UUID, og gjenbruker ikke den konfliktende fingerprinten eller request-ID-en

Interaksjonstester dekker timeout, endret payload, konflikt, begge handlinger og ny vellykket opprettelse.

### 3. Schedule og første periode i create

I den korrigerende migreringen kaller betrodd `private.create_club_v3`, etter klubb, membership, strategi og policy, `ensure_club_investment_schedule_v1` og deretter `advance_club_investment_cycles_v1(club, now())` i samme transaksjon.

- Standard: dag 5, `last_day_of_month`, `Europe/Oslo`, tre dagers konfigurasjonsfrist
- Klokken tas fra serveren, ikke klienten
- Advance hopper over innsett når fristen er passert og det ikke finnes historisk gyldig strategi, slik at en opprettelse midt i måneden ikke fryser en utløpt september-periode
- Identisk `clientCreationId` returnerer før schedule/advance — ingen ekstra schedule eller cycle
- Klientene leser fortsatt bare via `current_investment_day_v1` (F03/F04)

Lokalt opprettet **QA October Club** (`a5dec7fd-8c15-42d0-9b0b-3d033a4697c8`) 7. september 2026:

| Sjekk | Resultat |
| --- | --- |
| Aktive schedules | 1 (`active`, dag 5, `last_day_of_month`, `Europe/Oslo`, lead 3) |
| Cycles | 2, begge `upcoming` (`2026-10-05`, `2026-11-05`) |
| Utløpt/frosset september | Ingen |
| `current_investment_day_v1` | `upcoming` / `2026-10-05 10:00:00+00` |

Eldre `single_fund`-klubber opprettet før rettingen (**Test**, **The Latest Club**) har fortsatt 0 schedules.

### 4. `/dev/*` isolasjon

`shouldMountAuthenticatedAppProviders` unnlater ekte `AuthProvider` / `ProfileProvider` når `__DEV__` er true og stien er `/dev` eller `/dev/*`. Produksjon (`__DEV__` false) monterer alltid ekte auth; `/dev`-ruter redirecter allerede vekk.

På `/dev` brukes `InertAuthProvider` og `InertProfileProvider` uten `getSession`, `getUser`, profil, katalog eller RPC. ThemeProvider, SafeArea og lokal UI blir værende. `(app)/_layout` returnerer `null` på gallery-stien, slik at `useAuth` ikke krasjer når man kommer fra en innlogget app.

Målt Kong/auth/REST (forrige isolasjonsrunde, uendret kode):

| Tilfelle | Nettverk |
| --- | --- |
| Fersk start direkte til gallery | Ingen kong/auth/rest |
| Innlogget `/club` | `/auth/v1/user`, profiler, memberships, `current_investment_day_v1`, … |
| Innlogget app → gallery | Delta 0 |
| Gallery → `/clubs/new` | Forventede app-kall etter remount av ekte auth (user, profil, `single_fund_catalog_v1`) |

### 5. Tekst og låst tilstand

| Før | Etter |
| --- | --- |
| `One checked fund` | `One fund. One purchase in each member’s own account.` |
| `Loading checked funds…` | `Loading funds…` |
| `No checked funds yet` | `No funds are available right now` |
| Katalogfeil | `Unable to load funds` + **Try again** |
| Review | Ingen `Build your strategy is not enabled` |

Build your strategy er fortsatt låst på valgskjermen: låsikon, merkelapp `Available after initial testing`, opacity 1. VoiceOver-label er `Build your strategy. Available after initial testing`. `accessibilityState.disabled` er satt. Fokusrekkefølge: tilbake → Simple saving → låst kort → Continue.

`formatCheckedOn` formaterer gyldige `YYYY-MM-DD`-datoer til en-GB UTC, ikke bare `2026-09-07`. Ubrukt Storebrand-prototypekonstant og intern target-ID-eksport er fjernet. Klienten åpner bare serverleverte, allowlistede URL-er.

### 6. Broker-URL-regler

`private.is_allowed_single_fund_source_url` godtar bare HTTPS med host nøyaktig `www.dnb.no` eller `www.nordnet.no`. HTTP, lookalikes (`nordnet.no.example.com`) og userinfo-varianter avvises. Hjelperen er revokert fra PUBLIC/anon/authenticated. Samme regler finnes i `isAllowedSingleFundSourceUrl` på klienten. Database- og presentasjonstester dekker begge.

### 7. PostgREST schema-cache

Den korrigerende migreringen slutter med `NOTIFY pgrst, 'reload schema';` etter at RPC-signaturene er ferdige.

Deployrekkefølge (`docs/database-schema.md`):

1. Anvend migrering
2. Bekreft/reload PostgREST schema-cache
3. Verifiser katalog- og create-RPC
4. Distribuer klienten

Klienten viser fortsatt retrybar feil hvis RPC-en midlertidig mangler.

### 8. Visuell kontroll

Autentisert reise mot lokal Supabase på **iPhone 17 Pro** (402 × 874). Gallery-skjermbilder er tatt i Expo-web uten Expo Go-tannhjul.

Det blå tannhjulet på native-skjermbilder er Expo Go Dev Menu-FAB, ikke app-UI. Host-automatisering for å slå det av ble blokkert; gallery-skuddene er derfor de rene referansene for katalog, låst kort og konflikt.

| Bevis | Fil | Merknad |
| --- | --- | --- |
| Club name | `01-create-club-name.png` | Autentisert, native |
| Gruppetype + lesbart låst kort | `02-group-type.png` | Gallery, lock + merkelapp, opacity 1 |
| Fondskort, ny katalogtekst | `04-fund-card.png` | Gallery, `One fund. One purchase…` |
| Fondsdetaljer med åpent panel | `05-fund-details.png`, `12-gallery-fund-details.png` | Hide fund details, ISIN, DNB/Nordnet, ukjent NAV |
| Equal 2 000 kr | `06-contribution-equal.png` | Autentisert |
| Governance | `07-governance.png` | Autentisert |
| Review uten intern funksjonsstatus | `08-review-before-submit.png` | Autentisert «QA October Club» |
| Ferdig klubb med kommende Investment Day | `09-after-create.png` | **Next Investment Day: 5 October at 12:00**. Ikke `Date unavailable` |
| Konflikt: Go to clubs + Start a new setup | `10-conflict-go-to-clubs.png`, `11-conflict-start-new-setup.png` | Begge handlinger synlige |
| Katalogfeil + retry | `14-gallery-catalog-error.png` | `Unable to load funds` / Try again |
| Timeout-tekst | `15-gallery-submit-timeout.png` | Gallery |
| Flexible | `16-gallery-flexible.png` | Gallery |
| Låst kort på 375-bredde | `17-gallery-small-iphone.png` | Gallery |
| Stor tekst / review | `18-gallery-large-text.png` | Gallery |

QA October Club ble materialisert med samme autentiserte `create_club_v3` som appen (profil `cb8cd718-d567-4fcf-a056-fc78d8732947`, equal 200 000 minor). Dashboardet viser Simple saving, DNB Global Indeks A, 2 000 kr og 5. oktober.

### 9. Isolert replay og to-sesjonsprobe

`vesty_r4_replay` ble bekreftet som disposable review-database: ingen app, `DATABASE_URL` eller lokal Supabase-konfig pekte på den. Appen bruker `EXPO_PUBLIC_SUPABASE_URL` mot lokal API på **postgres**.

Replay fra baseline gjennom:

1. `20260907192616_single_fund_club_v1.sql`
2. `20260907203455_single_fund_club_rectification_v1.sql`

| Sjekk | Resultat |
| --- | --- |
| Isolert `single_fund_club_v1.test.sql` | **62/62** |
| To samtidige `create_club_v3` | Begge returnerte klubb `ae9e8ef3-1122-415f-bce6-a46b9a31438f` |
| Etter to-sesjon | 1 klubb, 1 allokering, 1 request, 1 schedule, 2 cycles (`upcoming` 5. okt og 5. nov) |
| Investment Day | `upcoming\|2026-10-05 10:00:00+00` |

`vesty_r4_replay` ble droppet etter positiv bekreftelse. Hoveddatabasen `postgres` er urørt (nå 10 `legacy_package` + 3 `single_fund`, inkludert QA October Club).

## Testresultater

Alle kommandoer under Node `v22.23.2`.

| Kommando | Resultat |
| --- | --- |
| `git diff --check` | Pass |
| Målrettede draft-/conflict-/gallery-/create-/schedule-tester | **72/72** |
| `pnpm test:packages` | **244/244** |
| `pnpm test:db` | **16 filer / 721 tester** |
| Isolert `single_fund_club_v1.test.sql` på replay | **62/62** |
| `pnpm test:market-data` | **46/46** |
| `pnpm test:fx` | **9/9** |
| `pnpm typecheck` | Pass |
| `pnpm lint` | Pass |

## Begrensninger

- Build your strategy er låst. Ingen custom-portfolio-backend.
- Ingen godkjent NAV-kilde. Live NAV og avkastningsserie vises ikke.
- Expo Go-tannhjulet dekker fortsatt native-skjermbilder. Gallery-web er uten tannhjul.
- Fondsdetalj med åpent panel er dokumentert fra gallery (samme `CreateClubJourney` som produksjon). Autentisert review og dashboard er native.
- `vesty.selectedClubId` er enhetsglobal, men valideres mot innlogget brukers klubbsett.
- Helg/helligdag-flytting, cron, versjonert rapportkorreksjon og multi-trade er uendret.
- Remote apply er ikke gjort.

## Ikke utført

- Commit, push, deploy
- Ekstern / Dashboard-migrering
- Reset av lokal Supabase / hoveddatabasen `postgres`
- Endring av `20260907192616_single_fund_club_v1.sql`
