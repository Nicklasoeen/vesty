# Quality assessment — Create Club journey (runde 5)

Dato: 7. september 2026

## Arbeidsgrunnlag

- Baseline: `522af431ef83a225908627e5447b83c3f2ab7e8d` (`feat: add simple saving club creation`)
- Ingen ny generell review. Ingen migrering, API-, katalog- eller markedsdataendring.
- Ingen commit/push/deploy i selve implementasjonsrunden; checkpoint-commit kommer etter denne rapporten.
- Node: `v22.23.2`

## Produktrettelser i denne passeringen

### 1. Typografi samkjørt med Vesty

Create Club bruker `AppText` og eksisterende Theme-varianter (`display`, `hero`/`title`, `subtitle`, `body`, `bodyStrong`, `label`, `supporting`). Lokale overstyringer av `fontSize`, `lineHeight`, `fontWeight` og `letterSpacing` er fjernet der varianten dekker behovet. Ingen ny fontpakke. Ingen global token-endring i denne passeringen.

Native iOS (iPhone 17 Pro, Expo Go) er fasit. Overskrifter, klubbnavn og beløp matcher Home/Club: samme ink, paper og display/title-hierarki. Introen er fortsatt tydelig (`Small steps.` / `Together.` med `display` + mint på vektleggingen).

### 2. Avbryt fra hele flyten

- Tilbake er fortsatt steg-navigasjon.
- X i toppområdet forlater introen direkte.
- Etter at opprettelsen er startet, åpner X et bottom sheet: `Save and leave`, `Discard setup`, `Keep creating`.
- `Discard setup` kaller bare `clearCreateClubDraft` for aktiv profil. Den mints ikke ny `clientCreationId` og bruker ikke `Start a new setup`.
- Ingen avslutning kaller `create_club_v3`.
- X er deaktivert under innsending og skjult på bekreftet suksess.
- Review-spesifikk `Discard setup` er fjernet.

## Native visuell kontroll (`/clubs/new`)

Kort sjekk i ekte iOS-reise, ikke web:

| Flate | Resultat | Bevis |
| --- | --- | --- |
| Typografi mot Home/Club | Samme ink/paper og display/title-retning | Simulator Home + `21-native-wizard-chrome.png` |
| Topp: tilbake, logo, fremdrift, X | Tilbake og X er adskilt. `N of 6` ligger ved progress, ikke i knapperaden | `21-native-wizard-chrome.png` |
| Intro med X | X lukker uten sheet. Wordmark bevart | `22-native-intro-x.png` |
| Leave-sheet på liten skjerm | Tre handlinger lesbare, backdrop, Keep creating som avbryt | `17-native-leave-sheet.png` |
| Langt klubbnavn | `title`-variant, bryter over flere linjer | `18-native-long-name.png` |
| Suksess | Ingen X. `Invite members` og `Go to club` | `19-native-success-no-close.png` |
| Tastatur | `KeyboardAvoidingView` på skjermen. Sheet kaller `Keyboard.dismiss`. Live tap-fokus i Simulator ble ikke fullført (klikkmapping mot Expo Go var upålitelig) | kode + sheet |

Ingen `create_club_v3`-kall i denne visuelle passeringen.

## Tester kjørt

- `git diff --check` — rent
- Målrettede Create Club-tester (clubs + gallery fixtures) — 60/60
- `pnpm typecheck` — OK
- `pnpm lint` — OK

Full pakke- og databasesuite ble ikke kjørt på nytt.
