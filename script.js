// --- VARIABILI GLOBALI ---
let dizionario = [];
let soluzioniTotali = []; // Tutte le risposte possibili di oggi
let paroleTrovate = [];
let lettereLivello = [];  // [0] è la centrale
let letteraCentrale = '';
let punteggio = 0;
let seedOggi = 0;

// Variabili per i conteggi
let totalPangrams = 0;
let foundPangrams = 0;

// Variabili Suggerimenti
let hintsConsumed = 0;      // Suggerimenti già usati
let activeHintWord = null;  // La parola attualmente suggerita (se c'è)

// Variabili Timer e Ordinamento
let sortMode = 'alpha'; // 'alpha' (A-Z) o 'time' (Cronologico)
// --- MODIFICA TIMER (Nuove Variabili) ---
let timerInterval;
let tempoTrascorso = 0;   // Secondi totali accumulati
let isPaused = false;     // Stato della pausa manuale
let isPageHidden = false; // Stato della visibilità pagina
let isMenuOpen = false;   // Stato della sidebar/menu

// Elementi HTML (Solo quelli che servono con il nuovo layout)
const inputEl = document.getElementById('text-input');
const messageEl = document.getElementById('message');
const timerEl = document.getElementById('timer');
const sortBtn = document.getElementById('sort-btn');
const hintBtn = document.getElementById('hint-btn');
const hintCountEl = document.getElementById('hint-count');
const hintMsgBox = document.getElementById('hint-msg-box');
const hintTextEl = document.getElementById('hint-text');
// Nota: Gli altri elementi li selezioniamo dinamicamente in aggiornaUI

// --- 1. AVVIO ---
async function initGame() {
    try {
        const response = await fetch('data/parole_ali.json');
        if (!response.ok) throw new Error("File JSON non trovato");

        dizionario = await response.json();
        seedOggi = getSeedDiOggi();

        gestisciPartitaDelGiorno();
        setupControlli();
        startTimer(); // Avvia la nuova logica timer

    } catch (e) {
        console.error(e);
        mostraMessaggio("Errore caricamento gioco", "error");
    }
}

// --- 2. LOGICA "DAILY" ---
function getSeedDiOggi() {
    const now = new Date();
    const anno = now.getFullYear();
    const mese = (now.getMonth() + 1).toString().padStart(2, '0');
    const giorno = now.getDate().toString().padStart(2, '0');
    return parseInt(`${anno}${mese}${giorno}`);
}

function gestisciPartitaDelGiorno() {
    trovaPangrammaDelGiorno();

    const salvataggio = localStorage.getItem(`apegramma_${seedOggi}`);

    if (salvataggio) {
        const dati = JSON.parse(salvataggio);
        if (dati.lettereMischiate) lettereLivello = dati.lettereMischiate;
        else shuffleLettere();

        paroleTrovate = dati.parole;
        punteggio = dati.punti;

        // --- MODIFICA TIMER (Caricamento tempo) ---
        // Se esiste un salvataggio del tempo trascorso, usalo. Altrimenti parti da 0.
        if (dati.tempoTrascorso) tempoTrascorso = dati.tempoTrascorso;
        else tempoTrascorso = 0;

        if (dati.hintsConsumed) hintsConsumed = dati.hintsConsumed;
        if (dati.activeHintWord) activeHintWord = dati.activeHintWord;

    } else {
        paroleTrovate = [];
        punteggio = 0;
        shuffleLettere();

        // Reset variabili nuova partita
        tempoTrascorso = 0;
        hintsConsumed = 0;
        activeHintWord = null;

        salvaProgressi();
    }

    letteraCentrale = lettereLivello[0];
    calcolaTutteLeSoluzioni();

    if (salvataggio) mostraMessaggio("Partita recuperata.", "success");

    aggiornaGraficaEsagoni();
    aggiornaUI();
}

