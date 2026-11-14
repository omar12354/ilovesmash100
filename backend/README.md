# I Love Smash Burger – bestel-backend

De backend achter de website: bestellingen opslaan, betalen via SumUp en een dashboard voor de eigenaar.
Draait op **Cloudflare Workers** met een **D1-database**. Voor de hoeveelheid bestellingen van één zaak valt dit binnen het gratis abonnement van Cloudflare.

**Wat het doet**
- Het menu en de prijzen staan op de server (`src/menu.js`). De website laadt ze daarvandaan, en de server rekent elke bestelling zelf na, zodat niemand de prijs kan aanpassen.
- Alleen **afhalen**. De klant kiest "zo snel mogelijk" of een tijdslot, binnen de openingstijden.
- Betalen **online via SumUp** of **bij afhalen** (dat laatste is uit te zetten).
- **Dashboard** op `/dashboard`:
  - inloggen met een pincode;
  - geluid bij een nieuwe bestelling;
  - knoppen Accepteren → Klaar → Opgehaald;
  - een bon printen;
  - online bestellen pauzeren;
  - een export voor de boekhouder.
- De klant ziet de status van zijn bestelling live op de site.
- **Privacy (AVG):** namen, telefoonnummers en e-mailadressen worden na 30 dagen automatisch gewist. De bedragen blijven bewaard voor de boekhouding.
- **Testmodus** (`SUMUP_MODE = "mock"`): een nep-betaalpagina, zodat je alles kunt laten zien zonder echte betalingen.

---

## 1. Eenmalig klaarzetten

1. Maak een gratis account aan op **dash.cloudflare.com**.
2. Installeer **Node.js** (de LTS-versie) via nodejs.org.
3. Open een terminal in deze map en voer uit:
   ```bash
   npm install
   npx wrangler login
   ```
   (Er opent een browser waarin je Cloudflare toegang geeft.)

## 2. Database aanmaken

```bash
npx wrangler d1 create ilovesmash --location=weur
```
(`--location=weur` zet de database in West-Europa. Dat is netjes voor de AVG, omdat de klantgegevens dan in de EU blijven.)
Kopieer de `database_id` die je terugkrijgt naar `wrangler.toml`, bij `database_id = "..."`. Maak daarna de tabellen aan:
```bash
npm run db:init
```

## 3. Instellingen

Pas in **`wrangler.toml`** bij `[vars]` aan:
- `SITE_URL`: het adres van de website, bijvoorbeeld `https://omar12354.github.io/ilovesmash/`.
- `ALLOWED_ORIGIN`: hetzelfde adres, maar zonder het pad, bijvoorbeeld `https://omar12354.github.io`.
- `SUMUP_MODE`: laat dit eerst op `"mock"` staan.

Zet de geheime waarden (die komen **niet** in een bestand):
```bash
npx wrangler secret put DASHBOARD_PIN      # pincode voor het dashboard, bijv. 6 cijfers
npx wrangler secret put SESSION_SECRET     # lange willekeurige tekst, bijv. 40 tekens
```

## 4. Online zetten

```bash
npm run deploy
```
Je krijgt een adres zoals `https://ilovesmash-api.<jouw-naam>.workers.dev`. Dat is de backend.

## 5. Website koppelen

Open `index.html` van de website. Zet bovenaan in het script:
```js
const API_BASE = "https://ilovesmash-api.<jouw-naam>.workers.dev";
```
Upload `index.html` opnieuw naar GitHub. Vanaf nu gaan bestellingen naar de backend.

## 6. Testen (testmodus)

1. Bestel iets op de website en kies **Online betalen**. Je komt op de testbetaalpagina.
2. Klik op "Testbetaling geslaagd". Je komt terug op de site en ziet je bestelnummer.
3. Open `https://ilovesmash-api.<jouw-naam>.workers.dev/dashboard` en log in met de pincode. De bestelling staat bij **Nieuw**.
4. Klik op Accepteren en daarna op Klaar. Op de site ziet de klant binnen ongeveer 8 seconden "Je bestelling staat klaar!".

