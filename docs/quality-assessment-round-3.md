# Quality assessment — rettingsrunde 3 (F03/F04)

Dato: 7. september 2026

## Arbeidsgrunnlag

- Branch: `design/club-dashboard-spike`
- Avtalt baseline: `f77771970dd34fad99adab4b84f67876a56a1889` (`fix: make investment reports reflect member-reported purchases`)
- HEAD etter runden: isolert lokal commit `fix: make investment cycles deterministic` over baseline.
- Kontrakt: `F03-F04-CYCLE-CONTRACT.md` pluss `docs/domain-model.md`, `docs/database-schema.md`, `docs/investment-architecture-v2.md`, `docs/security-authorization.md`, `docs/quality-assessment-round-1.md`, `docs/quality-assessment-round-2.md`
- Leveranseform: én avgrenset vertikal. Commiten er lokal og er ikke pushet.

F01/F02-kontrakten er bevart: rapportert kjøpsbeløp, proveniens, rapport-idempotens, `vesty.report_conflict`, personvern og tilbakekalte confirm-operasjoner.

## Kontroll av F03/F04

| Funn | Status | Bevis og avgrensning |
| --- | --- | --- |
| F03 | Rettet | Home, Club, Club settings og Invest leser `current_investment_day_v1`. Åpning av skjerm oppretter ikke periode, fryser ikke strategi/policy, skriver ikke deltagelse og endrer ikke periodestatus. `ensure_open_investment_day_v1` har ikke EXECUTE for `authenticated`/`anon`. |
| F04 | Rettet | Betrodd `advance_investment_cycles_v1` (`service_role`) genererer forekomster fra lagret plan, fryser roster atomisk ved konfigurasjonsfrist, åpner rapportering ved lokal 12:00 og lukker uten å gjenåpne vinduet. Sosial `member_count` / `completed_count` / `pending_count` / `all_completed` kommer fra fryste `member_cycle_participations`. |

## Korreksjoner etter separat review

- **Historisk freeze:** policy velges med `created_at <= configuration_deadline_at`, deterministisk på `created_at`, `version_number` og `id`. Strategi velges med `effective_at <= configuration_deadline_at`, deterministisk på `effective_at`, `version_number` og `id`. Det finnes ingen fallback til dagens versjon. Manglende historisk policy gir `vesty.contribution_policy_missing`; manglende historisk strategi gir `vesty.strategy_missing`. Begge feil ruller tilbake hele lifecycle-kallet og etterlater ingen delvis roster.
- **Schedule-revisjoner:** hver kandidatmåned evaluerer alle revisjoner. Én revisjon må være gyldig både ved sin beregnede konfigurasjonsfrist og forekomst. Gyldighetsintervallet er halvåpent: `[effective_from, effective_until)`. `effective_from` er inklusiv og `effective_until` eksklusiv. Den nyeste gyldige revisjonen velges deterministisk. En gyldig `paused`/`scheduled` revisjon blokkerer fallback til eldre aktiv plan. Historiske `replaced`/`ended`-revisjoner kan materialisere forekomster innenfor sitt historiske intervall.
- **Rapporteringsrace og retry:** cycle-raden låses `FOR UPDATE` i samme transaksjon som rapporteringen. Identisk ID/payload returneres før vindus- og statusavslag, uten DML. Endret payload med samme ID gir konflikt. Ny ID etter lukking gir `vesty.reporting_closed`. En `completed` cycle i et ellers gyldig tidsvindu gir `vesty.cycle_not_open`.
- **Privat flate:** alle private F03/F04-funksjoner har eksplisitte assertions mot `PUBLIC`, `anon` og `authenticated`. `private.club_investment_day_participation_v1(uuid, uuid)` er revokert. Den offentlige social-RPC-en er derfor gjort eksplisitt `security definer` med tom `search_path` og `row_security=off`. `private.member_investment_day_streak_v1` ender reproducerbart med `search_path=""` og `row_security=off`.
- **Flexible-save:** `isSubmitting` nullstilles i `finally`, uavhengig av remount eller endret viewer state. En deterministisk interaksjonstest dekker pending `Saving…`, suksess, ny lagring og feil.
- **Gallery:** `setup_required` og `setup_next` bruker lokal callback og faktisk produksjonsskjema. Gallery har fixtures for lang fonds-/klubbtekst, stor tekst, vellykket/mislykket save og setup som fortsatt gjelder neste periode.

