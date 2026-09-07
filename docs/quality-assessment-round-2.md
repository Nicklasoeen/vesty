# Quality assessment — rettingsrunde 2 (F01/F02)

Dato: 7. september 2026

## Arbeidsgrunnlag

- Branch: `design/club-dashboard-spike`
- Avtalt checkpoint før runden: `1476f80 feat: prototype group mode creation flow`
- Vurderingskilder: `INVESTMENT-REPORTING-CONTRACT.md`, `QUALITY-ASSESSMENT.md` (F01/F02), `SCENARIOS.md` (S17, S19–S27)
- Leveranseform: ett isolert commit etter kontroll

Gruppeprototype og øvrige checkpoints ble bevart. Runden endret bare Investment Day-rapportering, proveniensvisning, native UUID-løsning, én ny migrering, kontraktsdokumentasjon og regresjonstester. F03/F04, nye gruppetyper og markedsdataarbeid ble ikke startet.

## Kontroll av F01/F02

| Funn | Status etter kontroll og retting | Bevis og avgrensning |
| --- | --- | --- |
| F01 | Rettet | `report_investment_day_v1` skiller plan, medlemsrapport og kjøpslinjer. `as_planned` lagrer fryst plan etter attestasjon som `member_attested_plan`. `with_changes` lagrer bare eksplisitte beløp som `member_reported_actual`. 2 000 kr plan med 1 400 kr rapportert gir nøyaktig 1 400 kr i linjer. Utelatt/null mål får ingen rad. `skipped` og `failed` gir null kjøp. Planbeløp brukes ikke som kostpris når bare antall er oppgitt. |
| F02 | Rettet | Direkte `authenticated` UPDATE på `member_cycle_participations` er fjernet. Rapport, transaksjoner og deltagelsesutfall skrives atomisk. Samme `client_report_id` er idempotent. Annen payload etter ferdig rapport gir `vesty.report_conflict` uten dataendring. Public/private confirm v1/v2 har ikke EXECUTE for `authenticated`. Klienten har ikke EXECUTE på den private reporteren. |

## Endret oppførsel

Før:

- Confirm v1/v2 skrev hele den fryste planen som kjøp.
- Klienten kunne oppdatere egen deltagelse uten kjøpsrader, eller sette `skipped` mens kjøp ble stående.
- Tekster kunne kalle planbaserte beløp «invested» eller «reported» uten kjent kilde.
- `crypto.randomUUID()` var ikke dokumentert i iOS/Android-runtime.

Etter:

- Medlemmet attesterer planen, rapporterer avvik, hopper over, eller utsetter pending uten serverkall.
- Kjøpslinjer finnes bare for `confirmed`.
- Egne flater merker `attested plan`, `reported`, `planned (assumed)`, `mixed basis` og `unverified`. Sosial deltagelse viser bare tillatt status.
- iOS/Android bruker `expo-crypto` `randomUUID`; samme `client_report_id` gjenbrukes i syklusen.

## Verifikasjon

Kjøremiljø: Node `v22.23.2`.

| Kontroll | Resultat |
| --- | --- |
| `git diff --check` mot `1476f80` | Bestått |
| `pnpm test:packages` | Bestått: 205 av 205 |
| `pnpm test:db` | Bestått: 14 filer, 561 tester |
| `pnpm test:market-data` | Bestått: 46 av 46 |
| `pnpm test:fx` | Bestått: 9 av 9 |
| `pnpm typecheck` | Bestått |
| `pnpm lint` | Bestått |
| Native UUID-smoke | iOS-bundle på Expo Go 57 bruker `generateClientReportId.native.ts` og `expo-crypto.randomUUID`. Ingen Android-emulator. |

Migreringen `20260907101905_investment_day_reporting_v1.sql` er brukt lokalt. Ingen reset, ekstern apply, push eller deploy.

## Data og gjenværende begrensninger

- Historiske transaksjoner ble ikke slettet. Eksisterende v1/v2-beløp er merket `legacy_plan_assumed` uten tillitsoppgradering.
- Versionert korreksjon av en ferdig rapport er gjenstående arbeid. Konfliktfeilen er tydelig.
- S27: to reelle handler i samme instrument i én periode. Unik nøkkel er fortsatt ett kjøp per medlemskap/syklus/mål.
- `broker_verified` er reservert.
- `client_report_id` lever i minnet for syklusen. Dobbelttrykk i samme økt er trygt; prosesskille kan gi ny ID.
- `failed` er serverstøttet, ikke et primærvalg i UI.
- `ExactHoldingsForm.tsx` er død kode og ikke en andreskrivesti.
- F03/F04 er lukket i runde 3. Se `docs/quality-assessment-round-3.md`.