function trovaPangrammaDelGiorno() {
    // Moltiplichiamo il seed per un numero primo (es. 997)
    // Questo fa sì che tra ieri e oggi ci sia un salto di quasi 1000 parole nel dizionario
    // evitando di trovare lo stesso pangramma di ieri se sono vicini.
    let indice = (seedOggi * 997) % dizionario.length;

    let tentativi = 0;

    while (true) {

        const parola = dizionario[indice];
        const lettereUniche = new Set(parola.split(''));

        if (lettereUniche.size === 7) {
            lettereLivello = Array.from(lettereUniche);
            // console.log(`Pangramma Base (${seedOggi}): ${parola}`);
            break;
        }

        indice = (indice + 1) % dizionario.length;

        tentativi++;

        if (tentativi > dizionario.length) break;

    }
}

// --- MOTORE DI RICERCA ---
function calcolaTutteLeSoluzioni() {
    soluzioniTotali = [];
    totalPangrams = 0;

    const setPermesse = new Set(lettereLivello);

    for (let parola of dizionario) {
        if (parola.length < 4) continue;
        if (!parola.includes(letteraCentrale)) continue;

        let valida = true;
        for (let char of parola) {
            if (!setPermesse.has(char)) {
                valida = false;
                break;
            }
        }

        if (valida) {
            soluzioniTotali.push(parola);
            if (isPangram(parola)) {
                totalPangrams++;
            }
        }
    }
    console.log(`Soluzioni: ${soluzioniTotali.length}, di cui Apegrammi: ${totalPangrams}`);
}

function isPangram(parola) {
    const uniche = new Set(parola.split(''));
    return uniche.size === 7;
}

// --- 3. GESTIONE TIMER (MODIFICATA) ---

function startTimer() {
    // Evita timer doppi
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        // Il tempo avanza SOLO se NON è in pausa e la pagina è visibile
        if (!isPaused && !isPageHidden && !isMenuOpen) {
            tempoTrascorso++;
            aggiornaTimerUI();
        }
    }, 1000);
}

function aggiornaTimerUI() {
    const timerElement = document.getElementById("timer");
    if (!timerElement) return;

    const minuti = Math.floor(tempoTrascorso / 60);
    const secondi = tempoTrascorso % 60;
    timerElement.textContent = `${minuti.toString().padStart(2, '0')}:${secondi.toString().padStart(2, '0')}`;
}

// Funzione globale per la Pausa Manuale (chiamata dall'HTML)
function togglePauseManuale() {
    console.log("Bottone Pausa Premuto!"); // <-- Questo apparirà nella Console se il bottone funziona

    const overlay = document.getElementById('pause-overlay');
    // Se non trova l'overlay, controlliamo perché
    if (!overlay) {
        console.error("Errore: Elemento 'pause-overlay' non trovato nell'HTML.");
        return;
    }

    isPaused = !isPaused;

    if (isPaused) {
        overlay.classList.remove('hidden'); // Mostra overlay
    } else {
        overlay.classList.add('hidden');    // Nascondi overlay
    }
}

// Funzione Automatica: Rileva se cambi scheda
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        isPageHidden = true;
        salvaProgressi();
    } else {
        isPageHidden = false;
    }
});


// --- LOGICA SUGGERIMENTI ---

function calcolaAiutiDisponibili() {
    // 1 aiuto guadagnato ogni 7 parole trovate
    const guadagnati = Math.floor(paroleTrovate.length / 7);
    // Sottraiamo quelli già spesi
    const disponibili = guadagnati - hintsConsumed;
    return Math.max(0, disponibili);
}

