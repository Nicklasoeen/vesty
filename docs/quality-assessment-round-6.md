# Quality assessment — runde 6 (Nordnet Investment Day-overlevering)

Dato: 8. september 2026

## Arbeidsgrunnlag

- Branch: `design/club-dashboard-spike`
- Baseline: `8a387a85d0f755a6f756da6281f8ce4ad07082d0` (`feat: redesign create club journey`)
- Ny migrering, opprettet med Supabase CLI: `supabase/migrations/20260908072728_investment_day_broker_handoff_v1.sql`
- Ingen push, deploy eller ekstern migrering.
- Månedlig sparing, DNB-overlevering, NAV, markedsdata, grafer og broker-sync er ikke del av leveransen.
- Node: `v22.23.2`

## Funksjon

Et aktivt medlem i en Simple saving-klubb kan på Investment Day se fondet og sitt planlagte beløp, åpne den verifiserte Nordnet-produktsiden, gjennomføre kjøpet selv hos Nordnet, og deretter rapportere via eksisterende F01/F02.

Vesty oppretter ikke ordre, overfører ikke penger og hevder ikke at kjøpet er gjennomført. Åpning av lenken skriver ikke deltagelse, kjøpsrad eller Investment Day-rapport. `Report this Investment Day` er tilgjengelig uten at Nordnet åpnes.

Lenken som brukes er den verifiserte HTTPS-produktsiden:

`https://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894`

Ingen `nordnet://`, ingen medlemsbeløp i URL-en, ingen meglernøkler, innlogging eller cookies i Vesty. iOS velger selv om lenken forblir i Safari eller går til Nordnet-appen.

Foretrukket megler som ikke er Nordnet får en ærlig «ikke i denne testversjonen»-tilstand. Andre meglere er uendret i profilinnstillingene.

`/dev/investment-day-handoff` har **UI preview** (lokale fixtures, ingen Linking) og **Real Nordnet test** (samme produksjonskort, ekte `Linking.openURL` etter eksplisitt trykk). Galleryen er isolert fra auth og Supabase.

## Sikkerhetsgrenser

- `investment_day_broker_handoff_v1` er lesende. Den krever autentisert bruker, aktivt klubbmedlemskap og fryst deltagelse i syklusen.
- Fondet løses fra syklusens fryste strategi. Listing må være aktiv, `nordnet` og `is_verified`, og URL-en må være HTTPS med host nøyaktig `www.nordnet.no` uten userinfo.
- Returfelt: `status`, `broker`, `fund_name`, `isin`, `product_url`, `checked_on`. Ingen medlemsbeløp, andre medlemmers data eller katalog-ID-er.
- Ubekreftet, inaktiv eller manglende listing returneres som `unavailable` uten URL.
- `EXECUTE` på `private.investment_day_broker_handoff_v1` og `private.is_allowed_nordnet_handoff_url` er trukket fra `PUBLIC`, `anon` og `authenticated`. Klienten har bare den public wrapperen.
- Klienten validerer URL-en på nytt før `Linking.openURL`.
- `AppState` viser `Welcome back` bare etter vellykket åpning. Tilfeldig bakgrunn/forgrunn markerer ikke kjøp.

## Tester

| Kontroll | Resultat |
| --- | --- |
| `git diff --check` | Rent |
| Målrettet pgTAP `investment_day_broker_handoff_v1.test.sql` | 31/31, Result: PASS |
| Full lokal databasesuite (`pnpm test:db`) | 17 filer, 752/752, Result: PASS |
| `pnpm test:packages` | 289/289 (ingen ny kode etter dette) |
| `pnpm typecheck` | Bestått (ingen ny kode etter dette) |
| `pnpm lint` | Bestått (ingen ny kode etter dette) |

Klienttester dekker riktig URL, avvisning av lookalikes/`nordnet://`/userinfo, at åpning ikke skriver rapport, at retur krever ekte åpning, retry ved lenkefeil, rapportering uten Nordnet, ærlig utilgjengelig annen megler, og at gallery-preview aldri kaller Linking.

## Telefonkontroll

Gjennomført på fysisk iPhone mot den offisielle produktsiden for DNB Global Indeks A:

| Sjekk | Resultat |
| --- | --- |
| Riktig Nordnet-produktside åpnet | Ja |
| Retur til Vesty | Ja |
| Ingen ordre opprettet av Vesty | Ja |
| Ingen Investment Day-rapport skrevet ved åpning | Ja |
| DNB-fondsside kontrollert separat | Ja, men DNB-overlevering er ikke i denne leveransen |

## Begrensninger som gjenstår

- Bare Nordnet har direkte overlevering. DNB, Kron, SpareBank 1 og Other åpnes ikke fra Vesty.
- Vesty vet ikke om kjøpet ble gjennomført hos megleren. Medlemmet må rapportere via F01/F02.
- Månedlig spareavtale er ikke implementert.
- Ingen broker-sync, NAV, markedsdata eller automatisk ordreutførelse.
