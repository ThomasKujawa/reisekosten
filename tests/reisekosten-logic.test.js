'use strict';
// Ausführen: node --test "tests/*.test.js"
const test = require('node:test');
const assert = require('node:assert');
const L = require('../reisekosten-logic.js');

const pos = (beschreibung, betrag) => ({ beschreibung, betrag });

test('Bahn 49.90 EUR ergibt Fahrtkosten 49.90 EUR', () => {
    const r = L.berechneFahrtkosten('Bahn', '', [pos('Ticket', '49.90')]);
    assert.ok(r.ok);
    assert.strictEqual(r.cents, 4990);
    assert.strictEqual(L.formatCent(r.cents), '49.90');
});

test('59.90 + 49.90 ergibt 109.80 EUR (Komma und Punkt)', () => {
    const r = L.berechneFahrtkosten('Flugzeug', '', [pos('Hinflug', '59,90'), pos('Rückflug', '49.90')]);
    assert.strictEqual(r.cents, 10980);
    assert.strictEqual(L.formatCent(r.cents), '109.80');
});

test('PKW 100 km ergibt 30.00 EUR', () => {
    const r = L.berechneFahrtkosten('PKW', '100', []);
    assert.ok(r.ok);
    assert.strictEqual(L.formatCent(r.cents), '30.00');
});

test('Verkehrsmittelwechsel erzeugt keine Doppelzählung', () => {
    const positionen = [pos('Ticket', '49.90')];
    assert.strictEqual(L.berechneFahrtkosten('PKW', '100', positionen).cents, 3000);
    assert.strictEqual(L.berechneFahrtkosten('Bahn', '100', positionen).cents, 4990);
    assert.strictEqual(L.berechneFahrtkosten('Mietwagen', '100', positionen).cents, 4990);
    assert.strictEqual(L.berechneFahrtkosten('PKW', '100', positionen).cents, 3000);
});

test('Ungültige PKW-Kilometer werden abgelehnt, Positionen zählen nicht', () => {
    assert.ok(!L.berechneFahrtkosten('PKW', '-5', [pos('x', '10')]).ok);
    assert.ok(!L.berechneFahrtkosten('PKW', '', [pos('x', '10')]).ok);
    assert.ok(!L.berechneFahrtkosten('PKW', 'abc', []).ok);
});

test('Negative, leere und ungültige Beträge werden abgelehnt', () => {
    ['-1', '-0,01', '', '   ', 'abc', '1,234', '1e3', '12,', '1.000,00', '0x10'].forEach(v => {
        const r = L.berechneFahrtkosten('Bahn', '', [pos('Ticket', v)]);
        assert.ok(!r.ok, 'sollte abgelehnt werden: ' + JSON.stringify(v));
        assert.strictEqual(r.cents, 0);
    });
});

test('Beschreibung und mindestens eine Position sind Pflicht', () => {
    assert.ok(!L.berechneFahrtkosten('Bahn', '', [pos('  ', '10')]).ok);
    assert.ok(!L.berechneFahrtkosten('Bahn', '', []).ok);
    assert.ok(!L.berechneFahrtkosten('', '', []).ok);
});

test('0 EUR ist erlaubt, erzeugt aber einen Hinweis', () => {
    const r = L.berechneFahrtkosten('Bahn', '', [pos('Freifahrt', '0')]);
    assert.ok(r.ok);
    assert.strictEqual(r.cents, 0);
    assert.strictEqual(r.warnings.length, 1);
});

test('Cent-Summierung ohne Gleitkommafehler', () => {
    const r = L.berechneFahrtkosten('Sonstige', '', [pos('a', '0.10'), pos('b', '0.20'), pos('c', '0.7')]);
    assert.strictEqual(r.cents, 100);
});

const pdfHeader = [0x25, 0x50, 0x44, 0x46, 0x2d];
const datei = (name, size) => ({ name, type: 'application/pdf', size });

