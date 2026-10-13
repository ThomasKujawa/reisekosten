/*
 * Reine Berechnungs- und Datei-Logik der Reisekostenabrechnung.
 * Keine DOM-Zugriffe, damit sie mit Node (tests/) getestet werden kann.
 * Alle Beträge werden intern in Cent (ganze Zahlen) gerechnet.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ReisekostenLogic = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const KM_SATZ_CENT = 30;
    const PKW = 'PKW';
    const POSITIONS_VERKEHRSMITTEL = ['Bahn', 'Flugzeug', 'Mietwagen', 'Sonstige'];
    const MAX_BETRAG_CENT = 99999999;

    const BELEG_LIMITS = {
        maxAnzahl: 10,
        maxDateiBytes: 5 * 1024 * 1024,
        maxGesamtBytes: 20 * 1024 * 1024
    };

    const BELEG_TYPEN = {
        pdf: { ext: 'pdf', mimes: ['application/pdf'] },
        jpg: { ext: 'jpg', mimes: ['image/jpeg'] },
        jpeg: { ext: 'jpg', mimes: ['image/jpeg'] },
        png: { ext: 'png', mimes: ['image/png'] }
    };

    function formatCent(cent) {
        const sign = cent < 0 ? '-' : '';
        const abs = Math.abs(cent);
        return sign + Math.floor(abs / 100) + '.' + String(abs % 100).padStart(2, '0');
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1).replace('.', ',') + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
    }

    // Wandelt eine Eingabe wie "49,90" oder "49.9" ohne Gleitkommarechnung in Cent um.
    function parseBetragToCent(input) {
        const text = String(input === undefined || input === null ? '' : input).trim();
        if (text === '') {
            return { ok: false, error: 'Bitte einen Betrag eingeben.' };
        }
        if (/^-/.test(text)) {
            return { ok: false, error: 'Der Betrag darf nicht negativ sein.' };
        }
        const match = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(text);
        if (!match) {
            return { ok: false, error: 'Ungültiger Betrag. Bitte z. B. 49,90 eingeben.' };
        }
        const cent = parseInt(match[1], 10) * 100 + (match[2] ? parseInt(match[2].padEnd(2, '0'), 10) : 0);
        if (cent > MAX_BETRAG_CENT) {
            return { ok: false, error: 'Der Betrag ist zu groß.' };
        }
        return { ok: true, cents: cent };
    }

    function parseKilometer(input) {
        const text = String(input === undefined || input === null ? '' : input).trim().replace(',', '.');
        if (text === '') {
            return { ok: false, error: 'Bitte die Kilometer eingeben.' };
        }
        if (!/^-?\d+(\.\d+)?$/.test(text)) {
            return { ok: false, error: 'Ungültige Kilometerangabe.' };
        }
        const km = parseFloat(text);
        if (km < 0) {
            return { ok: false, error: 'Die Kilometer dürfen nicht negativ sein.' };
        }
        if (km > 100000) {
            return { ok: false, error: 'Die Kilometerangabe ist zu groß.' };
        }
        return { ok: true, km: km };
    }

    /*
     * Fahrtkosten ausschließlich nach gewähltem Verkehrsmittel:
     *  - PKW: Kilometer * 0,30 EUR; Positionen werden ignoriert
     *  - Bahn/Flugzeug/Mietwagen/Sonstige: Summe der Positionen; Kilometer werden ignoriert
     * positionen: [{ beschreibung, betrag }] (Rohtext der Eingabefelder)
     */
    function berechneFahrtkosten(verkehrsmittel, kilometer, positionen) {
        const errors = [];
        const warnings = [];
        const items = [];
        let cents = 0;

        if (verkehrsmittel === PKW) {
            const km = parseKilometer(kilometer);
            if (!km.ok) {
                errors.push({ field: 'kilometer', index: -1, message: km.error });
            } else {
                cents = Math.round(km.km * KM_SATZ_CENT);
                if (cents === 0) {
                    warnings.push('Es wurden 0 km angegeben, die Fahrtkosten betragen 0,00 €.');
                }
            }
        } else if (POSITIONS_VERKEHRSMITTEL.indexOf(verkehrsmittel) !== -1) {
            const liste = positionen || [];
            if (liste.length === 0) {
                errors.push({ field: 'positionen', index: -1, message: 'Bitte mindestens eine Fahrtkostenposition erfassen.' });
            }
            liste.forEach(function (pos, index) {
                const beschreibung = String(pos.beschreibung || '').trim();
                if (beschreibung === '') {
                    errors.push({ field: 'beschreibung', index: index, message: 'Position ' + (index + 1) + ': Bitte eine Beschreibung eingeben.' });
                }
                const betrag = parseBetragToCent(pos.betrag);
                if (!betrag.ok) {
                    errors.push({ field: 'betrag', index: index, message: 'Position ' + (index + 1) + ': ' + betrag.error });
                    return;
                }
                if (betrag.cents === 0) {
                    warnings.push('Position ' + (index + 1) + ' hat einen Betrag von 0,00 €. Bitte prüfen, ob das gewollt ist.');
                }
                if (beschreibung !== '') {
                    items.push({ beschreibung: beschreibung, cents: betrag.cents });
                }
                cents += betrag.cents;
            });
        } else {
            errors.push({ field: 'verkehrsmittel', index: -1, message: 'Bitte ein Verkehrsmittel wählen.' });
        }

        return { ok: errors.length === 0, errors: errors, warnings: warnings, cents: errors.length === 0 ? cents : 0, items: items };
    }

    function dateiEndung(name) {
        const match = /\.([A-Za-z0-9]+)$/.exec(String(name || ''));
        return match ? match[1].toLowerCase() : '';
    }

    function pruefeMagicBytes(ext, header) {
        if (!header || header.length < 4) return false;
        if (ext === 'pdf') return header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
        if (ext === 'png') return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
        if (ext === 'jpg') return header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF;
        return false;
    }

    // datei: { name, type, size }, header: erste Bytes der Datei (optional)
    function pruefeBeleg(datei, header) {
        const typ = BELEG_TYPEN[dateiEndung(datei.name)];
        if (!typ) {
            return { ok: false, error: '„' + datei.name + '“: Nur PDF, JPEG und PNG sind erlaubt.' };
        }
        if (datei.type && typ.mimes.indexOf(datei.type) === -1) {
            return { ok: false, error: '„' + datei.name + '“: Dateityp passt nicht zur Endung. Erlaubt sind PDF, JPEG und PNG.' };
        }
        if (datei.size <= 0) {
            return { ok: false, error: '„' + datei.name + '“: Die Datei ist leer.' };
        }
        if (datei.size > BELEG_LIMITS.maxDateiBytes) {
            return { ok: false, error: '„' + datei.name + '“: Die Datei ist größer als ' + formatBytes(BELEG_LIMITS.maxDateiBytes) + '.' };
        }
        if (header !== undefined && !pruefeMagicBytes(typ.ext, header)) {
            return { ok: false, error: '„' + datei.name + '“: Der Dateiinhalt entspricht nicht dem Dateityp.' };
        }
        return { ok: true, ext: typ.ext };
    }

    // Prüft Anzahl- und Gesamtgrößen-Limits für eine neue Datei bei bereits vorhandenen Belegen.
    function pruefeBelegLimits(vorhandene, neu) {
        if (vorhandene.length + 1 > BELEG_LIMITS.maxAnzahl) {
            return { ok: false, error: '„' + neu.name + '“: Maximal ' + BELEG_LIMITS.maxAnzahl + ' Belege möglich.' };
        }
        const gesamt = vorhandene.reduce(function (sum, b) { return sum + b.size; }, 0) + neu.size;
        if (gesamt > BELEG_LIMITS.maxGesamtBytes) {
            return { ok: false, error: '„' + neu.name + '“: Gesamtgröße aller Belege darf ' + formatBytes(BELEG_LIMITS.maxGesamtBytes) + ' nicht überschreiten.' };
        }
        return { ok: true };
    }

    // Fügt einen Beleg (name/type/size plus beliebiger Datenverweis) der Liste hinzu, falls er gültig ist.
    function fuegeBelegHinzu(liste, beleg, header) {
        const typ = pruefeBeleg(beleg, header);
        if (!typ.ok) return typ;
        const limit = pruefeBelegLimits(liste, beleg);
        if (!limit.ok) return limit;
        liste.push(beleg);
        return { ok: true };
    }

    function entferneBeleg(liste, index) {
        if (index >= 0 && index < liste.length) liste.splice(index, 1);
        return liste;
    }

    // Entfernt Pfade/Sonderzeichen; das Ergebnis enthält nur [A-Za-z0-9._-].
    function sanitizeDateiname(name) {
        let base = String(name || '').split(/[\\/]/).pop();
        base = base.replace(/\.[^.]*$/, '');
        base = base.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
            .replace(/ß/g, 'ss')
            .replace(/[^A-Za-z0-9._-]+/g, '_')
            .replace(/^[._-]+/, '')
            .replace(/[._-]+$/, '');
        if (base.length > 60) base = base.slice(0, 60);
        return base || 'Beleg';
    }

    // Eindeutige, sichere ZIP-Namen: Beleg_01_<name>.<ext>. Die Nummer garantiert Kollisionsfreiheit.
    function erzeugeBelegNamen(namen) {
        const used = {};
        return namen.map(function (original, i) {
            const ext = (BELEG_TYPEN[dateiEndung(original)] || { ext: 'bin' }).ext;
            const nummer = String(i + 1).padStart(2, '0');
            const kandidat = 'Beleg_' + nummer + '_' + sanitizeDateiname(original);
            let name = kandidat + '.' + ext;
            let zaehler = 2;
            while (used[name.toLowerCase()]) {
                name = kandidat + '_' + zaehler++ + '.' + ext;
            }
            used[name.toLowerCase()] = true;
            return name;
        });
    }

    let crcTable = null;
    function crc32(bytes) {
        if (!crcTable) {
            crcTable = new Uint32Array(256);
            for (let n = 0; n < 256; n++) {
                let c = n;
                for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                crcTable[n] = c >>> 0;
            }
        }
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    // Minimaler ZIP-Writer (Methode "stored", keine Kompression, kein ZIP64). Keine externe Abhängigkeit.
    // eintraege: [{ name: string, data: Uint8Array }]
    function erstelleZip(eintraege, datum) {
        const d = datum || new Date();
        const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
        const dosDate = (Math.max(d.getFullYear() - 1980, 0) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
        const encoder = new TextEncoder();
        const teile = [];
        const zentral = [];
        let offset = 0;

        eintraege.forEach(function (e) {
            const nameBytes = encoder.encode(e.name);
            const crc = crc32(e.data);
            const lokal = new DataView(new ArrayBuffer(30));
            lokal.setUint32(0, 0x04034b50, true);
            lokal.setUint16(4, 20, true);
            lokal.setUint16(6, 0x0800, true);
            lokal.setUint16(8, 0, true);
            lokal.setUint16(10, dosTime, true);
            lokal.setUint16(12, dosDate, true);
            lokal.setUint32(14, crc, true);
            lokal.setUint32(18, e.data.length, true);
            lokal.setUint32(22, e.data.length, true);
            lokal.setUint16(26, nameBytes.length, true);
            lokal.setUint16(28, 0, true);
            teile.push(new Uint8Array(lokal.buffer), nameBytes, e.data);

            const zd = new DataView(new ArrayBuffer(46));
            zd.setUint32(0, 0x02014b50, true);
            zd.setUint16(4, 20, true);
            zd.setUint16(6, 20, true);
            zd.setUint16(8, 0x0800, true);
            zd.setUint16(10, 0, true);
            zd.setUint16(12, dosTime, true);
            zd.setUint16(14, dosDate, true);
            zd.setUint32(16, crc, true);
            zd.setUint32(20, e.data.length, true);
            zd.setUint32(24, e.data.length, true);
            zd.setUint16(28, nameBytes.length, true);
            zd.setUint32(42, offset, true);
            zentral.push(new Uint8Array(zd.buffer), nameBytes);

            offset += 30 + nameBytes.length + e.data.length;
        });

        let zentralGroesse = 0;
        zentral.forEach(function (z) { zentralGroesse += z.length; });
        const ende = new DataView(new ArrayBuffer(22));
        ende.setUint32(0, 0x06054b50, true);
        ende.setUint16(8, eintraege.length, true);
        ende.setUint16(10, eintraege.length, true);
        ende.setUint32(12, zentralGroesse, true);
        ende.setUint32(16, offset, true);

        const alle = teile.concat(zentral, [new Uint8Array(ende.buffer)]);
        const gesamt = alle.reduce(function (sum, t) { return sum + t.length; }, 0);
        const out = new Uint8Array(gesamt);
        let pos = 0;
        alle.forEach(function (t) { out.set(t, pos); pos += t.length; });
        return out;
    }

    return {
        KM_SATZ_CENT: KM_SATZ_CENT,
        BELEG_LIMITS: BELEG_LIMITS,
        formatCent: formatCent,
        formatBytes: formatBytes,
        parseBetragToCent: parseBetragToCent,
        parseKilometer: parseKilometer,
        berechneFahrtkosten: berechneFahrtkosten,
        pruefeBeleg: pruefeBeleg,
        pruefeBelegLimits: pruefeBelegLimits,
        fuegeBelegHinzu: fuegeBelegHinzu,
        entferneBeleg: entferneBeleg,
        sanitizeDateiname: sanitizeDateiname,
        erzeugeBelegNamen: erzeugeBelegNamen,
        crc32: crc32,
        erstelleZip: erstelleZip
    };
}));
