# I Love Smash Burger — website

Website en online bestellen (afhalen) voor I Love Smash Burger, Amsterdam.

## Live zetten via GitHub Pages
1. Upload `index.html` en `.nojekyll` naar je GitHub-repository. **Alle foto's zitten in `index.html` zelf**, dus een aparte `img`-map is niet nodig.
2. Ga naar **Settings → Pages**.
3. Kies bij **Source** "Deploy from a branch", kies `main` en `/ (root)` en klik op **Save**.
4. Na ongeveer een minuut staat de site op `https://<gebruikersnaam>.github.io/<repo-naam>/`.

## Instellingen
Alles wat je kunt aanpassen staat in het `CONFIG`-blok bovenaan het `<script>` in `index.html`:
- `API_BASE`: het adres van de backend. Leeg = demomodus.
- `MADE_BY`: naam en link voor de credit in de footer.
- `GOOGLE` en `REVIEWS`: het Google-cijfer en echte reviews.
- `OPEN_MIN` / `CLOSE_MIN`: openingstijden in de demomodus.

Menu en prijzen staan in `ITEMS` en `SAUCES`. Zodra de backend gekoppeld is, haalt de site de prijzen daar vandaan (`backend/src/menu.js`).
