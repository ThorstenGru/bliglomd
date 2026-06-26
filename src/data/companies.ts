import type { Company } from '../types'

export const COMPANIES: Company[] = [
  // ── Swedish media with utgivningsbevis ─────────────────────────────────────
  {
    id: 'aftonbladet',
    name: 'Aftonbladet',
    category: 'Nyheter',
    country: 'SE',
    gdpr_email: 'integritet@aftonbladet.se',
    gdpr_url: 'https://www.aftonbladet.se/privacypolicy',
    instructions_sv:
      'Kontakta Aftonbladets integritetsteam via integritet@aftonbladet.se. Ange ditt namn, e-postadress och eventuellt prenumerationsnummer. Observera: Aftonbladet har utgivningsbevis och kan åberopa journalistiskt syfte för redaktionellt publicerat material, men är skyldiga att radera konto- och prenumerationsdata.',
    instructions_en:
      'Contact Aftonbladet's privacy team at integritet@aftonbladet.se. State your name, email address and any subscription number. Note: Aftonbladet holds a publishing certificate and may retain editorially published material, but must delete account and subscription data.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: true,
  },
  {
    id: 'expressen',
    name: 'Expressen',
    category: 'Nyheter',
    country: 'SE',
    gdpr_email: 'personuppgifter@expressen.se',
    gdpr_url: 'https://www.expressen.se/personuppgifter/',
    instructions_sv:
      'Skicka din raderingsförfrågan till personuppgifter@expressen.se. Ange ditt namn, e-postadress och telefonnummer. Expressen (Bonnier News) har utgivningsbevis och kan behålla publicerat redaktionellt innehåll, men är skyldiga att radera konto- och prenumerationsdata inom 30 dagar.',
    instructions_en:
      'Send your deletion request to personuppgifter@expressen.se. State your name, email and phone number. Expressen (Bonnier News) holds a publishing certificate and may retain published editorial content, but must delete account and subscription data within 30 days.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: true,
  },
  {
    id: 'dn',
    name: 'Dagens Nyheter',
    category: 'Nyheter',
    country: 'SE',
    gdpr_email: 'integritet@dn.se',
    gdpr_url: 'https://www.dn.se/om-dn/integritetspolicy/',
    instructions_sv:
      'Skicka din raderingsförfrågan till integritet@dn.se. Ange fullständigt namn, e-postadress och eventuellt prenumerationsnummer. Dagens Nyheter har utgivningsbevis och kan åberopa journalistiskt syfte för publicerat innehåll, men är skyldiga att radera konto- och prenumerationsdata.',
    instructions_en:
      'Send your deletion request to integritet@dn.se. Include your full name, email address and any subscription number. Dagens Nyheter holds a publishing certificate and may retain published content, but must delete account and subscription data.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: true,
  },
  {
    id: 'svd',
    name: 'Svenska Dagbladet',
    category: 'Nyheter',
    country: 'SE',
    gdpr_email: 'dataskydd@svd.se',
    gdpr_url: 'https://www.svd.se/om-svd/integritetspolicy/',
    instructions_sv:
      'Skicka din raderingsförfrågan till dataskydd@svd.se. Ange fullständigt namn, e-postadress och eventuellt kundnummer. SvD (Schibsted) har utgivningsbevis. Konto- och prenumerationsdata ska raderas inom 30 dagar.',
    instructions_en:
      'Send your deletion request to dataskydd@svd.se. Include your full name, email address and any customer number. SvD (Schibsted) holds a publishing certificate. Account and subscription data must be deleted within 30 days.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: true,
  },
  {
    id: 'gp',
    name: 'Göteborgs-Posten',
    category: 'Nyheter',
    country: 'SE',
    gdpr_email: 'personuppgifter@gp.se',
    gdpr_url: 'https://www.gp.se/om-oss/integritetspolicy',
    instructions_sv:
      'Skicka din raderingsförfrågan till personuppgifter@gp.se. Ange ditt fullständiga namn, e-postadress och kundnummer om du är prenumerant. GP (Stampen Media) har utgivningsbevis.',
    instructions_en:
      'Send your deletion request to personuppgifter@gp.se. Include your full name, email address and customer number if you are a subscriber. GP (Stampen Media) holds a publishing certificate.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: true,
  },
  {
    id: 'svt',
    name: 'SVT (Sveriges Television)',
    category: 'Nyheter',
    country: 'SE',
    gdpr_email: 'personuppgifter@svt.se',
    gdpr_url: 'https://www.svt.se/om-svt/personuppgifter/',
    instructions_sv:
      'Kontakta SVT på personuppgifter@svt.se. SVT är en public service-kanal med utgivningsbevis. De behandlar personuppgifter för redaktionellt och administrativt bruk. Redaktionellt publicerat material skyddas av YGL, men kontouppgifter i SVT Play ska raderas på begäran.',
    instructions_en:
      'Contact SVT at personuppgifter@svt.se. SVT is a public service broadcaster with a publishing certificate. Editorially published material is protected under Swedish press freedom law, but SVT Play account data must be deleted upon request.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: true,
  },
  {
    id: 'sr',
    name: 'Sveriges Radio',
    category: 'Nyheter',
    country: 'SE',
    gdpr_email: 'personuppgifter@sverigesradio.se',
    gdpr_url: 'https://sverigesradio.se/artikel/integritetspolicy',
    instructions_sv:
      'Kontakta Sveriges Radio på personuppgifter@sverigesradio.se. SR är en public service-organisation med utgivningsbevis under YGL. Kontouppgifter och lyssnardata ska raderas på begäran, medan publicerat redaktionellt material kan behållas.',
    instructions_en:
      'Contact Sveriges Radio at personuppgifter@sverigesradio.se. SR is a public service organisation with a publishing certificate. Account and listener data must be deleted upon request; published editorial material may be retained.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: true,
  },
  {
    id: 'tv4',
    name: 'TV4',
    category: 'Nyheter',
    country: 'SE',
    gdpr_email: 'gdpr@tv4.se',
    gdpr_url: 'https://www.tv4.se/integritetspolicy',
    instructions_sv:
      'Skicka din raderingsförfrågan till gdpr@tv4.se. TV4 (Telia Company) har utgivningsbevis. Kontouppgifter och tittardata i TV4 Play ska raderas på begäran. Ange fullständigt namn och registrerad e-post.',
    instructions_en:
      'Send your deletion request to gdpr@tv4.se. TV4 (Telia Company) holds a publishing certificate. Account and viewer data in TV4 Play must be deleted upon request. Include your full name and registered email.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: true,
  },

  // ── Swedish companies ───────────────────────────────────────────────────────
  {
    id: 'spotify',
    name: 'Spotify',
    category: 'Streaming',
    country: 'SE',
    gdpr_email: 'privacy@spotify.com',
    gdpr_url: 'https://www.spotify.com/se/account/privacy/',
    instructions_sv:
      'Logga in på spotify.com och gå till Integritetsinställningar. Klicka på "Begär radering". Du kan även kontakta Spotifys dataskyddsombud via privacy@spotify.com och åberopa din rätt enligt GDPR Artikel 17.',
    instructions_en:
      'Log in to spotify.com and go to Privacy Settings. Click "Request deletion". You can also contact Spotify's Data Protection Officer at privacy@spotify.com citing your rights under GDPR Article 17.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: false,
  },
  {
    id: 'klarna',
    name: 'Klarna',
    category: 'Finans',
    country: 'SE',
    gdpr_email: 'dataprivacy@klarna.com',
    gdpr_url: 'https://www.klarna.com/se/integritetspolicy/',
    instructions_sv:
      'Öppna Klarna-appen och gå till Profil → Inställningar → Integritet → Begär radering. Klarnas DPO nås på dataprivacy@klarna.com. Observera att Klarna är skyldig att spara viss data för redovisningsändamål i 7 år (Bokföringslagen).',
    instructions_en:
      'Open the Klarna app and go to Profile → Settings → Privacy → Request deletion. Klarna's DPO can be reached at dataprivacy@klarna.com. Note: Klarna is legally required to retain certain accounting data for 7 years under Swedish law.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: false,
  },
  {
    id: 'swish',
    name: 'Swish',
    category: 'Finans',
    country: 'SE',
    gdpr_email: 'info@getswish.se',
    gdpr_url: 'https://www.swish.nu/om-swish/dataskydd',
    instructions_sv:
      'Kontakta din bank för att avsluta Swish-tjänsten. Swish (Getswish AB) är skyldiga att spara transaktionshistorik i enlighet med Bokföringslagen. Begäran om radering av övriga uppgifter skickas till info@getswish.se.',
    instructions_en:
      'Contact your bank to close your Swish service. Swish (Getswish AB) is required to retain transaction history under Swedish accounting law. Requests for deletion of other data can be sent to info@getswish.se.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: false,
  },
  {
    id: 'bankid',
    name: 'BankID',
    category: 'Finans',
    country: 'SE',
    gdpr_email: 'gdpr@bankid.com',
    gdpr_url: 'https://www.bankid.com/integritetspolicy',
    instructions_sv:
      'BankID-data hanteras primärt av din utfärdande bank. Kontakta din bank för att spärra och radera BankID. För frågor om Finansiell ID-teknik ABs databehandling: gdpr@bankid.com.',
    instructions_en:
      'BankID data is primarily managed by your issuing bank. Contact your bank to block and delete your BankID. For questions about Finansiell ID-teknik AB's data processing: gdpr@bankid.com.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: false,
  },
  {
    id: 'ikea',
    name: 'IKEA',
    category: 'Shopping',
    country: 'SE',
    gdpr_email: 'privacy.se@ingka.ikea.com',
    gdpr_url: 'https://www.ikea.com/se/sv/customer-service/privacy-policy/',
    instructions_sv:
      'Kontakta IKEAs kundtjänst via ikea.com för att begära kontotypsradering. Skicka en formell GDPR-begäran till privacy.se@ingka.ikea.com. Ange fullständigt namn, registrerad e-post och personnummer.',
    instructions_en:
      'Contact IKEA customer service via ikea.com to request account deletion. Send a formal GDPR request to privacy.se@ingka.ikea.com. Include your full name, registered email and personal ID number.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: false,
  },
  {
    id: 'hm',
    name: 'H&M',
    category: 'Shopping',
    country: 'SE',
    gdpr_email: 'hm.privacypolicy@hm.com',
    gdpr_url: 'https://www2.hm.com/sv_se/customer-service/legal-and-privacy/privacy-notice.html',
    instructions_sv:
      'Logga in på hm.com och gå till Mitt konto → Profil → Radera konto. Du kan också skicka en skriftlig raderingsförfrågan till hm.privacypolicy@hm.com.',
    instructions_en:
      'Log in to hm.com and go to My Account → Profile → Delete account. You can also send a written deletion request to hm.privacypolicy@hm.com.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: false,
  },
  {
    id: 'blocket',
    name: 'Blocket',
    category: 'Shopping',
    country: 'SE',
    gdpr_email: 'privacy@blocket.se',
    gdpr_url: 'https://www.blocket.se/om/integritetspolicy',
    instructions_sv:
      'Logga in på Blocket och gå till Mitt konto → Inställningar → Avsluta konto. Skicka en GDPR-raderingsförfrågan till privacy@blocket.se. Blocket är ägt av Schibsted.',
    instructions_en:
      'Log in to Blocket and go to My Account → Settings → Close account. Send a GDPR deletion request to privacy@blocket.se. Blocket is owned by Schibsted.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: false,
  },
  {
    id: 'tradera',
    name: 'Tradera',
    category: 'Shopping',
    country: 'SE',
    gdpr_email: 'privacy@tradera.com',
    gdpr_url: 'https://www.tradera.com/legal/gdpr',
    instructions_sv:
      'Logga in på Tradera och gå till Mitt konto → Inställningar → Avsluta konto. För formell GDPR-begäran: privacy@tradera.com.',
    instructions_en:
      'Log in to Tradera and go to My Account → Settings → Close account. For formal GDPR requests: privacy@tradera.com.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: false,
  },

  // ── International companies (relevant for Swedish users) ───────────────────
  {
    id: 'google',
    name: 'Google',
    category: 'Sökmotor',
    country: 'US',
    gdpr_email: null,
    gdpr_url: 'https://myaccount.google.com/delete-services-or-account',
    instructions_sv:
      'Logga in på ditt Google-konto och gå till "Data och integritet". Välj "Radera ditt Google-konto" eller radera specifika tjänster. EU-användare kan skicka en formell begäran via Googles integritetssida.',
    instructions_en:
      'Log in to your Google account and go to "Data and privacy". Select "Delete your Google Account" or delete specific services. EU users can submit a formal request via Google's privacy page.',
    level1_available: true,
    level2_available: true,
    level3_available: false,
    utgivningsbevis: false,
  },
  {
    id: 'meta',
    name: 'Meta (Facebook/Instagram)',
    category: 'Sociala medier',
    country: 'US',
    gdpr_email: null,
    gdpr_url: 'https://www.facebook.com/help/contact/2635536973196940',
    instructions_sv:
      'Gå till Facebook Inställningar → Din Facebook-information → Radering och avaktivering. Välj "Radera konto". Alternativt skicka en formell GDPR-begäran via Metas dataprivacy-formulär.',
    instructions_en:
      'Go to Facebook Settings → Your Facebook information → Deactivation and deletion. Select "Delete account". Or submit a formal GDPR request via Meta's data privacy form.',
    level1_available: true,
    level2_available: true,
    level3_available: false,
    utgivningsbevis: false,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    category: 'Sociala medier',
    country: 'US',
    gdpr_email: null,
    gdpr_url: 'https://www.linkedin.com/legal/data-deletion',
    instructions_sv:
      'Gå till Inställningar & integritet → Dataintegritet → Stäng konto. LinkedIn är skyldigt att radera dina uppgifter inom 30 dagar.',
    instructions_en:
      'Go to Settings & Privacy → Data privacy → Close account. LinkedIn is required to delete your data within 30 days.',
    level1_available: true,
    level2_available: true,
    level3_available: false,
    utgivningsbevis: false,
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    category: 'Övrigt',
    country: 'US',
    gdpr_email: 'msprivacy@microsoft.com',
    gdpr_url: 'https://privacy.microsoft.com/en-us/privacy-questions',
    instructions_sv:
      'Gå till account.microsoft.com och välj "Stäng konto" under Säkerhet. För dataraderingsförfrågningar utan att stänga kontot: msprivacy@microsoft.com.',
    instructions_en:
      'Go to account.microsoft.com and select "Close account" under Security. For data deletion requests without closing the account: msprivacy@microsoft.com.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: false,
  },
  {
    id: 'apple',
    name: 'Apple',
    category: 'Övrigt',
    country: 'US',
    gdpr_email: null,
    gdpr_url: 'https://privacy.apple.com/',
    instructions_sv:
      'Besök privacy.apple.com och logga in med ditt Apple ID. Välj "Begär radering av ditt konto". Apple har 7 dagars betänketid innan radering påbörjas.',
    instructions_en:
      'Visit privacy.apple.com and log in with your Apple ID. Select "Request to delete your account". Apple has a 7-day review period before deletion begins.',
    level1_available: true,
    level2_available: true,
    level3_available: false,
    utgivningsbevis: false,
  },
  {
    id: 'amazon',
    name: 'Amazon',
    category: 'Shopping',
    country: 'US',
    gdpr_email: 'data-request@amazon.co.uk',
    gdpr_url: 'https://www.amazon.se/hz/mycd/digital-console/privacysettings',
    instructions_sv:
      'Kontakta Amazons kundtjänst för kontotypsradering. EU-kunder kan även skicka en GDPR-begäran till data-request@amazon.co.uk. Ange fullständigt namn, registrerad e-post och åberopa GDPR Artikel 17.',
    instructions_en:
      'Contact Amazon customer service for account deletion. EU customers can also send a GDPR request to data-request@amazon.co.uk. State your full name, registered email and cite GDPR Article 17.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: false,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    category: 'Sociala medier',
    country: 'CN',
    gdpr_email: 'privacy@tiktok.com',
    gdpr_url: 'https://www.tiktok.com/legal/privacy-policy-eea',
    instructions_sv:
      'I TikTok-appen: gå till Profil → Inställningar → Hantera konto → Radera konto. Alternativt skicka en GDPR-begäran till privacy@tiktok.com. TikToks EEA-enhet är registrerad i Irland.',
    instructions_en:
      'In the TikTok app: go to Profile → Settings → Manage account → Delete account. Or send a GDPR request to privacy@tiktok.com. TikTok's EEA entity is registered in Ireland.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: false,
  },
  {
    id: 'snapchat',
    name: 'Snapchat',
    category: 'Sociala medier',
    country: 'US',
    gdpr_email: 'privacy@snap.com',
    gdpr_url: 'https://accounts.snapchat.com/accounts/delete_account',
    instructions_sv:
      'Besök accounts.snapchat.com/accounts/delete_account. Kontot deaktiveras i 30 dagar innan radering. Skicka GDPR-begäran till privacy@snap.com för skriftlig bekräftelse.',
    instructions_en:
      'Visit accounts.snapchat.com/accounts/delete_account. The account is deactivated for 30 days before deletion. Send a GDPR request to privacy@snap.com for written confirmation.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: false,
  },
  {
    id: 'twitter-x',
    name: 'Twitter / X',
    category: 'Sociala medier',
    country: 'US',
    gdpr_email: 'dporequest@twitter.com',
    gdpr_url: 'https://help.twitter.com/forms/privacy',
    instructions_sv:
      'Gå till Inställningar → Ditt konto → Avaktivera ditt konto. Kontot är avaktiverat i 30 dagar, sedan raderas all data. Formell GDPR-begäran: dporequest@twitter.com.',
    instructions_en:
      'Go to Settings → Your account → Deactivate your account. The account is deactivated for 30 days, then all data is deleted. Formal GDPR request: dporequest@twitter.com.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: false,
  },
  {
    id: 'zalando',
    name: 'Zalando',
    category: 'Shopping',
    country: 'DE',
    gdpr_email: 'privacy@zalando.de',
    gdpr_url: 'https://www.zalando.se/zalando-privacy-policy/',
    instructions_sv:
      'Logga in på zalando.se och gå till Mitt konto → Personuppgifter → Radera konto. Alternativt skicka en GDPR-begäran till privacy@zalando.de. Svar inom 30 dagar.',
    instructions_en:
      'Log in to zalando.se and go to My Account → Personal data → Delete account. Or send a GDPR request to privacy@zalando.de. Response within 30 days.',
    level1_available: true,
    level2_available: true,
    level3_available: true,
    utgivningsbevis: false,
  },
]

/** Companies with Swedish publishing certificate (utgivningsbevis), sorted first */
export const COMPANIES_SORTED = [
  ...COMPANIES.filter((c) => c.utgivningsbevis),
  ...COMPANIES.filter((c) => !c.utgivningsbevis),
]