## Endret oppførsel

Før:

- Klienten kalte en skrivende ensure-operasjon når Home, Club eller Invest ble åpnet.
- En tilfeldig gammel `open`-rad kunne gjenbrukes som «dagens» periode.
- Sen innmelding og sen Flexible-oppsett kunne komme med i inneværende fryste periode.
- Rapportering sjekket ikke `reporting_opens_at` / `reporting_closes_at` mot serverklokken i samme lås som F01/F02-skriveren.
- Sosial historikk kunne følge dagens medlemsliste.

Etter:

- Klienten leser `viewer_state`: `missing`, `upcoming`, `open`, `closed`, `not_in_snapshot`, `setup_next`, `setup_required`, `unavailable`.
- Livssyklusen eies av en betrodd jobb. Identitet er klubb + `occurrence_key` (lokal ISO-dato `YYYY-MM-DD` for nye rader). Unik `(club_id, occurrence_key)`.
- Investment Day er kl. 12 lokal tid i planens tidssone via Postgres `timestamp AT TIME ZONE`. `last_day_of_month` klemmer ugyldige dager. `configuration_lead_days` styrer fristen. Helg/helligdag flyttes ikke.
- Equal fryser alle medlemskap som var aktive ved fristen. Flexible fryser bare medlemmer med gyldig commitment `created_at <= frist`. Sen innmelding og sen Flexible-oppsett gjelder neste periode. Utmelding etter frys fjerner ikke historikken.
- `report_investment_day_v1` bruker bare server `now()`. Identisk retry etter stenging returnerer lagret rapport uten DML. Samme ID med endret payload konflikter; ny ID følger vindu og status.
- Mobilen viser kommende, åpen, stengt, manglende (retry uten å opprette), ikke i snapshot, Flexible neste dag, loading og forespørselsfeil. Serveren er autoritativ for om rapportering er tillatt.

## Endrede databaseflater

Migreringene skal anvendes i denne rekkefølgen:

1. `supabase/migrations/20260907123709_investment_day_cycle_lifecycle_v1.sql`
2. `supabase/migrations/20260907183623_investment_day_cycle_lifecycle_rectification_v1.sql`

- Kolonne `investment_cycles.roster_frozen_at`. Eksisterende rader ble satt til `coalesce(opened_at, created_at, now())`. Manglende deltagere ble ikke rekonstruert fra dagens medlemsliste.
- `private.investment_occurrence_at_v1` / `investment_occurrence_key_v1`
- `private.freeze_investment_cycle_roster_v1` (atomisk insert av kvalifiserte deltagelser, `created_at = configuration_deadline_at`)
- `private.advance_club_investment_cycles_v1` / `public.advance_investment_cycles_v1`
- `public.current_investment_day_v1` (ren lesing)
- `private.report_investment_day_at_v1` (testklokke, ikke klient)
- `private.club_investment_day_participation_at_v1` (snapshot-tellinger)
- Trigger mot omskriving av fryst policy/strategi / clearing av `roster_frozen_at`
- Korreksjonsmigreringen legger til historisk policy- og schedule-oppslag, erstatter freeze/advance/reporting, lukker private privilegier og gjør funksjonsinnstillingene eksplisitte.

## Klienttilgang og tilbakekalte privilegier

| Flate | `authenticated` | `service_role` | Merknad |
| --- | --- | --- | --- |
| `public.current_investment_day_v1` | EXECUTE | — | Lesing. Bruker server `now()`. |
| `public.report_investment_day_v1` | EXECUTE | — | Seks argumenter. Ingen `p_now`. |
| `public.club_investment_day_participation_v1` | EXECUTE | — | Snapshot, ingen beløp/antall/pris. |
| `public.advance_investment_cycles_v1` | revokert | EXECUTE | Planlagt/betrodd jobb. |
| `public.ensure_open_investment_day_v1` | revokert | — | Funksjonskropp ligger igjen; ikke klient-API. |
| `private.ensure_open_investment_day_v1` | revokert | — | |
| `private.report_investment_day_at_v1` | revokert | — | Bare interne/testkall. |
| `private.current_investment_day_v1` | revokert | — | |
| `private.club_investment_day_participation_v1` | revokert | — | Offentlig wrapper er `security definer`. |

