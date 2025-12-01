// --- VARIABILI GLOBALI SFIDA ---
let dizionario = [];
let soluzioniTotali = [];
let paroleTrovate = [];
let lettereLivello = [];
let letteraCentrale = ''; 
let punteggio = 0;
let seedSfida = 0;

// Variabili Timer e Stato
let timerInterval;
let durataScelta = 0; // Minuti scelti
let tempoRimasto = 0; // Secondi rimasti
let partitaFinita = false;
let isPageHidden = false; // NUOVO: Rileva se la pagina è nascosta

// Elementi HTML
const inputEl = document.getElementById('text-input');
const messageEl = document.getElementById('message');
const timerEl = document.getElementById('timer');
const setupModal = document.getElementById('setup-modal');
const shareBtn = document.getElementById('share-btn');

// --- 1. AVVIO ---
async function initGame() {
    try {
        const response = await fetch('data/parole_ali.json');
        if (!response.ok) throw new Error("File JSON non trovato");
        
        dizionario = await response.json();
        
        // Calcola seed per la sfida (Diverso dal daily!)
        seedSfida = getSeedDiOggi() + 12345; 
        
        setupPartitaDelGiorno();
        setupControlli();
        
    } catch (e) {
        console.error(e);
        mostraMessaggio("Errore caricamento gioco", "error");
    }
}

// --- 2. LOGICA PARTITA E BLOCCO GIORNALIERO ---
function getSeedDiOggi() {
    const now = new Date();
    // Crea un ID unico per oggi (es: 20231125)
    return parseInt(`${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`);
}

function setupPartitaDelGiorno() {
    // 1. Genera il livello (pangramma)
    trovaPangrammaSfida();
    letteraCentrale = lettereLivello[0];
    calcolaTutteLeSoluzioni();
    aggiornaGraficaEsagoni();

    // 2. CONTROLLO: Ha già giocato oggi?
    const salvataggio = localStorage.getItem(`sfida_${seedSfida}`);
    
    if (salvataggio) {
        // HA GIÀ GIOCATO: Recupera e mostra tutto bloccato
        const dati = JSON.parse(salvataggio);
        paroleTrovate = dati.parole;
        punteggio = dati.punti;
        durataScelta = dati.durata;
        
        setupModal.style.display = 'none'; // Nascondi la scelta tempo
        gameover(true); // Attiva stato Game Over (true = è un reload)
        mostraMessaggio("Hai già completato la sfida di oggi!", "success");
    } else {
        // NON HA ANCORA GIOCATO: Mostra il modale di scelta
        setupModal.style.display = 'flex';
    }
}

// Funzione chiamata dai bottoni del modale HTML
window.impostaSfida = function(minuti) {
    durataScelta = minuti;
    tempoRimasto = minuti * 60; // Converti in secondi
    
    setupModal.style.display = 'none'; // Chiudi modale
    avviaCountdown(); // START!
}

function trovaPangrammaSfida() {
    // Usiamo un moltiplicatore diverso (*333) rispetto al daily (*997)
    let indice = (seedSfida * 333) % dizionario.length; 
    let tentativi = 0;
    while (true) {
        const parola = dizionario[indice];
        const lettereUniche = new Set(parola.split(''));
        if (lettereUniche.size === 7) {
            lettereLivello = Array.from(lettereUniche);
            break;
        }
        indice = (indice + 1) % dizionario.length;
        if (tentativi++ > dizionario.length) break;
    }
}

// --- 3. COUNTDOWN (MODIFICATO CON PAUSA AUTOMATICA) ---
function avviaCountdown() {
    // Aggiorna subito la grafica prima di aspettare 1 secondo
    aggiornaTimerGrafica();

    timerInterval = setInterval(() => {
        // Decrementa il tempo SOLO se la pagina è visibile
        if (!isPageHidden) {
            tempoRimasto--;
            aggiornaTimerGrafica();

            if (tempoRimasto <= 0) {
                clearInterval(timerInterval);
                gameover(); // TEMPO SCADUTO
            }
        }
    }, 1000);
}

