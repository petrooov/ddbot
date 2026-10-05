# Co lze zjistit z veřejného klienta Ticketportalu

Ověřeno 5. října 2026 na skriptech odkazovaných ze stránky Nitero, termín 18. října 2026. Jde o veřejný kód prohlížeče; serverové zpracování rezervací ani skutečnou rychlost při předprodeji z něj zjistit nelze. Při průzkumu nebyl odeslán žádný požadavek na rezervaci.

Zdroj: [Hladsiko-ui-1.0.13.js?v=252](https://www.ticketportal.cz/Scripts/Hladsiko-ui-1.0.13.js?v=252), zejména `OnSeat_click`, `OznacMiesto`, `ReloadBasket` a `ReloadSeats`.

## Aktualizace mapy

`ReloadSeats` načte stav míst z odkazu `linkmiesta`, překreslí mapu a v úspěšném callbacku naplánuje další aktualizaci za 10 000 ms. Je to 10 sekund po dokončení požadavku, ne nutně pevný desetisekundový interval. Při pomalém spojení může být rozdíl mezi aktualizacemi větší. Po síťové chybě v této funkci není vidět obecná obsluha opakování: samotný tento kód nemusí další aktualizaci naplánovat. Další skripty mohou mít jiné mechanismy.

Viditelná dostupnost tedy není rezervace. Jiný zájemce může sedadlo mezitím získat; jak přesně o tom rozhoduje server, ve veřejném skriptu není.

## Kliknutí a potvrzení

Neoznačené místo vede přes `OnSeat_click` na `OznacMiesto`. Klient nejprve kontroluje některé limity. Potom běžným požadavkem volá cestu `Event/AddSeats/<představení>/<místo>` s parametry vlastní relace. Zobrazení zeleného či jinak volného místa před kliknutím není zárukou přijetí tohoto požadavku.

Úspěšná větev vyžaduje dvě hodnoty: `data.Succeeded` a `data.ReturnedObject.Succeeded`. Poté převezme `ReturnedObject.Basket`, označí získané místo a překreslí mapu. Samotné úspěšné HTTP spojení nedokládá získaný lístek; je nutné ověřit položku v košíku.

Při zamítnutí v jedné z těchto větví nastaví stav kliknutého místa na `1`, ihned překreslí mapu a zobrazí `alert(data.Message)`. Tato větev sama o sobě neříká, že místo získal soupeř: zpráva může být o limitu, oprávnění nebo jiné chybě. Texty a jejich úplný seznam z tohoto souboru neznáme. Blokující dialog navíc může pozastavit další činnost stránky.

Kliknutí na už označené místo vede na `OdznacMiesto`, tedy na odstranění rezervace. Opakované kliknutí naslepo může být nežádoucí i při opožděném potvrzení.

## Dopad na simulaci a bota

Simulace nyní předvyplňuje zpoždění mapy 10 sekund a po explicitním zamítnutí okamžitě znepřístupní právě kliknuté místo. Ostatní místa zůstávají podle posledního načteného stavu. Délka odpovědi serveru a soupeři jsou nadále fiktivní. Simulátor předem ví, že zamítnutí způsobil soupeř; skutečný adaptér tuto znalost nemá.

Bot před kliknutím znovu čte dostupnost. Pokud je už místo nedostupné, vybírá náhradu; jestli má první lístek, hledá jen jeho doplnění. Po kliknutí zatím ověřuje potvrzení v košíku. Když nepřijde, zastaví se a předá ruční kontrolu. Ještě nesleduje a neklasifikuje konkrétní odpověď `AddSeats` ani její chybový dialog. Z veřejného kódu nyní víme, kde tuto informaci hledat, ale bezpečné automatické pokračování podle konkrétních chyb vyžaduje ověření skutečných odpovědí.

Simulace nepotvrzuje vlastnosti serveru, dobu platnosti rezervace, pořadí ve frontě, chování při výpadku či zátěži, ani šanci získat vstupenky. Pro ověření serverového konfliktu by bylo potřeba pozorovat skutečné zamítnutí; k tomu při tomto průzkumu nedošlo.
