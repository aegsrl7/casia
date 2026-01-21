# Casia Country House - Brief per sviluppo sito web

## Panoramica progetto

Sito web per **Casia Country House**, una casa vacanze situata nella campagna piemontese a **Santo Stefano**, frazione di **Bene Vagienna** (provincia di Cuneo).

Il sito deve essere una **single-page** elegante, pronta per il deploy su **Cloudflare Pages**.

---

## Brand Identity

### Nome
**CASIA** - Country House

### Logo
File: `images/logo.png`
- Icona: casetta stilizzata con fiore di lavanda e luna/sole
- Due versioni: scuro su chiaro, rame su scuro
- Font del logo: serif elegante con spaziatura ampia

### Palette colori (da logo)
- **Rame/Terracotta**: `#B8956B` - colore principale
- **Rame chiaro**: `#D4B896` - accent
- **Antracite**: `#2D2926` - testi
- **Crema**: `#F8F5F0` - sfondo
- **Bianco**: `#FFFFFF`

### Tono
Raffinato ma accogliente. Cascina piemontese di charme. No lusso ostentato, sì autenticità ed eleganza discreta.

---

## Struttura della pagina

### 1. Hero Section
- Logo centrato
- Headline: "Riposo autentico nella campagna piemontese"
- Sottotitolo: "Santo Stefano, Bene Vagienna"
- Immagine di sfondo: esterno della casa (`images/esterno.jpg`)
- CTA: "Scopri la casa" (scroll) + "Prenota ora" (link booking)

### 2. Introduzione
Breve testo evocativo sulla location:
> Nel cuore delle colline del Cuneese, Casia Country House è un rifugio di pace dove il tempo rallenta. Una cascina storica restaurata con cura, che unisce il fascino dell'architettura piemontese tradizionale al comfort contemporaneo.

### 3. La Casa (Gallery)
Grid/carousel delle stanze con le foto disponibili:

| Foto | File | Descrizione |
|------|------|-------------|
| Esterno | `images/esterno.jpg` | Cascina storica color rosa antico con decorazioni a fascia, persiane verdi, scalinata d'ingresso |
| Cucina | `images/cucina.jpg` | Cucina moderna attrezzata, tavolo 4 posti, pavimento in cotto, arco in muratura, luce naturale |
| Soggiorno | `images/soggiorno.jpg` | Divano ad angolo grigio (divano letto), parquet chiaro, tavolino in vetro, ambiente luminoso |
| Camera | `images/camera.jpg` | Mansarda con travi a vista in legno, letto matrimoniale con testiera in ferro battuto, atmosfera intima |
| Bagno | `images/bagno.jpg` | Bagno con doccia in mosaico, sotto il tetto con travi, moderno e curato |

### 4. Servizi / Comfort
Icone + testo per:
- WiFi gratuito
- Cucina attrezzata (frigorifero, macchina caffè, tostapane, bollitore)
- Riscaldamento autonomo
- Biancheria e asciugamani inclusi
- Parcheggio privato
- Giardino
- Animali ammessi (da confermare - metti placeholder)

### 5. Il Territorio
Breve sezione su cosa vedere:
- **Bene Vagienna**: borgo romano con resti archeologici di Augusta Bagiennorum
- **Langhe e Roero**: a breve distanza, terre del Barolo e del tartufo
- **Cuneo**: 25 km
- **Torino**: 70 km
- **Alba**: 40 km

Mappa embed Google Maps centrata su: Santo Stefano, Bene Vagienna, CN

### 6. Prenota
- Testo: "Prenota il tuo soggiorno"
- Bottone CTA grande verso sistema di booking (placeholder: `#booking`)
- Info contatto: email placeholder `info@casiacountryhouse.it`
- Nota: "Risposta entro 24 ore"

### 7. Footer
- Logo piccolo
- Indirizzo: Santo Stefano, Bene Vagienna (CN) - Piemonte, Italia
- Email: info@casiacountryhouse.it
- Link social placeholder (Instagram)
- Copyright 2025
- P.IVA placeholder

---

## Specifiche tecniche

### Stack
- **HTML5 + CSS3 + JavaScript vanilla**
- Nessun framework (deve essere leggero e deployabile su Cloudflare Pages)
- Single file `index.html` con CSS inline o file separato `style.css`

### Font
Usa Google Fonts:
- **Display/Titoli**: `Cormorant Garamond` (serif elegante)
- **Body**: `Jost` (sans-serif leggero, leggibile)

### Responsive
- Mobile-first
- Breakpoints: 768px (tablet), 1024px (desktop)
- Menu hamburger su mobile

### Performance
- Immagini: usare `loading="lazy"`
- Ottimizzare per Core Web Vitals
- Nessuna dipendenza esterna pesante

### Animazioni
- Fade-in on scroll per le sezioni
- Hover effects discreti sui bottoni e immagini
- Transizioni smooth (300ms ease)

---

## Design guidelines

### Stile visivo
- **Eleganza rurale**: non minimalismo freddo, non rustico pesante
- Spazi generosi, aria tra gli elementi
- Immagini grandi, testi concisi
- Texture sottile sullo sfondo (tipo carta, lino) opzionale

### Cose da EVITARE
- Gradienti viola/blu tipici "AI"
- Font generici (Inter, Roboto, Arial)
- Layout troppo simmetrici e prevedibili
- Effetti parallax esagerati
- Stock photo feeling

### Ispirazione
Siti di agriturismi e country house di fascia medio-alta in Toscana/Piemonte. Boutique hotel rurali. Stile editorial ma caldo.

---

## File structure attesa

```
casia-country-house/
├── index.html
├── style.css (opzionale, può essere inline)
├── script.js (opzionale, per animazioni)
└── images/
    ├── logo.png
    ├── esterno.jpg
    ├── cucina.jpg
    ├── soggiorno.jpg
    ├── camera.jpg
    └── bagno.jpg
```

---

## Note per lo sviluppatore

1. Le foto sono ad alta risoluzione e non ancora ottimizzate - nel sito usale così come sono per ora, l'ottimizzazione verrà dopo

2. Il sistema di booking non è ancora deciso - usa un bottone placeholder che punta a `#booking` o a un link generico

3. I testi sono bozze - il cliente potrebbe modificarli, quindi struttura il codice per facile editing

4. Il sito deve essere **presentabile stasera** come bozza - non deve essere perfetto ma deve dare l'idea del risultato finale

5. Priorità: **impatto visivo** > funzionalità avanzate

---

## Checklist pre-consegna

- [ ] Hero con logo e immagine d'impatto
- [ ] Sezione presentazione
- [ ] Gallery foto stanze
- [ ] Lista servizi
- [ ] Sezione territorio
- [ ] CTA prenotazione
- [ ] Footer con contatti
- [ ] Responsive mobile/tablet/desktop
- [ ] Animazioni base di scroll
- [ ] Meta tags SEO base