// Listener per rilevare cambio scheda/minimizzazione
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        isPageHidden = true;
        console.log("Timer congelato (sfida in background)");
    } else {
        isPageHidden = false;
        console.log("Timer ripreso");
    }
});

function aggiornaTimerGrafica() {
    const m = Math.floor(tempoRimasto / 60).toString().padStart(2, '0');
    const s = (tempoRimasto % 60).toString().padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;

    // Effetto panico ultimi 10 secondi (rosso pulsante)
    if (tempoRimasto <= 10) {
        timerEl.style.color = '#d93025';
        timerEl.style.animation = 'pulsate 0.5s infinite';
    }
}

// --- 4. GAME OVER E SALVATAGGIO ---
function gameover(isReload = false) {
    partitaFinita = true;
    timerEl.textContent = "00:00";
    if (!isReload) inputEl.textContent = "FINITO!";
    
    // Disabilita controlli
    document.getElementById('enter-btn').disabled = true;
    document.getElementById('delete-btn').disabled = true;
    document.getElementById('shuffle-btn').disabled = true;
    // Disabilita click sugli esagoni
    document.querySelectorAll('.hex').forEach(b => {
        b.style.pointerEvents = 'none';
        b.style.opacity = '0.7';
    });
    
    // Mostra bottone condividi
    shareBtn.style.display = 'inline-flex';
    
    // Salva il risultato FINALE nel localStorage
    const dati = {
        parole: paroleTrovate,
        punti: punteggio,
        durata: durataScelta,
        finito: true
    };
    localStorage.setItem(`sfida_${seedSfida}`, JSON.stringify(dati));

    aggiornaUI();
    if(!isReload) triggerConfetti();
}

// --- 5. LOGICA GIOCO ---

let parolaCorrente = "";

function inviaParola() {
    if (partitaFinita) return;

    const parola = inputEl.textContent.toLowerCase();
    parolaCorrente = ""; 
    aggiornaInputUI();

    // Controlli
    if (parola.length < 4) { mostraMessaggio("Troppo corta!"); return; }
    if (!parola.includes(letteraCentrale)) { mostraMessaggio("Manca la lettera centrale!", "error"); return; }
    for (let char of parola) {
        if (!lettereLivello.includes(char)) { mostraMessaggio("Lettera non valida!", "error"); return; }
    }
    if (paroleTrovate.includes(parola)) { mostraMessaggio("Già trovata!", "error"); return; }
    if (!soluzioniTotali.includes(parola)) { mostraMessaggio("Non è nell'elenco.", "error"); return; }

    // Calcolo Punti
    let p = parola.length === 4 ? 1 : parola.length;
    if (isPangram(parola)) p += 7;
    
    punteggio += p;
    paroleTrovate.push(parola);
    
    // Aggiorniamo l'interfaccia
    aggiornaUI();
    
    // Feedback
    if (isPangram(parola)) {
        mostraMessaggio(`APEGRAMMA! <img src="assets/bee.png" alt="🐝" class="emoji"> +${p}`, "success");
        triggerConfetti();
    } else {
        mostraMessaggio(`Brava! +${p}`, "success");
    }
}

// --- UI SPECIFICA SFIDA ---
function aggiornaUI() {
    document.getElementById('current-score').textContent = punteggio;
    document.getElementById('total-progress').textContent = `Trovate: ${paroleTrovate.length}`;

    // Lista semplice (Recenti in alto)
    const sezione = document.getElementById('section-letters'); 
    sezione.innerHTML = "";
    
    const listaInversa = [...paroleTrovate].reverse();
    
    let html = `<div class="category-list" style="padding:10px;">`;
    
    if (listaInversa.length === 0) {
        html += `<span style="color:#ccc;">Inizia a scrivere...</span>`;
    } else {
        listaInversa.forEach(w => {
            const cls = isPangram(w) ? 'word-pangram' : '';
            html += `<span class="word-item ${cls}">${w}</span> `;
        });
    }
    html += `</div>`;
    sezione.innerHTML = html;
}

// --- UTILITY BASE (Uguali al main) ---