Vanlige klienter kan ikke sende autoritativ klokke.

`authenticated` beholder `USAGE` på `private`. Den tilgangen brukes av eldre RLS-/helper-avhengigheter utenfor denne rettingsrunden. Å trekke hele schema-tilgangen ville vært en bred tilgangsendring. Det avgjørende kontrollpunktet er derfor håndhevet per funksjon: ingen private F03/F04-funksjoner kan utføres direkte av `PUBLIC`, `anon` eller `authenticated`.

## Migrering av eksisterende perioder

Konservativ: `roster_frozen_at` backfylles på lagrede sykluser. Deltagelsesrader som allerede ligger i `member_cycle_participations` er historisk grunnlag. Jobben legger ikke til manglende medlemmer fra dagens klubbliste på gamle rader.

Begge migreringene er anvendt på den eksisterende lokale databasen. Ingen eksisterende database ble resatt.

En separat database, `vesty_f03_f04_replay`, ble opprettet i den lokale Supabase-Postgres-instansen. Supabase CLI kunne ikke initialisere en vilkårlig database med `db reset --db-url` (`LegacyDbResetCancelledError`), så Supabase sine isolerte `auth`/`storage` pre-data-skjemaer og standard lokale privilegier/RLS ble etablert først. Deretter ble alle migreringer fra baseline-committen lest fra Git og anvendt i sortert rekkefølge. En ekte pre-F03 open cycle ble opprettet, før de to F03/F04-migreringene ble anvendt sekvensielt.

Replay-resultat:

- pre-F03-cyclen fantes før lifecycle-migreringen
- etter migrering var 1 av 1 eksisterende cycles policybundet og `roster_frozen_at` backfylt
- `roster_frozen_at`-kolonnen og unik club/occurrence-constraint fantes
- `private.member_investment_day_streak_v1` hadde `search_path=""` og `row_security=off`
- den målrettede lifecycle-suiten passerte 89 tester
- hele databasepakken passerte 15 filer / 659 tester
- den disponible databasen ble slettet etter kontrollen

Ingen ekstern apply eller deploy ble utført.

## To-sesjonsprobe

Proben brukte en egen lokal klubb med én kvalifisert medlemspost og fast klokke `2029-09-05 10:00:00+00`. Sesjon A tok den samme klubb-advisory-locken som lifecycle-funksjonen, ventet 1,5 sekunder, kjørte lifecycle og holdt transaksjonen ytterligere 0,5 sekund. Sesjon B startet 0,2 sekund etter A og kalte samme lifecycle-operasjon:

```sql
-- Sesjon A
begin;
select pg_advisory_xact_lock(hashtextextended(:club_id::text, 17));
select pg_sleep(1.5);
select public.advance_investment_cycles_v1(
  '2029-09-05 10:00:00+00',
  :club_id
);
select pg_sleep(0.5);
commit;

-- Sesjon B, startet mens A holdt låsen
select public.advance_investment_cycles_v1(
  '2029-09-05 10:00:00+00',
  :club_id
);
```

Begge sesjoner avsluttet med exit 0 og returverdi 1. Kontroll av forekomsten `2029-09-05` ga: én cycle, ett ikke-null `roster_frozen_at`, én schedule-, strategi- og policyreferanse, og én unik roster-rad på 177 000 minor units. Ingen delvis roster ble stående. Fixture-data ble slettet etter proben. pgTAP-harnessen bruker én transaksjon og støtter ikke ekte parallelle forbindelser, så den manuelle to-sesjonsproben er dokumentert i stedet for å late som en sekvensiell test er en concurrency-test.

## Klokke- og DST-kontrakt