test('Belege: Typ, Größe und Inhalt werden geprüft', () => {
    assert.ok(L.pruefeBeleg(datei('a.pdf', 100), pdfHeader).ok);
    assert.ok(L.pruefeBeleg({ name: 'a.JPG', type: 'image/jpeg', size: 100 }, [0xFF, 0xD8, 0xFF, 0xE0]).ok);
    assert.ok(L.pruefeBeleg({ name: 'a.png', type: 'image/png', size: 100 }, [0x89, 0x50, 0x4E, 0x47]).ok);
    assert.ok(!L.pruefeBeleg({ name: 'a.exe', type: 'application/x-msdownload', size: 100 }).ok);
    assert.ok(!L.pruefeBeleg({ name: 'a.pdf', type: 'image/png', size: 100 }).ok);
    assert.ok(!L.pruefeBeleg(datei('a.pdf', 100), [1, 2, 3, 4]).ok);
    assert.ok(!L.pruefeBeleg(datei('a.pdf', 0), pdfHeader).ok);
    assert.ok(!L.pruefeBeleg(datei('a.pdf', L.BELEG_LIMITS.maxDateiBytes + 1), pdfHeader).ok);
});

test('Belege auswählen, Limits und entfernen', () => {
    const liste = [];
    assert.ok(L.fuegeBelegHinzu(liste, datei('a.pdf', 10), pdfHeader).ok);
    assert.ok(L.fuegeBelegHinzu(liste, datei('b.pdf', 10), pdfHeader).ok);
    assert.strictEqual(liste.length, 2);
    assert.ok(!L.fuegeBelegHinzu(liste, datei('c.txt', 10)).ok);
    assert.strictEqual(liste.length, 2);
    L.entferneBeleg(liste, 0);
    assert.deepStrictEqual(liste.map(b => b.name), ['b.pdf']);
    while (liste.length < L.BELEG_LIMITS.maxAnzahl) liste.push(datei('x.pdf', 1));
    assert.ok(!L.fuegeBelegHinzu(liste, datei('z.pdf', 1), pdfHeader).ok);

    const gross = [1, 2, 3, 4].map(i => datei('g' + i + '.pdf', L.BELEG_LIMITS.maxDateiBytes));
    assert.ok(!L.pruefeBelegLimits(gross, datei('k.pdf', 1)).ok);
});

test('Dateinamen sind sicher und kollisionsfrei', () => {
    const namen = L.erzeugeBelegNamen(['../../etc/passwd.pdf', 'Quittung Ä.pdf', 'Quittung Ä.pdf', 'a:b*c?.PNG', '.hidden.jpeg', 'CON.pdf']);
    assert.strictEqual(new Set(namen.map(n => n.toLowerCase())).size, namen.length);
    namen.forEach(n => {
        assert.match(n, /^Beleg_\d\d_[A-Za-z0-9._-]+\.(pdf|png|jpg)$/);
        assert.ok(!n.includes('..') && !n.includes('/'));
    });
});

// Liest ein ZIP über das Central Directory zurück (unabhängig vom Writer).
function leseZip(buf) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const eocd = buf.length - 22;
    assert.strictEqual(dv.getUint32(eocd, true), 0x06054b50);
    const anzahl = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const out = {};
    for (let i = 0; i < anzahl; i++) {
        assert.strictEqual(dv.getUint32(p, true), 0x02014b50);
        const crc = dv.getUint32(p + 16, true);
        const size = dv.getUint32(p + 24, true);
        const nl = dv.getUint16(p + 28, true);
        const lo = dv.getUint32(p + 42, true);
        const name = Buffer.from(buf.subarray(p + 46, p + 46 + nl)).toString('utf8');
        const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
        const data = buf.subarray(start, start + size);
        assert.strictEqual(L.crc32(data), crc);
        out[name] = Buffer.from(data);
        p += 46 + nl;
    }
    return out;
}

test('ZIP enthält Abrechnungs-PDF und Originalbelege unverändert', () => {
    const pdf = Buffer.from('%PDF-1.3 abrechnung');
    const b1 = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0, 1, 2, 255]);
    const b2 = Buffer.from('%PDF-1.4 ticket');
    const namen = L.erzeugeBelegNamen(['ticket.png', 'ticket.pdf']);
    const zip = L.erstelleZip([
        { name: 'Reisekostenabrechnung.pdf', data: new Uint8Array(pdf) },
        { name: 'Belege/' + namen[0], data: new Uint8Array(b1) },
        { name: 'Belege/' + namen[1], data: new Uint8Array(b2) }
    ]);
    const inhalt = leseZip(zip);
    assert.deepStrictEqual(Object.keys(inhalt), ['Reisekostenabrechnung.pdf', 'Belege/' + namen[0], 'Belege/' + namen[1]]);
    assert.ok(inhalt['Reisekostenabrechnung.pdf'].equals(pdf));
    assert.ok(inhalt['Belege/' + namen[0]].equals(b1));
    assert.ok(inhalt['Belege/' + namen[1]].equals(b2));
});