function calcolaTutteLeSoluzioni() {
    soluzioniTotali = [];
    const setPermesse = new Set(lettereLivello);
    for (let parola of dizionario) {
        if (parola.length < 4) continue;
        if (!parola.includes(letteraCentrale)) continue;
        let valida = true;
        for (let char of parola) { if (!setPermesse.has(char)) { valida = false; break; } }
        if (valida) soluzioniTotali.push(parola);
    }
}

function isPangram(parola) { return new Set(parola.split('')).size === 7; }

function aggiornaGraficaEsagoni() {
    document.getElementById('center-btn').textContent = lettereLivello[0].toUpperCase();
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`btn-${i}`).textContent = lettereLivello[i].toUpperCase();
    }
}

function aggiungiLettera(l) { 
    if(partitaFinita) return;
    parolaCorrente += l.toLowerCase(); 
    aggiornaInputUI(); 
}

function cancellaLettera() { 
    if(partitaFinita) return;
    parolaCorrente = parolaCorrente.slice(0, -1); 
    aggiornaInputUI(); 
}

function aggiornaInputUI() { 
    inputEl.textContent = parolaCorrente.toUpperCase();
    if(parolaCorrente === "") inputEl.classList.add('cursor');
    else inputEl.classList.remove('cursor');
}

function mostraMessaggio(testo, tipo) {
    messageEl.innerHTML = testo; 
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
    // Click Esagoni
    document.querySelectorAll('.hex').forEach(btn => {
        btn.addEventListener('click', (e) => aggiungiLettera(e.target.textContent));
    });
    
    // Tasti Azione
    document.getElementById('delete-btn').addEventListener('click', cancellaLettera);
    document.getElementById('enter-btn').addEventListener('click', inviaParola);
    
    // Mescola
    document.getElementById('shuffle-btn').addEventListener('click', () => {
        if(partitaFinita) return;
        for (let i = lettereLivello.length - 1; i > 1; i--) {
            const j = Math.floor(Math.random() * i) + 1;
            [lettereLivello[i], lettereLivello[j]] = [lettereLivello[j], lettereLivello[i]];
        }
        aggiornaGraficaEsagoni();
    });

    // Tastiera fisica
    document.addEventListener('keydown', (e) => {
        if (partitaFinita) return;
        if (e.key === 'Enter') inviaParola();
        else if (e.key === 'Backspace') cancellaLettera();
        else if (e.key.match(/^[a-zA-Z]$/)) aggiungiLettera(e.key);
    });
    
    // Toggle lista
    const toggleBtn = document.getElementById('toggle-list-btn');
    if(toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const content = document.getElementById('words-content');
            content.classList.toggle('open');
            if (content.classList.contains('open')) toggleBtn.textContent = "Nascondi elenco ▲";
            else toggleBtn.textContent = "Mostra elenco ▼";
        });
    }

    // Share Button
    if(shareBtn) {
        shareBtn.addEventListener('click', async () => {
            const testo = `Sfida Apegramma (${durataScelta}min) ⚡️\n` +
                          `🐝 Parole trovate: ${paroleTrovate.length}\n` +
                          `🎯 Punti: ${punteggio}\n` 
                          `Prova a battermi se ci riesci!\n\n` +
                          `https://apegramma.netlify.app/`;
            
            if (navigator.share) {
                try { await navigator.share({title:'Sfida Apegramma', text:testo}); }
                catch(e) { console.log('Share annullato'); }
            } else {
                await navigator.clipboard.writeText(testo); 
                mostraMessaggio("Risultato copiato!", "success"); 
            }
        });
    }
    
    // Tema Scuro
    const themeBtn = document.getElementById('theme-toggle');
    const iconMoon = document.getElementById('icon-moon');
    const iconSun = document.getElementById('icon-sun');
    
    function applicaTema(isDark) {
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
    
    if(localStorage.getItem('apegramma_theme')==='dark') applicaTema(true);
    
    if(themeBtn) themeBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        applicaTema(isDark);
        localStorage.setItem('apegramma_theme', isDark ? 'dark' : 'light');
    });
}

function triggerConfetti() { 
    console.log("🎉"); 
}

// --- AVVIO DEL GIOCO ---
initGame();