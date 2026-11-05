# DuuniCheck

DuuniCheck auttaa pitämään työnhaun hakemukset, tapahtumat, muistutukset, CV-versiot ja hakemuspohjat järjestyksessä. Sovelluksessa on myös hakemuskohtainen AI-chat.

## Ominaisuudet

- Yleiskatsaus hakemuksiin, lähetyksiin, haastatteluihin, hylkäyksiin ja vastausaikoihin
- Hakemusten lisäys, muokkaus, poisto, tilan vaihto ja päivämäärällinen tapahtumahistoria
- Etenemisen aikajana ja muistutuksilla täydennetty kalenteri
- CV-kirjasto, CV-versioiden muokkaus ja tulostus sekä hakemuspohjat
- Hakemuskohtaiset muistiinpanot ja CV- tai hakukirjetiedostojen liittäminen
- AI-chatin palvelinpuolella tallennettu keskusteluhistoria
- Clerk-kirjautuminen ja MongoDB Atlas -tallennus käyttäjäkohtaisella tietojen rajauksella
- Mobiiliresponsiivinen käyttöliittymä

AI-avustaja voi hakea valitun hakemuksen tietoja DuuniCheckin omasta tietokannasta. Tietokantahakuja ei välitetä OpenAI:lle. AI-ehdotuksia varten palvelin käyttää vain käyttäjän viestiä ja erikseen valittuja kontekstitietoja. Ehdotus ei muuta hakemusta ennen käyttäjän hyväksyntää. OpenAI-avain tarvitaan vain tätä ehdotustoimintoa varten.

## Vaatimukset

- Node.js ja npm
- MongoDB Atlas -tietokanta tai muu MongoDB, joka tukee transaktioita
- Clerk-sovellus kirjautumista varten
- OpenAI API -avain vain AI-ehdotuksia varten

## Paikallinen käyttöönotto

Tee frontendille ja backendille omat paikalliset `.env`-tiedostot esimerkkien pohjalta. Täytä salaisuudet suoraan omalla koneellasi tai palvelimen asetuksissa. Älä kopioi oikeita avaimia README-tiedostoon, lähdekoodiin tai versionhallintaan. `.env`-tiedostot on rajattu pois Gitistä.

### Backend

Kopioi `backend/.env.example` nimelle `backend/.env` ja täytä tarvittavat asetukset:

- `PORT`: backendin portti, oletuksena 5000
- `TRUST_PROXY`: `0` paikallisesti; `1` vain yhden luotetun välityspalvelimen takana
- `MONGODB_URI`: MongoDB-yhteysosoite
- `CLERK_SECRET_KEY` ja `CLERK_PUBLISHABLE_KEY`: Clerk-palvelimen avainpari
- `ALLOWED_ORIGIN`: frontendin sallittu alkuperä; useampi alkuperä pilkuilla erotettuna
- `CLERK_WEBHOOK_SIGNING_SECRET`: Clerkissä määritetyn webhookin allekirjoitusavain
- `OPENAI_API_KEY`: valinnainen avain AI-ehdotuksia varten
- `OPENAI_MODEL`: käytettävä OpenAI-malli
- `CLERK_TELEMETRY_DISABLED`: telemetrian asetuksen yhteensopivuusmuuttuja

Käynnistä backend:

```powershell
cd backend
npm install
npm run dev
```

Backend vastaa oletuksena osoitteessa `http://localhost:5000`. Terveystarkistus on `GET /api/health`.

### Frontend

Kopioi `frontend/.env.example` nimelle `frontend/.env` ja aseta Clerk-julkaisijavain. Frontendin asetukset ovat:

- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk-julkaisijavain
- `VITE_CLERK_TELEMETRY_DISABLED`: Clerk-telemetrian asetus
- `VITE_API_URL`: backendin osoite, paikallisesti tavallisesti `http://localhost:5000`
- `VITE_CLERK_PRODUCTION_URL`: tuotantoympäristön Clerk-osoite tarvittaessa
- `VITE_SUPPORT_EMAIL`: käyttöliittymässä näytettävä tukiosoite tarvittaessa

`VITE_`-asetukset näkyvät selaimessa. Älä laita niihin salaisia avaimia.

Käynnistä frontend toisessa terminaalissa:

```powershell
cd frontend
npm install
npm run dev
```

Vite näyttää paikallisen osoitteen käynnistyksen yhteydessä, tavallisesti `http://localhost:5173`.

## Clerk-webhook ja tietojen poisto

Määritä Clerkissä webhook osoittamaan backendin reittiin `/api/webhooks/clerk` ja tilaa käyttäjän poistotapahtuma `user.deleted`. Aseta webhookin allekirjoitusavain backendin `CLERK_WEBHOOK_SIGNING_SECRET`-muuttujaan. Allekirjoitus tarkistetaan alkuperäisestä pyynnön rungosta. Vahvistettu poistotapahtuma poistaa käyttäjän ja hänen DuuniCheck-tietonsa tietokannasta transaktiona.

## Tietoturvan periaatteet

- Kirjautuminen tarkistetaan backendissä Clerk-istunnosta; käyttäjätunnusta ei luoteta clientin pyynnössä.
- Tietokantakyselyt rajataan kirjautuneen käyttäjän omistamiin tietoihin.
- API-, AI-, tiedostolataus- ja webhook-reiteillä on pyyntörajoitukset.
- Webhookin allekirjoitus tarkistetaan ennen tapahtuman käsittelyä.
- Tiedostotyyppejä, kokoa ja syötteitä tarkistetaan palvelimella; pyyntöjen rungolla on kokoraja.
- `.env`-tiedostot eivät kuulu versionhallintaan. Tuotantoavaimet asetetaan käyttöönottoympäristön salaisuuksiksi.

## Tarkistukset

Frontendin linttaus ja tuotantokäännös:

```powershell
cd frontend
npm run lint
npm run build
```

## Projektin rakenne

```text
frontend/
  src/
    components/    uudelleenkäytettävät käyttöliittymäkomponentit
    pages/         sovelluksen sivut
    styles/        teeman tyylit
    App.jsx        sivunäkymien ja sovellustilan runko
    api.js         backend-pyynnöt
    index.css      yhteiset perustyylit
backend/
  middleware/     kirjautuminen ja pyyntörajoitukset
  models/          MongoDB-mallit
  routes/          sovelluksen API-reitit ja Clerk-webhook
  utils/           syötteiden käsittely ja yhteiset apufunktiot
  server.js        Express-palvelin ja middleware-asetukset
```

## Teknologiat

- React ja Vite
- Express ja MongoDB/Mongoose
- Clerk
- OpenAI API valinnaisiin AI-ehdotuksiin
