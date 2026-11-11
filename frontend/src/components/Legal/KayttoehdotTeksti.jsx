import { controllerName, legalUpdated, supportEmail, supportText } from '../../legal/legalConfig.js'

export default function KayttoehdotTeksti() {
  return (
    <article className="legal-copy">
      <p className="legal-updated">Päivitetty viimeksi: {legalUpdated}</p>
      <p>Nämä käyttöehdot koskevat DuuniCheck-palvelun käyttöä. Hyväksyt ehdot, kun luot tilin tai käytät palvelua.</p>

      <h2>1. Palvelusta</h2>
      <p>
        DuuniCheck on työnhaun hallintapalvelu. Sen avulla voit seurata hakemuksia ja niiden tapahtumia, käyttää
        kalenteria, ylläpitää CV-versioita ja hakemuspohjia, tallentaa tiedostoja, keskustella tekoälyavustajan kanssa
        sekä luoda esitäytettyjä hakemuksia työpaikkailmoituksista. Palvelu on maksuton harjoitus- ja portfoliohanke. Se
        tarjotaan sellaisena kuin se on, eikä palvelu takaa työpaikkaa tai haastattelua.
      </p>

      <h2>2. Tili ja ikäraja</h2>
      <p>
        Palvelun ikäraja on 18 vuotta. Palvelu on kutsupohjainen. Tilin voi luoda vain kehittäjän lähettämällä kutsulla.
        Kirjautuminen ja tilin hallinta toimivat Clerk-palvelun kautta. Google-kirjautuminen on valinnainen. Vastaat
        itse kirjautumistietojesi ja laitteidesi turvallisuudesta.
      </p>

      <h2>3. Oma sisältösi</h2>
      <p>
        Sisältösi kuuluu sinulle. Annat DuuniCheckille rajatun oikeuden tallentaa ja käsitellä sisältöä vain palvelun
        tarjoamiseksi, ylläpitämiseksi ja suojaamiseksi. Vastaat siitä, että tiedot ovat oikeita ja että sinulla on
        oikeus tallentaa ne. Tämä koskee myös muistiinpanoihin mahdollisesti lisäämiäsi muiden henkilöiden tietoja ja
        sisältöä, johon liittyy tekijänoikeuksia. Älä tallenna arkaluonteisia tietoja, ellei se ole välttämätöntä.
      </p>

      <h2>4. Sallittu käyttö</h2>
      <p>
        Et saa yrittää käyttää muiden tilejä tai tietoja, häiritä tai kuormittaa palvelua, kiertää sen suojausta, ladata
        haitallisia tai laittomia tiedostoja, käyttää tekoälyavustajaa laittomaan tarkoitukseen tai automatisoida
        palvelun massakäyttöä. Ehtojen rikkominen voi johtaa käyttöoikeuden rajoittamiseen tai tilin sulkemiseen.
      </p>

      <h2>5. Tiedostot ja käyttörajat</h2>
      <p>
        Tiedostokirjastoon voi lisätä PDF-, DOCX- ja TXT-tiedostoja. Yksittäinen tiedosto saa olla enintään 10 Mt.
        Tiedostokirjaston kokonaisraja on 50 Mt ja tiedostoja voi olla enintään 500. Lisäksi käyttäjäkohtaiset rajat
        ovat 25 CV-versiota, 100 hakemuspohjaa ja 500 hakemusta. Vastaat tiedostojen sisällöstä ja siitä, että sinulla
        on oikeus tallentaa ne.
      </p>

      <h2>6. Tekoälyavustaja</h2>
      <p>
        Tekoälyn vastaukset voivat olla virheellisiä tai puutteellisia. Ne eivät ole ammatillista neuvontaa. Tarkista
        ehdotukset ennen kuin käytät niitä. Avustaja ei muuta hakemustietojasi ilman omaa hyväksyntääsi.
      </p>
      <p>
        Avustaja voi tehdä liittämästäsi työpaikkailmoituksen tekstistä esitäytetyn hakemuksen. Tarkista tiedot ennen
        tallennusta. Hakemus tallennetaan vasta, kun hyväksyt sen.
      </p>
      <p>
        Avustaja voi myös tuoda hakemuksia liittämästäsi Excel- (.xlsx), CSV-, Word- (.docx), PDF- tai
        tekstitiedostosta. Tiedosto saa olla enintään 5 Mt, ja yhdellä kerralla voi tuoda enintään 50 hakemusta. Makroja
        sisältäviä tai vanhan muodon Excel-tiedostoja ei tueta. Tiedostoa ei tallenneta. Tekoäly voi tulkita tiedoston
        tietoja väärin, joten tarkista hakemukset ennen tallennusta. Vain valitsemasi hakemukset tallennetaan, ja vasta
        kun hyväksyt ne. Tuo vain tietoja, joiden käsittelyyn sinulla on oikeus.
      </p>
      <p>
        Tiedostosta tuodut hakemukset voi poistaa Kumoa tuonti -painikkeella, kunnes sivu ladataan uudelleen. Avustajaa
        voi myös pyytää etsimään poistettavia hakemuksia. Tekoäly muuntaa pyynnön hakuehdoiksi, eikä se näe hakemuksia
        eikä poista mitään. Hakemukset poistetaan vasta, kun valitset ne ja vahvistat poiston. Poistoa ei voi perua:
        poistetut hakemukset ja niiden keskustelut poistuvat pysyvästi.
      </p>

      <h2>7. Saatavuus ja muutokset</h2>
      <p>
        Palvelua voidaan muuttaa, keskeyttää tai lopettaa. Tietoja voi kadota esimerkiksi kehityksen aikana. Säilytä
        tärkeät asiakirjasi myös muualla. Merkittävistä muutoksista pyritään ilmoittamaan etukäteen.
      </p>

      <h2>8. Vastuunrajoitus</h2>
      <p>
        Palvelu tarjotaan ilman nimenomaisia tai oletettuja takuita lain sallimissa rajoissa. Kehittäjä ei vastaa
        käyttökatkoksista tai tietojen menetyksestä lain sallimissa rajoissa. Näillä ehdoilla ei rajoiteta kuluttajan
        pakottavaan lainsäädäntöön perustuvia oikeuksia eikä vastuuta tahallisuudesta tai törkeästä huolimattomuudesta.
      </p>

      <h2>9. Tilin päättäminen</h2>
      <p>
        Voit poistaa tilisi sovelluksen profiilivalikon kohdasta Hallitse tiliä. Tilin poistaminen käynnistää siihen
        liitettyjen DuuniCheck-tietojen poistamisen. Ehtoja rikkovan tilin käyttöä voidaan rajoittaa tai tili sulkea.
      </p>

      <h2>10. Ehtojen muutokset</h2>
      <p>
        Uusin versio on aina luettavissa sovelluksessa. Olennaisista muutoksista pyritään ilmoittamaan etukäteen.
        Palvelun käytön jatkaminen muutosten jälkeen merkitsee päivitettyjen ehtojen hyväksymistä.
      </p>

      <h2>11. Sovellettava laki ja yhteystiedot</h2>
      <p>
        Ehtoihin sovelletaan Suomen lakia. Palvelusta voi ottaa yhteyttä sähköpostitse osoitteeseen{' '}
        {supportEmail ? <a href={`mailto:${supportEmail}`}>{supportEmail}</a> : supportText}.
      </p>
      <p className="legal-controller">Palvelun kehittäjä: {controllerName}.</p>
    </article>
  )
}