function usaSuggerimento() {
    const disponibili = calcolaAiutiDisponibili();

    // CASO A: C'è già un suggerimento attivo? Mostralo di nuovo (gratis)
    if (activeHintWord) {
        mostraTestoSuggerimento(activeHintWord);
        // Effetto vibrazione sul box per attirare l'attenzione
        if (hintMsgBox) {
            hintMsgBox.classList.add('shake');
            setTimeout(() => hintMsgBox.classList.remove('shake'), 500);
        }
        return;
    }

    // CASO B: Nessun attivo, controlliamo se hai crediti
    if (disponibili > 0) {
        // Cerca una parola non ancora trovata
        const parolaDaSuggerire = generaParolaPerSuggerimento();

        if (parolaDaSuggerire) {
            activeHintWord = parolaDaSuggerire;
            hintsConsumed++; // Consuma 1 credito

            salvaProgressi();
            aggiornaUI(); // Aggiorna il numero giallo
            mostraTestoSuggerimento(activeHintWord);
        } else {
            mostraMessaggio("Nessun suggerimento disponibile (hai trovato tutto?)", "success");
        }
    } else {
        // Calcola quante parole mancano al prossimo aiuto
        const paroleMancanti = 7 - (paroleTrovate.length % 7);
        mostraMessaggio(`Trova altre ${paroleMancanti} parole per un aiuto!`, "error");
    }
}

function generaParolaPerSuggerimento() {
    // Filtra le parole valide che NON sono in paroleTrovate
    const mancanti = soluzioniTotali.filter(p => !paroleTrovate.includes(p));
    if (mancanti.length === 0) return null;
    // Ne prende una a caso
    const randomIdx = Math.floor(Math.random() * mancanti.length);
    return mancanti[randomIdx];
}

function mostraTestoSuggerimento(parola) {
    if (!parola || !hintMsgBox) {
        if (hintMsgBox) hintMsgBox.classList.add('hidden');
        return;
    }

    // Mostra direttamente tutta la parola
    hintTextEl.innerHTML = `Prova con: <span class="hint-reveal">${parola.toUpperCase()}</span>`;

    hintMsgBox.classList.remove('hidden');
}

// --- 4. INPUT E GIOCO ---
let parolaCorrente = "";

function inviaParola() {
    const parola = inputEl.textContent.toLowerCase();
    parolaCorrente = "";
    aggiornaInputUI();

    // Controlli base
    if (parola.length < 4) { mostraMessaggio("Troppo corta!"); return; }
    if (!parola.includes(letteraCentrale)) { mostraMessaggio("Manca la lettera centrale!", "error"); return; }
    for (let char of parola) {
        if (!lettereLivello.includes(char)) { mostraMessaggio("Lettera non valida!", "error"); return; }
    }

    // Controlli esistenza
    if (paroleTrovate.includes(parola)) { mostraMessaggio("Già trovata!", "error"); return; }

    if (!soluzioniTotali.includes(parola)) {
        if (dizionario.includes(parola)) mostraMessaggio("Parola non valida qui.", "error");
        else mostraMessaggio("Non è nell'elenco.", "error");
        return;
    }

    // CALCOLO PUNTI E FEEDBACK
    const puntiParola = calcolaPunti(parola);
    punteggio += puntiParola;
    paroleTrovate.push(parola);

    // --- CONTROLLO SUGGERIMENTO (PRIMA DI SALVARE) ---

    let isHintSolved = false;

    // Controlliamo se c'è un hint attivo e se la parola corrisponde (ignorando maiuscole/minuscole)
    if (activeHintWord && parola.toLowerCase() === activeHintWord.toLowerCase()) {
        activeHintWord = null;         // 1. Resetta la variabile logica
        mostraTestoSuggerimento(null); // 2. Nascondi subito il box giallo
        isHintSolved = true;           // 3. Ci segniamo che l'abbiamo risolto
    }

    // --- ORA SALVIAMO (Così salviamo il fatto che activeHintWord è null) ---
    salvaProgressi();
    aggiornaUI();

    // --- GESTIONE MESSAGGI ---
    if (isHintSolved) {
        mostraMessaggio(`Suggerimento risolto! +${puntiParola}`, "success");
    } else if (isPangram(parola)) {
        mostraMessaggio(`APEGRAMMA! <img src="assets/bee.png" alt="🐝" class="emoji"> &nbsp;&nbsp; +${puntiParola}`, "success");
        triggerConfetti();
    } else {
        if (puntiParola <= 3) mostraMessaggio(`Okay! +${puntiParola}`, "success");
        else if (puntiParola <= 6) mostraMessaggio(`Bene! +${puntiParola}`, "success");
        else if (puntiParola <= 9) mostraMessaggio(`Ottimo! +${puntiParola}`, "success");
        else mostraMessaggio(`Super! +${puntiParola}`, "success");
    }
}

