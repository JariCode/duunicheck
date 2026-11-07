import { controllerName, legalUpdated, providers, supportEmail, supportText } from '../../legal/legalConfig.js'

const rights = [
  'pyytää pääsyä itseäsi koskeviin tietoihin',
  'pyytää virheellisten tietojen oikaisua tai tietojen poistamista',
  'pyytää käsittelyn rajoittamista',
  'saada itse toimittamasi tiedot yleisessä muodossa, kuten JSON- tai CSV-tiedostona',
  'vastustaa oikeutettuun etuun perustuvaa käsittelyä',
  'peruuttaa suostumus, jos käsittely perustuu suostumukseen',
]

export default function TietosuojaselosteTeksti() {
  return <article className="legal-copy">
    <p className="legal-updated">Päivitetty viimeksi: {legalUpdated}</p>

    <h2>1. Rekisterinpitäjä ja yhteystiedot</h2>
    <p>Rekisterinpitäjä on {controllerName}. DuuniCheck on harjoitus- ja portfoliohanke. Tietosuojaa koskevissa asioissa voit ottaa yhteyttä sähköpostitse osoitteeseen {supportEmail ? <a href={`mailto:${supportEmail}`}>{supportEmail}</a> : supportText}.</p>

    <h2>2. Kuka voi käyttää palvelua</h2>
    <p>Palvelun ikäraja on 18 vuotta. Palvelu on kutsupohjainen. Tilin voi luoda vain kehittäjän lähettämällä kutsulla. Kirjautuminen toimii Clerkissä, ja Google-kirjautuminen on valinnainen.</p>

    <h2>3. Mitä tietoja käsitellään</h2>
    <p>Tietojen antaminen on tarpeen palvelun käyttämiseksi. Käsittelemme vain palvelun toiminnan ja turvallisuuden kannalta tarpeellisia tietoja.</p>
    <div className="legal-table-scroll" role="region" aria-label="Käsiteltävät tiedot" tabIndex="0">
      <table><thead><tr><th>Tieto</th><th>Käyttötarkoitus</th><th>Oikeusperuste</th><th>Säilytys</th></tr></thead><tbody>
        <tr><td>Tilitiedot ja Clerk-tunniste. Clerk hallinnoi kirjautumistietoja, kuten sähköpostia, nimeä, profiilikuvaa ja tunnistautumista. Salasanaa ei tallenneta DuuniCheckin tietokantaan.</td><td>Tilin luominen, tunnistaminen ja kirjautuminen.</td><td>Palvelun tarjoaminen sopimuksen perusteella, GDPR 6(1)(b).</td><td>Clerkissä tilin voimassaolon ja sen omien säilytyskäytäntöjen mukaan.</td></tr>
        <tr><td>Hakemukset: yritys, tehtävä, sijainti, ilmoituslinkki, tila, päivät, valitut CV- ja tiedostotunnisteet, hakemusteksti, muistiinpanot sekä tapahtumat päivineen ja lisätietoineen.</td><td>Työnhaun seuranta, kalenteri ja hakemuksen historian näyttäminen.</td><td>Palvelun tarjoaminen sopimuksen perusteella, GDPR 6(1)(b).</td><td>Niin kauan kuin tili on olemassa tai kunnes poistat tiedot.</td></tr>
        <tr><td>CV-tiedot: nimi, yhteystiedot, kuva, otsikko, yhteenveto, taidot, kokemus, koulutus, sertifikaatit, kurssit, kielitaito, harrastukset ja linkit.</td><td>CV-versioiden ylläpito ja tulostus.</td><td>Palvelun tarjoaminen sopimuksen perusteella, GDPR 6(1)(b).</td><td>Niin kauan kuin tili on olemassa tai kunnes poistat tiedot.</td></tr>
        <tr><td>Hakemuspohjan tiedot: nimi, yhteystiedot, hakemusteksti ja linkit.</td><td>Hakemuspohjien ylläpito ja tulostus.</td><td>Palvelun tarjoaminen sopimuksen perusteella, GDPR 6(1)(b).</td><td>Niin kauan kuin tili on olemassa tai kunnes poistat tiedot.</td></tr>
        <tr><td>Ladatut PDF-, DOCX- ja TXT-tiedostot, niiden nimi, tyyppi ja koko sekä tiedoston sisältö.</td><td>Tiedostojen säilyttäminen CV- ja hakemusmateriaalina sekä niiden lataaminen.</td><td>Palvelun tarjoaminen sopimuksen perusteella, GDPR 6(1)(b).</td><td>Niin kauan kuin tili on olemassa tai kunnes poistat tiedoston.</td></tr>
        <tr><td>Tekoälykeskustelujen viestit ja vastaukset.</td><td>Keskustelun näyttäminen uudelleen hakemuksen yhteydessä.</td><td>Palvelun tarjoaminen sopimuksen perusteella, GDPR 6(1)(b).</td><td>Niin kauan kuin tili tai siihen liittyvä hakemus on olemassa.</td></tr>
        <tr><td>Teema-asetus ja tilin luontiaika.</td><td>Valitun käyttöliittymäteeman säilyttäminen ja tilin hallinta.</td><td>Palvelun tarjoaminen sopimuksen perusteella, GDPR 6(1)(b).</td><td>Niin kauan kuin tili on olemassa.</td></tr>
        <tr><td>Laitteen verkkosoite eli IP-osoite sekä palvelun käytön tekniset tiedot.</td><td>Palvelun toiminta, väärinkäytösten ehkäisy ja suojaaminen.</td><td>Palvelun suojaaminen oikeutetun edun perusteella (GDPR 6(1)(f)).</td><td>Palveluntarjoajien omien säilytysaikojen mukaan.</td></tr>
      </tbody></table>
    </div>

    <h2>4. Mistä tiedot saadaan</h2>
    <p>Tiedot saadaan sinulta, kirjautumistietojen osalta Clerkiltä ja tarvittaessa Googlelta. Jos annat työpaikkailmoituksen linkin ja pyydät avustajaa lukemaan ilmoituksen, palvelu hakee linkistä julkisesti näkyvää ilmoitustekstiä. Duunitorin ja Työmarkkinatorin ilmoituksia ei haeta automaattisesti, vaan niiden teksti liitetään itse avustajaan.</p>

    <h2>5. Tekoälyavustaja</h2>
    <p>OpenAI:lle lähetetään avustajalle kirjoittamasi viesti ja vain erikseen valitsemasi konteksti. Konteksti voi sisältää hakemuksen yrityksen ja tehtävän, ilmoitustekstin, valitsemasi CV:n otsikon, yhteenvedon, taidot, kokemuksen ja koulutuksen, hakemuspohjan tekstin tai hakemuksen muistiinpanot tai hakemustekstin. CV-kuvaa, CV:n sähköpostia, puhelinnumeroa tai koko tiedostoa ei tämän toiminnon kautta lähetetä OpenAI:lle.</p>
    <p>Kun teet työpaikkailmoituksesta esitäytetyn hakemuksen, OpenAI:lle lähetetään vain liittämäsi ilmoituksen teksti, josta poimitaan yritys, tehtävä, paikkakunta, haun päättymispäivä ja lähde. Liittämääsi linkkiä ei lähetetä OpenAI:lle eikä avata. Ilmoituksen tekstiä tai esitäytettyä hakemusta ei tallenneta, ennen kuin hyväksyt sen.</p>
    <p>Avustajaa käytetään vain, kun lähetät sille viestin. Avustaja antaa ehdotuksia eikä muuta tallennettuja tietoja ilman hyväksyntääsi. Viesti ja vastaus tallennetaan DuuniCheckin tietokantaan keskusteluhistoriana. Keskustelu poistuu, kun poistat siihen liittyvän hakemuksen tai tilisi.</p>
    <p>OpenAI kertoo, ettei avustajalle lähetettyjä tietoja käytetä mallien kouluttamiseen oletuksena. OpenAI voi säilyttää viestejä ja vastauksia väärinkäytösten valvontaa varten enintään 30 päivää, ellei laki tai palvelun suojaaminen edellytä pidempää aikaa. Käytäntö voi muuttua, joten OpenAI:n ajantasaiset ehdot on hyvä tarkistaa. Älä lähetä avustajalle arkaluonteisia tietoja.</p>

    <h2>6. Evästeet ja selaimen tallennus</h2>
    <p>Clerk voi käyttää evästeitä kirjautumisen ja tilin suojaamisen yhteydessä. DuuniCheck ei tallenna hakemus-, CV- tai keskustelutietoja selaimeen eikä käytä analytiikkaa tai mainoksia. Käyttöliittymän fontit ladataan DuuniCheckin omalta palvelimelta, joten niiden lataamisesta ei välity tietoja kolmansille osapuolille.</p>

    <h2>7. Palveluntarjoajat ja tietojen siirrot</h2>
    <div className="legal-table-scroll" role="region" aria-label="Palveluntarjoajat ja sijainnit" tabIndex="0">
      <table><thead><tr><th>Palveluntarjoaja</th><th>Tarkoitus</th><th>Sijainti</th></tr></thead><tbody>
        {providers.map((provider) => <tr key={`${provider.name}-${provider.purpose}`}><td>{provider.name}</td><td>{provider.purpose}</td><td>{provider.location}</td></tr>)}
      </tbody></table>
    </div>
    <p>Renderin, Clerkin, OpenAI:n ja Googlen kautta tietoja voidaan käsitellä EU/ETA-alueen ulkopuolella. Kansainväliset siirrot perustuvat soveltuvaan siirtomekanismiin, kuten EU:n vakiosopimuslausekkeisiin (SCC) tai EU:n ja Yhdysvaltojen tietosuojakehikkoon (Data Privacy Framework) silloin, kun kyseinen palveluntarjoaja ja siirto kuuluvat sen piiriin. Käytetty mekanismi määräytyy palveluntarjoajan sopimusten ja kulloinkin voimassa olevan sertifioinnin mukaan.</p>

    <h2>8. Säilytys ja poistaminen</h2>
    <p>DuuniCheckin tietokantaan tallennetut tiedot säilyvät niin kauan kuin tilisi on olemassa, ellet poista yksittäisiä tietoja aiemmin. Voit poistaa tilisi profiilivalikon kohdasta Hallitse tiliä. Kun Clerk ilmoittaa tilin poistamisesta, DuuniCheck poistaa hakemukset, CV:t, hakemuspohjat, tiedostot, keskusteluviestit, keskustelut ja käyttäjäasetuksen. Hakemuksen poistaminen poistaa myös siihen liittyvän keskustelun.</p>
    <p>OpenAI:n ja muiden palveluntarjoajien teknisten lokien sekä varmuuskopioiden säilytys ja poistaminen tapahtuu niiden omien käytäntöjen mukaisesti.</p>

    <h2>9. Oikeutesi</h2>
    <p>Sinulla on soveltuvan tietosuojalainsäädännön mukaisesti oikeus:</p>
    <ul>{rights.map((right) => <li key={right}>{right}</li>)}</ul>
    <p>Vastaamme pyyntöön ilman aiheetonta viivytystä ja viimeistään kuukauden kuluessa. Monimutkaisessa tilanteessa määräaikaa voidaan lain sallimissa rajoissa jatkaa, ja kerromme siitä kuukauden kuluessa. Voit tehdä valituksen tietosuojavaltuutetulle osoitteessa <a href="https://tietosuoja.fi" target="_blank" rel="noreferrer">tietosuoja.fi</a>.</p>

    <h2>10. Muiden henkilöiden tiedot</h2>
    <p>Voit kirjoittaa hakemuksen muistiinpanoihin esimerkiksi rekrytoijan yhteystietoja tai muita työnhaun kannalta tarpeellisia tietoja. Tallenna muiden henkilöiden tietoja vain tarpeellinen määrä ja poista ne, kun et enää tarvitse niitä. Sovelluksessa ei ole erillisiä yhteyshenkilökenttiä.</p>

    <h2>11. Tietoturva</h2>
    <p>Yhteys sovellukseen salataan. Jokainen käyttäjä näkee vain omat tietonsa. Kirjautumisen hoitaa Clerk. Palvelussa on myös rajoituksia, joilla ehkäistään liian suurta pyyntömäärää.</p>

    <h2>12. Automaattinen päätöksenteko</h2>
    <p>Palvelussa ei tehdä automaattisia päätöksiä, joilla olisi sinuun kohdistuvia oikeudellisia vaikutuksia tai vastaavan merkittäviä vaikutuksia. Tekoälyavustaja tuottaa vain ehdotuksia.</p>

    <h2>13. Selosteen muutokset</h2>
    <p>Päivityspäivä näkyy tämän selosteen alussa. Uusin versio on aina luettavissa sovelluksessa.</p>
    <p className="legal-controller">Rekisterinpitäjä: {controllerName}.</p>
  </article>
}
