# Dva lístky do Dejvic

## Rozšíření pro Google Chrome (doporučené)

Bot nyní funguje také přímo v desktopovém Chromu bez místního serveru a bez Node.js. Hotový balíček je v `dist/ddbot-chrome.zip`; rozbal ho a přes `chrome://extensions` → **Režim pro vývojáře** → **Načíst rozbalené** vyber složku `ddbot-chrome`.

Zachovává program, cenový limit, přípravu dvojice, hledání lepších míst i bezpečnou simulaci. Na více počítačích může běžet současně; nastavení přeneseš přes synchronizaci Chrome nebo export/import souboru. Každé zařízení má vlastní aktivaci plánování. Košíky ani běhy se mezi zařízeními nekoordinují.

Podrobná instalace, oprávnění a omezení: [docs/chrome-extension.md](docs/chrome-extension.md). Rozšíření zatím není v Chrome Web Store. Běžný mobilní Chrome není podporovaný. Během vývoje se neprováděly skutečné rezervace.

Pro vytvoření balíčku ze zdrojů: `npm run build:extension`.

## Původní místní aplikace

Místní nákupní asistent pro Dejvické divadlo. Vybereš konkrétní termín představení před každým předprodejem. Výchozí limit je **640 Kč za jeden lístek**. Bot zkusí vybrat **dva lístky**, přednostně vedle sebe, a předá otevřený prohlížeč k dokončení nákupu. Žádné údaje ani platby automaticky neodesílá.

## Použití

Dvojklik na **Spustit.command** spustí aplikaci. Otevři http://127.0.0.1:4317.

1. Načti měsíc programu a vyber konkrétní večer. Program pro budoucí měsíc se může objevit až později; v takovém případě ho načti znovu. V říjnu bývá předprodej na prosinec a doprodej na listopad.
2. Nastav cenu za jeden lístek, dobu dalšího hledání sousední dvojice (0–30 sekund) a případně výslovně zapni automatickou výměnu s rizikem. Ulož výběr.
3. Pro budoucí předprodej nastav skutečný čas podle oznámení divadla a klikni na **Čekat na předprodej**. Pro již dostupné lístky použij **Ověřit dostupnost bez rezervace** nebo **Připravit dva lístky teď**.
4. Při přípravě se otevře samostatný nákupní prohlížeč. Frontu a případné ověření vyřeš přímo v něm. Po výběru dvou míst dokonči údaje, souhlasy a platbu ručně. Zkontroluj konečnou cenu včetně poplatků a čas platnosti košíku.

Aplikace i počítač musí běžet a být vzhůru. Zavření okna aplikace v prohlížeči server nezastaví, zavření terminálu ano. Spouštěč používá `caffeinate` proti automatickému uspání; zavření víka notebooku nebo ruční uspání stále může běh přerušit. Přesnost závisí na systémových hodinách a spojení. Čekání se aktivuje jen na jeden zvolený předprodej. Po restartu musíš plánování znovu zapnout; zmeškaný termín se automaticky nedohání. Změna výběru ruší předchozí čekání. Po každém předprodeji vybereš další termín.

## Veřejné skripty Ticketportalu

Rozbor skutečného klienta a jeho omezení je v [docs/ticketportal-behavior.md](docs/ticketportal-behavior.md). Podle něj simulace předvyplňuje 10sekundovou prodlevu mapy a při zamítnutí překreslí kliknuté místo ihned.

## Simulace souboje o lístky

Na http://127.0.0.1:4317/simulation můžeš spustit fiktivní nákup bez kontaktu s Ticketportalem. Nastavíš odezvu serveru a zpoždění mapy a vybereš ztrátu prvního nebo druhého místa, několik prohraných pokusů, průběžný nápor, vyprodání nebo nejasné potvrzení. Mapa ukazuje poslední známý stav; rozbalený pohled na server ukazuje skutečný stav pro porovnání. Potvrzený košík a časová osa ukazují, co bot opravdu získal.