// --- 4. UI AGGIORNATA ---

function aggiornaUI() {
    // Aggiorna Punteggio
    const scoreEl = document.getElementById('current-score');
    if (scoreEl) scoreEl.textContent = punteggio;

    const totalFound = paroleTrovate.length;
    const totalPossible = soluzioniTotali.length;
    const totalEl = document.getElementById('total-progress');
    if (totalEl) totalEl.textContent = `Trovate: ${totalFound} su ${totalPossible}`;

    const disponibili = calcolaAiutiDisponibili();
    if (hintCountEl) hintCountEl.textContent = disponibili;

    // Bottone Suggerimento
    if (hintBtn) {
        // Abilita se hai aiuti O se c'è un suggerimento attivo da rivedere
        if (disponibili > 0 || activeHintWord) {
            hintBtn.classList.remove('disabled');
            hintBtn.style.opacity = "1";
            hintBtn.style.cursor = "pointer";
        } else {
            hintBtn.classList.add('disabled');
            hintBtn.style.opacity = "0.5";
            hintBtn.style.cursor = "default";
        }
    }
    // Mostra il box se c'è un suggerimento attivo (es. al refresh pagina)
    if (activeHintWord) mostraTestoSuggerimento(activeHintWord);
    else mostraTestoSuggerimento(null);

    // Bottone ordinamento
    if (sortBtn) {
        if (sortMode === 'alpha') {
            sortBtn.innerHTML = '<img src="assets/alphabetic.png" alt="🔤" class="emoji">';
            sortBtn.title = "Ordine Alfabetico";
        } else {
            sortBtn.innerHTML = '<img src="assets/hourglass.png" alt="🕒" class="emoji">';
            sortBtn.title = "Ordine Cronoligico";
        }
    }

    // --- GENERAZIONE LISTA ---
    const sectionPangrams = document.getElementById('section-pangrams');
    const sectionLetters = document.getElementById('section-letters');
    sectionPangrams.innerHTML = "";
    sectionLetters.innerHTML = "";

    // APEGRAMMI
    const allPangrams = soluzioniTotali.filter(w => isPangram(w));

    // Filtra trovati (che sono in ordine cronologico)
    let foundPangramsList = paroleTrovate.filter(w => isPangram(w));

    // Se è modalità Alfabetica, crea una COPIA e ordina. Altrimenti lascia cronologico.
    if (sortMode === 'alpha') {
        foundPangramsList = [...foundPangramsList].sort();
    }

    const isPangramComplete = (foundPangramsList.length === allPangrams.length && allPangrams.length > 0);
    const checkP = isPangramComplete ? '<span class="apple-emoji">✅</span>' : '';

    let htmlP = `<div class="category-header pangram-header">
                    Apegrammi (${foundPangramsList.length}/${allPangrams.length}) ${checkP}
                 </div>
                 <div class="category-list">`;

    if (foundPangramsList.length === 0) htmlP += `<span style="color:#ccc;">-</span>`;
    else foundPangramsList.forEach(w => htmlP += `<span class="word-item word-pangram">${w}</span>`);

    htmlP += `</div>`;
    sectionPangrams.innerHTML = htmlP;

    // --- LETTERE ---

    // Filtriamo le lettere che hanno effettivamente parole nelle soluzioni
    const lettereAttive = [...lettereLivello].sort().filter(lettera => {
        return soluzioniTotali.some(w => w.startsWith(lettera));
    });

    lettereAttive.forEach((lettera, index) => {
        const totaliPerLettera = soluzioniTotali.filter(w => w.startsWith(lettera));

        // Filtriamo le parole (ordine cronologico)
        let trovatePerLettera = paroleTrovate.filter(w => w.startsWith(lettera));

        // Se alfabetico, ordina la copia
        if (sortMode === 'alpha') {
            trovatePerLettera = [...trovatePerLettera].sort();
        }

        const isComplete = trovatePerLettera.length === totaliPerLettera.length;

        const check = isComplete ? '<img src="assets/check-mark-button.png" alt="✅" class="emoji">' : '';

        const div = document.createElement('div');

        if (index === lettereAttive.length - 1) {
            div.className = 'last-word-category';
        } else {
            div.className = 'word-category';
        }

        let htmlL = `<div class="category-header">
                        Con iniziale ${lettera.toUpperCase()} (${trovatePerLettera.length}/${totaliPerLettera.length}) ${check}
                     </div>
                     <div class="category-list">`;

        if (trovatePerLettera.length === 0) {
            htmlL += `<span style="color:#ccc;">-</span>`;
        } else {
            trovatePerLettera.forEach(w => {
                const classe = isPangram(w) ? 'word-item word-pangram' : 'word-item';
                htmlL += `<span class="${classe}">${w}</span>`;
            });
        }
        htmlL += `</div>`;
        div.innerHTML = htmlL;
        sectionLetters.appendChild(div);
    });
}