- Sommer `Europe/Oslo` 5. september 2026 kl. 12:00 = `2026-09-05 10:00:00+00`
- Vinter `Europe/Oslo` 15. januar 2026 kl. 12:00 = `2026-01-15 11:00:00+00`
- 11:59:59 lokal tid er `upcoming`; 12:00:00 åpner
- Rapportering aksepteres ved åpning og ett sekund før lukking; avslås nøyaktig ved lukking
- 60 dager gammel `open`-rad gjenbrukes ikke; delayed job setter `completed` med `closed_at = reporting_closes_at`

Streak-tester bruker `tests.club_investment_day_participation_at_v1(..., p_now)` med fast tidspunkt, ikke veggklokke.

## UI-tilstander

Produksjonskomponenter: `InvestmentDayCycleStateView`, `InvestScreen`, Home, Club overview. Dev-gallery: `/dev/investment-day-reporting` med lokale fixtures, `maxWidth: 375`, ingen Supabase-kall.

Dekket: kommende noon, åpen rapportering, stengt vindu, manglende periode med retry, ikke i snapshot, lange fonds- og klubbnavn, stor tekst, Flexible `setup_next` / `setup_required`, vellykket save, feilet save, loading, timeout, konflikt, idempotent retry og request error.

Live gallery ble kontrollert ved CSS-viewport 375×812. `Saving…`/disabled var synlig mens det lokale løftet ventet; etter suksess og feil ble knappen aktiv igjen. En ny save fungerte uten remount, og `setup_next` forble synlig etter refresh-resultatet. Lang tekst brøt innenfor flaten uten horisontal overflow. Ressursloggen etter interaksjonene inneholdt 0 URL-er som matchet Supabase, auth, REST eller RPC.

## Verifikasjon

Kjøremiljø: Node `v22.23.2`.

| Kontroll | Resultat |
| --- | --- |
| `git diff --check` | Bestått |
| Målrettet F03/F04 lifecycle | Bestått: 89 tester |
| `pnpm test:packages` | Bestått: 217 av 217 |
| `pnpm test:db` | Bestått: 15 filer, 659 tester |
| `pnpm test:market-data` | Bestått: 46 av 46 |
| `pnpm test:fx` | Bestått: 9 av 9 |
| `pnpm typecheck` | Bestått |
| `pnpm lint` | Bestått |
| Visuell gallery 375×812 | Bestått, inkludert save/re-save/error og lange/større tekster |

Node-testene skriver eksisterende `MODULE_TYPELESS_PACKAGE_JSON`-advarsler; de påvirker ikke resultatet.

## Filer berørt av rettingsrunden

- Ny migrering: `supabase/migrations/20260907183623_investment_day_cycle_lifecycle_rectification_v1.sql`
- Lifecycle-regresjoner: `supabase/tests/investment_day_cycle_lifecycle_v1.test.sql`
- Historisk gyldighet i test-fixtures: de åtte øvrige endrede F01–F04 databasefilene under `supabase/tests/`
- Flexible-save: `apps/mobile/src/features/clubs/FlexibleContributionForm.tsx`, `flexibleContributionSubmission.ts` og `flexibleContributionSubmission.test.ts`
- Gallery: `InvestmentDayReportGalleryScreen.tsx`, `investmentDayReportGalleryFixtures.ts` og fixture-testen
- Denne rapporten

## Gjenværende begrensninger

- Helg- og helligdagsskift er ikke implementert.
- Ingen automatisk cron i dette arbeidet; `advance_investment_cycles_v1` må kalles fra et betrodd miljø.
- Versionert korreksjon av ferdige rapporter (F01/F02-rest) er uendret.
- Flere handler i samme instrument og periode (S27) er uendret.
- Gruppeprototype er ikke koblet til opprettelsesflyten.
- Ekte to-sesjons samtidighet er kontrollert manuelt, men ikke automatisert fordi pgTAP-harnessen kjører hver fil i én forbindelse/transaksjon.
- `saving_plan_id` er fortsatt NOT NULL; freeze skriver legacy-planrader som FK-artefakt, ikke som beløpsautoritet.

Commiten er lokal. Ingen push, deploy eller ekstern migrering er utført.
