# Quality assessment — rettingsrunde 1

Dato: 7. september 2026

## Arbeidsgrunnlag

- Branch: `design/club-dashboard-spike`
- Start- og slutt-HEAD: `17ef642f32e18c0a20bcac2475dccb1dddb8f865`
- Vurderingsbaseline: `2c2e30d5e13b65f012b68b64bf443ae016673b9c`
- Leveranseform: lokale, ucommittede endringer

Repoet hadde omfattende lokale endringer før rettingsrunden. De ble bevart.
Denne runden endret bare F05–F07 og tilhørende tester og dokumentasjon.

## Kontroll av F01–F07

| Funn | Status etter kontroll og retting | Bevis og avgrensning |
| --- | --- | --- |
| F01 | Fortsatt til stede etter runde 1; lukket i runde 2 | Se `docs/quality-assessment-round-2.md`. |
| F02 | Fortsatt til stede etter runde 1; lukket i runde 2 | Se `docs/quality-assessment-round-2.md`. |
| F03 | Lukket i runde 3 | Se `docs/quality-assessment-round-3.md`. |
| F04 | Lukket i runde 3 | Se `docs/quality-assessment-round-3.md`. |
| F05 | Rettet i denne runden | Den nye migreringen fjerner `club_estimated_portfolio_v1` og `club_portfolio_history_v1`, inkludert private implementasjoner. Tre bidragsytere åpner derfor ikke lenger en direkte API-bane til klubbens pengesummer eller avledede avkastning. Egne medlemsprojeksjoner og sosial deltagelse består. |
| F06 | Rettet innenfor tilgjengelige projeksjoner | Egen medlemsprojeksjon hadde allerede all-or-nothing-verdsetting. Ny regresjon bekrefter at én manglende nødvendig kurs gir ukjent totalverdi og avkastning, mens rapportert investert beholdes separat. Den feilaktige klubbtotalbanen ble fjernet som del av F05. |
| F07 | Rettet i denne runden | Hook, presentasjon og UI skiller loading, kjent tom portefølje, tilgjengelig verdi, utilgjengelig verdi og forespørselsfeil med retry. Ukjent markedsverdi faller ikke lenger tilbake til investert beløp. |

## Endret oppførsel

Før:

- En Flexible-klubb med minst tre bidragsytere kunne hente eksakte
  klubbaggregater direkte.
- Én manglende kurs kunne gi en umerket delsum i den gamle klubbtotalen.
- `2 000 kr` rapportert investert kunne vises som porteføljens verdi når
  markedsverdien var ukjent.
- Nettverksfeil kunne se ut som en tom portefølje på `0 kr`.
- Home hevdet verdi på tvers av alle klubber selv om modellen bare dekker
  støttede ETF-klubber.

Etter:

- Autentiserte klienter har bare egne pengeprojeksjoner; klubbens pengesum og
  pengehistorikk er ikke en API-flate.
- En komplett medlemsverdi og tilhørende avkastning er utilgjengelig dersom
  én nødvendig kurs mangler.
- Home og Club viser `Value unavailable` og kan fortsatt vise
  `Reported invested` separat.
- En forespørselsfeil viser en egen melding og `Try again`; en kjent tom
  portefølje viser fortsatt `0 kr`.
- Home beskriver omfanget som støttede ETF-klubber.

## Endrede filer i denne runden

Database:

- `supabase/migrations/20260907080226_remove_club_money_aggregates_v1.sql`
- `supabase/tests/fx_portfolio_modelling_v1.test.sql`

Mobil:

- `apps/mobile/src/features/portfolio/useMemberPortfolio.ts`
- `apps/mobile/src/features/home/presentHomePortfolio.ts`
- `apps/mobile/src/features/home/HomePortfolioCard.tsx`
- `apps/mobile/src/features/home/HomeScreen.tsx`
- `apps/mobile/src/features/home/homePresentation.test.ts`
- `apps/mobile/src/features/club-dashboard/presentClubDashboard.ts`
- `apps/mobile/src/features/club-dashboard/presentClubDashboard.test.ts`
- `apps/mobile/src/features/club-dashboard/ClubOverview.tsx`
- `apps/mobile/src/features/club-dashboard/ClubDashboardScreen.tsx`