// --- UTILITY ---

function salvaProgressi() {
    const dati = {
        parole: paroleTrovate,
        punti: punteggio,
        lettereMischiate: lettereLivello,
        tempoTrascorso: tempoTrascorso, // MODIFICA: Salviamo i secondi totali
        hintsConsumed: hintsConsumed,
        activeHintWord: activeHintWord
    };
    localStorage.setItem(`apegramma_${seedOggi}`, JSON.stringify(dati));
}

function shuffleLettere() {
    for (let i = lettereLivello.length - 1; i > 1; i--) {
        const j = Math.floor(Math.random() * i) + 1;
        [lettereLivello[i], lettereLivello[j]] = [lettereLivello[j], lettereLivello[i]];
    }
}

function aggiornaGraficaEsagoni() {
    document.getElementById('center-btn').textContent = lettereLivello[0].toUpperCase();
    for (let i = 1; i <= 6; i++) {
        const btn = document.getElementById(`btn-${i}`);
        if (btn) btn.textContent = lettereLivello[i].toUpperCase();
    }
}

function aggiungiLettera(l) { parolaCorrente += l.toLowerCase(); aggiornaInputUI(); }
function cancellaLettera() { parolaCorrente = parolaCorrente.slice(0, -1); aggiornaInputUI(); }
function aggiornaInputUI() {
    inputEl.textContent = parolaCorrente.toUpperCase();
    if (parolaCorrente === "") inputEl.classList.add('cursor');
    else inputEl.classList.remove('cursor');
}

function calcolaPunti(parola) {
    if (parola.length === 4) return 1;
    let p = parola.length;
    if (isPangram(parola)) p += 7;
    return p;
}

function mostraMessaggio(testo, tipo) {
    messageEl.innerHTML = testo; // Usa innerHTML per mostrare l'immagine
    messageEl.className = "message";
    messageEl.classList.remove('hidden');
    if (tipo === "success") messageEl.classList.add('success-msg');
    else {
        messageEl.classList.add('error-msg');
        inputEl.parentElement.classList.add('shake');
        setTimeout(() => inputEl.parentElement.classList.remove('shake'), 500);
    }
    setTimeout(() => messageEl.classList.add('hidden'), 2000);
}

