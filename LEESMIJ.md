# I Love Smash Burger – website en bestelsysteem

Alles in één map.

| Map | Wat erin zit |
|---|---|
| `website/` | De website: `index.html` (met alle foto's erin) en `.nojekyll`. Klaar voor GitHub Pages. |
| `backend/` | Het bestelsysteem en het dashboard voor de eigenaar (Cloudflare Workers + database). Volledige handleiding in `backend/README.md`. |
| `logo/` | Het logo met transparante achtergrond (PNG en WebP), voor socials of drukwerk. |
| `fotos-uitgeknipt/` | Alle productfoto's zonder achtergrond, in hoge kwaliteit (PNG), voor Instagram of flyers. |

## In het kort live zetten

1. **Website:** upload `index.html` en `.nojekyll` uit `website/` naar je GitHub-repo. De foto's zitten in het bestand zelf. Zet daarna GitHub Pages aan.
2. **Backend:** volg `backend/README.md`. Kort gezegd: maak een Cloudflare-account, maak de database aan met `--location=weur`, stel de pincode in en voer `npm run deploy` uit.
3. **Koppelen:** zet het adres van de backend bij `API_BASE` bovenaan het script in `website/index.html` en upload die opnieuw.
4. **Testen** in testmodus, met de nep-betaalpagina. Daarna de **SumUp-sleutel** van de eigenaar erin zetten en `SUMUP_MODE` op `"live"`.

## Nog na te lopen met de eigenaar

- **Prijzen en menu:** overgenomen van de officiële menukaart (zonder corndog). Aanpassen in `backend/src/menu.js`; de website neemt ze daarvandaan over.
- **Drinken:** staat niet op de menukaart en is daarom van de site gehaald. Verkoopt hij wel drankjes, dan kunnen ze er zo weer bij.
- **Sauzen bij wings en tenders:** nu betaalt de klant de dip apart. Zit er bij hem een dip bij de prijs inbegrepen, dan is dat één regel (`inclSauce: true`).
- **Productomschrijvingen:** de burgers komen van de menukaart; de loaded fries zijn beschreven aan de hand van de foto's. Laat hem ze even nalezen.
- **Allergenen:** verplicht bij online verkoop van eten. Via het intakeformulier opvragen.
- **Google-reviews:** het cijfer en een paar echte reviews kunnen er nog in (`GOOGLE` en `REVIEWS` bovenaan het script).
- **Footer-credit:** vul je eigen naam in bij `MADE_BY` bovenaan het script.
