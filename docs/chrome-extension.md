# Dva lístky do Dejvic pro Google Chrome

## Instalace na každý počítač

1. Rozbal `ddbot-chrome.zip`. Složku `ddbot-chrome` ulož na trvalé místo.
2. V desktopovém Chromu 120 nebo novějším otevři `chrome://extensions`.
3. Zapni **Režim pro vývojáře**, klikni na **Načíst rozbalené** a vyber složku `ddbot-chrome` obsahující `manifest.json`.
4. V nabídce rozšíření připni **Dva lístky do Dejvic**. Kliknutím na ikonu otevřeš asistenta.

Funguje na Windows, macOS a Linuxu. Běžný mobilní Chrome rozšíření nepodporuje. Není potřeba Node.js, terminál ani místní server. Složku po instalaci nemaž. Balíček není zveřejněný v Chrome Web Store; instalace a aktualizace jsou zatím ruční. Po nahrazení souborů klikni v `chrome://extensions` na obnovení rozšíření a zkontroluj plánování.

## Použití

Načti měsíc programu, vyber konkrétní termín, nastav cenu a čas předprodeje v Praze a ulož výběr. Potom můžeš ověřit dostupnost bez rezervace, připravit dva lístky ihned nebo zapnout čekání. Asistent otevírá nákup v nové kartě tvého Chrome, takže používá tvé stávající přihlášení a košík Ticketportalu. Existující košík zastaví automatickou rezervaci.

Při přípravě Chrome zobrazí lištu oznamující ovládání prohlížeče. Oprávnění `debugger` slouží k běžným kliknutím na mapu sálu. Zavření lišty, nákupní karty nebo otevření DevTools může běh přerušit. Další oprávnění slouží k uložení nastavení, plánování, čtení programu a mapy a omezení automatického uspání. Přístup k webům je omezen na Dejvické divadlo a Ticketportal; nic se neodesílá na vlastní server.

Zavření stránky asistenta běh ani čekání nezastaví. Chrome a počítač musí běžet; zavření víka, ruční uspání, restart nebo odpojení internetu mohou předprodej zmeškat. Chrome alarmy negarantují přesné spuštění na sekundu. Zpoždění nad minutu zastaví automatické spuštění. Budoucí čekání se obnovuje při startu Chrome; již uplynulý termín se po restartu automaticky nespouští. Přerušená rezervace se neopakuje; nejprve zkontroluj košík. Po každém běhu zapni nové čekání ručně.

Výchozí limit je 640 Kč za lístek. Bot vybírá nejvýše dva lístky, přednostně vedle sebe, a ověřuje potvrzení v košíku. Oddělenou dvojici ještě sleduje po zvolenou dobu. Automatická výměna je výchozím nastavením vypnutá; její zapnutí může ztratit původní místo. Frontu, CAPTCHA, kontaktní údaje, souhlasy i platbu řešíš ručně. Po potvrzení dvojice pokračuj na stránce Ticketportalu ke košíku a platbě.

## Více zařízení současně

Rozšíření nainstaluj na každý počítač ze stejného balíčku. Každé zařízení může mít vlastní termín, nastavení, plánování a nezávislý běh.

Pro přenos stejného výběru klikni na prvním zařízení na **Sdílet nastavení přes Chrome** a na druhém na **Načíst sdílené nastavení**. Vyžaduje stejný účet Google a zapnutou synchronizaci rozšíření. Synchronizace může mít zpoždění. Stabilní identifikátor rozšíření v balíčku umožňuje sdílení i při instalaci z různých složek.

Pro jiné účty nebo vypnutou synchronizaci použij **Exportovat nastavení** a **Import ze souboru**. Přenáší se pouze výběr a preference, žádné cookies, přihlášení, košíky, spuštěné běhy ani výsledky. Import nikdy nezapíná čekání; aktivuj ho na každém zařízení zvlášť. Přenos lze opakovat pro další předprodej. Změna výběru na jednom počítači nepřeruší běh na ostatních.

Běhy nemají společný zámek ani centrální řízení. Po úspěchu zastav ostatní zařízení ručně. Stejný účet Ticketportalu může sdílet košík na straně prodejce; nezávislý běh rozšíření nezaručuje nezávislý košík. Více zařízení nemění limit nákupu divadla a nezajišťuje získání vstupenek.

## Ověření a omezení

Přibalená simulace funguje bez internetu a bez rezervací. Používá stejný algoritmus jako asistent. Automatická příprava v živém Ticketportalu je experimentální a skutečná rezervace nebyla během vývoje provedena. Při změně mapy nebo nejasné odpovědi bot zastaví další klikání a ponechá kartu k ruční kontrole.

## Sestavení ze zdrojů

V projektu spusť `npm run build:extension`. Vznikne složka `dist/ddbot-chrome/` a balíček `dist/ddbot-chrome.zip`. Žádný profil prohlížeče, uložený osobní výběr ani závislosti nejsou v balíčku. `npm test` ověřuje sdílený algoritmus. `npm run test:extension` sestaví balíček a ověří rozšíření v izolovaném testovacím Chromu proti fiktivnímu programu a košíku. Test vyžaduje připravený Playwright Chromium a nástroje OpenSSL a zip; oba weby přesměruje na místní testovací server.