function setupControlli() {
    document.querySelectorAll('.hex').forEach(btn => {
        btn.addEventListener('click', (e) => aggiungiLettera(e.target.textContent));
    });
    document.getElementById('delete-btn').addEventListener('click', cancellaLettera);
    document.getElementById('shuffle-btn').addEventListener('click', () => {
        shuffleLettere();
        aggiornaGraficaEsagoni();
    });
    document.getElementById('enter-btn').addEventListener('click', inviaParola);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') inviaParola();
        else if (e.key === 'Backspace') cancellaLettera();
        else if (e.key.match(/^[a-zA-Z]$/)) aggiungiLettera(e.key);
    });

    // Toggle Lista
    const toggleBtn = document.getElementById('toggle-list-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const content = document.getElementById('words-content');
            content.classList.toggle('open');
            if (content.classList.contains('open')) toggleBtn.textContent = "Nascondi elenco ▲";
            else toggleBtn.textContent = "Mostra elenco ▼";
        });
    }

    // Toggle Ordinamento
    if (sortBtn) {
        sortBtn.addEventListener('click', () => {
            sortMode = (sortMode === 'alpha') ? 'time' : 'alpha';
            aggiornaUI();

            // Se lista chiusa, aprila per feedback
            const content = document.getElementById('words-content');
            if (!content.classList.contains('open') && toggleBtn) {
                content.classList.add('open');
                toggleBtn.textContent = "Nascondi elenco ▲";
            }
        });
    }

    // Listener per il Bottone Pausa (se presente nell'HTML)
    // const pauseBtn = document.getElementById('pause-btn');
    // if (pauseBtn) {
    //     pauseBtn.addEventListener('click', togglePauseManuale);
    // }

    // Sidebar e Overlay
    const menuBtn = document.getElementById('menu-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    function apriSidebar() { 
        sidebar.classList.add('open'); 
        sidebarOverlay.classList.remove('hidden'); 
        isMenuOpen = true; // <--- IL TIMER SI FERMA
    }

    function chiudiSidebar() { 
        sidebar.classList.remove('open'); 
        sidebarOverlay.classList.add('hidden'); 
        isMenuOpen = false; // <--- IL TIMER RIPARTE
    }
    
    if (menuBtn) menuBtn.addEventListener('click', apriSidebar);
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', chiudiSidebar);
    if (overlay) overlay.addEventListener('click', chiudiSidebar);

    // Accordion
    const acc = document.getElementsByClassName("accordion-header");
    for (let i = 0; i < acc.length; i++) {
        acc[i].addEventListener("click", function () {
            this.classList.toggle("active");
            const panel = this.nextElementSibling;
            if (panel.style.display === "block") panel.style.display = "none";
            else {
                panel.style.display = "block";
                if (this.textContent.includes("Ieri")) calcolaSoluzioniIeri();
            }
        });
    }

    // Tema
    const themeBtn = document.getElementById('theme-toggle');
    const iconMoon = document.getElementById('icon-moon');
    const iconSun = document.getElementById('icon-sun');
    function setDarkTheme(isDark) {
        if (isDark) {
            document.body.classList.add('dark-mode');
            iconMoon.classList.add('hidden-icon');
            iconSun.classList.remove('hidden-icon');
        } else {
            document.body.classList.remove('dark-mode');
            iconMoon.classList.remove('hidden-icon');
            iconSun.classList.add('hidden-icon');
        }
    }
    const savedTheme = localStorage.getItem('apegramma_theme');
    if (savedTheme === 'dark') setDarkTheme(true);
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isDarkNow = document.body.classList.contains('dark-mode');
            setDarkTheme(!isDarkNow);
            localStorage.setItem('apegramma_theme', !isDarkNow ? 'dark' : 'light');
        });
    }

    // Listener Suggerimento
    if (hintBtn) {
        hintBtn.addEventListener('click', usaSuggerimento);
    }

    // --- Condivisione dei risultati ---
    const shareBtn = document.getElementById('share-btn');

    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            // 1. Prepara i dati
            const oggi = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
            const tempoFinale = document.getElementById('timer').textContent;

            // 2. Costruisci il messaggio
            const testoCondivisione = `Apegramma del ${oggi}\n` +
                `🐝 Parole trovate: ${paroleTrovate.length}\n` +
                `🎯 Punti: ${punteggio}\n` +
                `⏳ Tempo: ${tempoFinale} min\n` +
                `Prova a battermi se ci riesci!\n\n` +
                `https://apegramma.netlify.app/`; // (Sostituire col link vero)

            // 3. Prova a condividere
            if (navigator.share) {
                // Metodo Nativo (Mobile: apre WhatsApp/Telegram/ecc)
                try {
                    await navigator.share({
                        title: 'Apegramma',
                        text: testoCondivisione
                    });
                    console.log('Condiviso con successo');
                } catch (err) {
                    console.log('Condivisione annullata', err);
                }
            } else {
                // Fallback (Desktop: Copia negli appunti)
                try {
                    await navigator.clipboard.writeText(testoCondivisione);
                    mostraMessaggio("Risultato copiato negli appunti!", "success");
                } catch (err) {
                    mostraMessaggio("Impossibile copiare il testo", "error");
                }
            }
        });
    }
}