Kontraktdokumentasjon:

- `docs/security-authorization.md`
- `docs/market-data.md`
- `docs/database-schema.md`
- `docs/domain-model.md`
- `docs/design-system-v2.md`
- `docs/quality-assessment-round-1.md`

`HomeScreen.tsx`, `ClubDashboardScreen.tsx`,
`presentClubDashboard.ts`, `presentClubDashboard.test.ts` og
`docs/database-schema.md` hadde lokale endringer fra før. Rettelsen ble lagt
oppå disse uten å fjerne nyere funksjonalitet.

## Verifikasjon

Kjøremiljø: Node `v22.23.2`, pnpm `11.25.0`.

| Kontroll | Resultat |
| --- | --- |
| Målrettet F05/F06-databasetest | Bestått: 37 av 37 |
| Målrettede Home/Club-presentasjonstester | Bestått: 43 av 43 |
| `pnpm test:packages` | Bestått: 180 av 180 |
| `pnpm test:market-data` | Bestått: 46 av 46 |
| `pnpm test:fx` | Bestått: 9 av 9 |
| `pnpm typecheck` | Bestått |
| `pnpm lint` | Bestått med 0 feil og 2 eksisterende `exhaustive-deps`-advarsler i `InvestScreen.tsx` |
| Lokal databaselint, `public,private`, fail-on error | Bestått uten feil; eksisterende type-/variabeladvarsler står igjen i fire eldre funksjoner |
| `pnpm test:db` | Ikke fullstendig grønn: 516 av 519 bestått |

De tre databasefeilene er i den eksisterende
`investment_day_participation_v1.test.sql`: forventet streak 4, 4 og 1, men
fikk 3, 3 og 0. Filen feiler likt når den kjøres alene. Den berører F03/F04,
ikke migreringen eller F05–F07, og ble derfor ikke endret i denne runden.

Migreringen ble brukt på den eksisterende lokale Supabase-databasen og vises i
lokal migreringshistorikk. Ingen database-reset eller rent migreringsreplay ble
utført, fordi miljøet også brukes av pågående arbeid.

Expo web startet og nådde innloggingsskjermen. De berørte autentiserte
Home/Club-tilstandene kunne ikke inspiseres visuelt uten å opprette ny konto og
testdata. Visuell verifikasjon av disse tilstandene er derfor ikke utført;
presentasjonsregresjoner, lint og typecheck dekker den lokale kontrollen.

## Data og gjenværende begrensninger

- Ingen historiske penge- eller deltagelsesrader ble slettet eller omskrevet.
  Migreringen fjerner bare utrygge, ubrukte funksjonsflater.
- Eksisterende klienter som kaller de fjernede klubbaggregatene vil få manglende
  RPC. Gjeldende mobilkode hadde ingen slike kall.
- Rettelsen beholder ikke siste gyldige verdi ved nettverksfeil. Den viser en
  eksplisitt feil med retry, så ingen gammel verdi trenger foreløpig
  tidsmerking.
- Delvis verdsetting/dekningsgrad er ikke innført. Én manglende nødvendig input
  gjør hele totalverdien og avkastningen utilgjengelig.
- En eventuell fremtidig delingsmodell for klubbverdi, også for Equal-klubber,
  krever en separat produkt- og personvernbeslutning.
- F01/F02 er lukket i rettingsrunde 2. F03/F04 er lukket i rettingsrunde 3. Planleggeren, grafens 400-dagersgrense og komplett visuell/enhetsbasert brukerreise står igjen til senere runder.

Ingen commit, push, ekstern migrering eller deploy ble utført.