## 7. Live met SumUp

Dit doet de **eigenaar zelf**, in zijn SumUp-account:
1. Zijn account moet volledig geverifieerd zijn.
2. In het SumUp-dashboard bij de ontwikkelaarsinstellingen: maak een **API-sleutel** aan en noteer de **merchant code** (die begint met `M`).
3. Laat iDEAL voor online betalen aanzetten via SumUp-support.

Daarna, **samen** in de terminal (niet via WhatsApp of e-mail sturen):
```bash
npx wrangler secret put SUMUP_API_KEY
npx wrangler secret put SUMUP_MERCHANT_CODE
```
Zet in `wrangler.toml` `SUMUP_MODE = "live"` en voer `npm run deploy` uit.
Doe daarna één echte testbestelling met een goedkoop product en betaal die terug in het SumUp-dashboard.

**Let op iDEAL:** de backend gebruikt de **Hosted Checkout** van SumUp (de betaalpagina van SumUp zelf). Volgens SumUp toont die pagina in elk geval kaart, Apple Pay en Google Pay. Of iDEAL daar ook verschijnt, hangt af van zijn account. Zie je iDEAL na het aanzetten niet, dan kan de betaalstap omgezet worden naar de Payment Widget van SumUp, die iDEAL wel ondersteunt.

## 8. Dagelijks gebruik (voor de eigenaar)

- Open het dashboard op een tablet of telefoon en kies **"Zet op beginscherm"**. Dan werkt het als een app.
- Tik na het inloggen één keer op de gele balk, zodat het **geluid** aangaat. Browsers vragen daar zelf om.
- **Online bestellen: AAN/GEPAUZEERD**: pauzeer bijvoorbeeld bij drukte op ArenA-dagen.
- **Bon**: print de bestelling. Werkt met een bonprinter die als printer aan de tablet of computer gekoppeld is.
- **Export (maand)**: een CSV-bestand voor de boekhouder, zonder klantgegevens.

## 9. Menu of prijzen aanpassen

Alles staat in **`src/menu.js`**: producten, prijzen (in centen), sauzen, de "zonder"-opties, openingstijden en sluitingsdagen.
- `combo`: de meerprijs voor een combo (friet + een saus naar keuze, de saus zit erbij). Burgers +€5, hotdog +€4.
- `inclSauce: true`: er zit één saus naar keuze bij de prijs (Friet met saus, 3 Tenders met friet).
- Extra sauzen kosten de prijs uit `SAUCES`.
- Product of saus tijdelijk uitverkocht: zet `available: false` erbij.
- Na een wijziging: `npm run deploy`. De website neemt de nieuwe prijzen direct over.

## 10. Optioneel: bevestigingsmails

Met een gratis account bij **resend.com** krijgen klanten een mail bij hun bestelling en als die klaar staat:
```bash
npx wrangler secret put RESEND_API_KEY
```
Zet `MAIL_FROM` in `wrangler.toml`, bijvoorbeeld `"I Love Smash Burger <bestellen@ilovesmashburger.nl>"`. Het domein moet bij Resend geverifieerd zijn.

## Lokaal ontwikkelen

```bash
cp .dev.vars.example .dev.vars
npm run db:init:local
npx wrangler dev --var SITE_URL:http://127.0.0.1:5500/ --var "ALLOWED_ORIGIN:*"
```
Het dashboard staat dan op http://127.0.0.1:8787/dashboard.

## Bestanden

| Bestand | Wat |
|---|---|
| `src/worker.js` | De backend: API, SumUp, dashboard-API, opschonen |
| `src/menu.js` | Menu, prijzen, openingstijden en instellingen |
| `src/dashboard.html` | Het dashboard voor de eigenaar |
| `schema.sql` | De database-tabellen |
| `wrangler.toml` | Cloudflare-instellingen |