function triggerConfetti() { console.log("🎉 APEGRAMMA TROVATO! 🎉"); }

// --- SOLUZIONI DI IERI ---
function calcolaSoluzioniIeri() {
    const container = document.getElementById('yesterday-solution-container');
    if (container.dataset.loaded === "true") return;

    const ieri = new Date();
    ieri.setDate(ieri.getDate() - 1);
    const anno = ieri.getFullYear();
    const mese = (ieri.getMonth() + 1).toString().padStart(2, '0');
    const giorno = ieri.getDate().toString().padStart(2, '0');
    const seedIeri = parseInt(`${anno}${mese}${giorno}`);

    let indice = (seedIeri * 997) % dizionario.length;
    let pangrammaIeri = "", lettereIeri = [], centraleIeri = "";
    let tentativi = 0;
    while (true) {
        const parola = dizionario[indice];
        const lettereUniche = new Set(parola.split(''));
        if (lettereUniche.size === 7) {
            pangrammaIeri = parola;
            lettereIeri = Array.from(lettereUniche);
            centraleIeri = lettereIeri[0];
            break;
        }
        indice = (indice + 1) % dizionario.length;
        tentativi++;
        if (tentativi > dizionario.length) { container.innerHTML = "Dati non disponibili."; return; }
    }

    const soluzioniIeri = [];
    const setPermesse = new Set(lettereIeri);

    for (let parola of dizionario) {
        if (parola.length < 4) continue;
        if (!parola.includes(centraleIeri)) continue;
        let valida = true;
        for (let char of parola) { if (!setPermesse.has(char)) { valida = false; break; } }
        if (valida) soluzioniIeri.push(parola);
    }

    soluzioniIeri.sort();
    let html = `<p><strong>Lettere:</strong> [${centraleIeri.toUpperCase()}] ${lettereIeri.slice(1).join('').toUpperCase()}<br>
                <strong>Parole:</strong> ${soluzioniIeri.length}</p>
                <div style="max-height: 200px; overflow-y: auto;">`;

    soluzioniIeri.forEach((p, index) => {
        const isPangramma = (new Set(p.split('')).size === 7);
        const styleClass = isPangramma ? 'yesterday-word yesterday-pangram' : 'yesterday-word';
        const separator = (index === soluzioniIeri.length - 1) ? '.' : ', ';
        html += `<span class="${styleClass}">${p}${separator}</span>`;
    });
    html += `</div>`;
    container.innerHTML = html;
    container.dataset.loaded = "true";
}

// --- SALVATAGGIO AUTOMATICO USCITA ---
window.addEventListener('beforeunload', () => {
    salvaProgressi();
});

// --- AVVIO DEL GIOCO ---
initGame();