Simulace i skutečný bot používají stejný výběr dvojice a algoritmus doplňování košíku. Výběr začíná u středu nejpřednější dostupné řady v cenovém limitu. Nejdřív hledá sousední dvojici, jinak zajišťuje dva lístky kdekoli. U oddělené dvojice ještě po nastavenou dobu (výchozí 15 sekund) sleduje mapu a hledá sousední místa. Košík nepřekročí dva lístky. V hlavní aplikaci je automatická výměna výchozím nastavením vypnutá; nalezenou lepší dvojici nabízí k ruční výměně. Po výslovném zapnutí vyměňuje původní místa po jednom: potvrzeně uvolnit jedno původní, potvrdit nové, případně pokračovat druhým. Při ztrátě nového místa nebo nejasné odpovědi zastaví; původní místo už může být pryč. Dvě samostatná okna nebo přístroje se nepoužívají k obcházení limitu. Při potvrzené ztrátě ignoruje prohrané místo, i když je na staré mapě stále volné. Pokud už má jeden lístek, hledá pouze druhý k němu a znovu nerezervuje celou dvojici. V simulaci je možné zkusit nově uvolněného souseda, ztrátu při výměně a neúspěšné odstranění z košíku. Aktualizace mapy modeluje i odezvu požadavku a plánování další obnovy až od jeho dokončení. Pokusy jsou omezené a nejasná odpověď zastaví další klikání.

**Rozdíl oproti skutečnému webu:** simulátor umí výslovně potvrdit, že místo získal soupeř. Adaptér Ticketportalu zatím pozná ztrátu spolehlivě před kliknutím z aktualizované mapy; po kliknutí čeká na potvrzení v košíku. Když potvrzení nepřijde, předá nákup k ruční kontrole. Automatické zotavení po skutečném zamítnutí serverem zůstává neověřené. Simulace nedokládá šanci uspět při živém předprodeji.

## Stav a omezení

**První experimentální verze.** Ověřeno načtení programu, rozhraní, cenový limit, výběr dvojice a výpočet času v Praze; kontrola živého termínu Nitero našla dvě sousední místa v 8. řadě za 640 Kč/kus bez vytvoření rezervace. Skutečná rezervace dvou míst v Ticketportalu zatím není ověřena: bez uživatelova výběru termínu se žádná rezervace během vývoje neprováděla. Adaptér vychází z veřejného skriptu mapy sálu. Pokud Ticketportal změní mapu, bot nerozumí ceně, je v košíku jiná položka nebo se nepodaří potvrdit rezervaci či uvolnění, zastaví se a nákupní prohlížeč ponechá k ručnímu dokončení. Částečně vybrané místo může zůstat v košíku; nepokouší se opakovat celý nákup, aby nevytvořil další rezervace. Automatický výběr podporuje číslovaná místa; nezahrnuje přeprodávané vstupenky a označená speciální místa.

Divadlo uvádí jeden online nákup, maximálně dvě vstupenky. Asistent neobchází frontu, CAPTCHA ani prodejní limity. Získání vstupenek nelze zaručit. Pravidelný čas předprodeje je jen předvyplněný návrh, výjimky a letní přestávky ověř podle oznámení divadla.

- Program: https://www.dejvickedivadlo.cz/program
- Předprodej: https://www.dejvickedivadlo.cz/vstupenky-dd
- Pravidla: https://www.dejvickedivadlo.cz/aktualita?ida=490

## Vývoj

Vyžaduje Node.js 20.19 nebo novější. Závislosti a Chromium jsou v tomto prostředí připravené.

```sh
npm install
npm run setup
npm test
npm start
```

Server poslouchá pouze na 127.0.0.1:4317. Výběr je uložen v `data/selection.json`, profil nákupního prohlížeče v `data/browser/`. Obě složky se ignorují při verzování. Cena je strop za jeden lístek bez poplatků, které při platbě kontroluje uživatel. Aplikace nepřijímá údaje platební karty.
