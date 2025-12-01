import json

input_file = "morph-ali_048.txt"
output_file = "data/parole_ali.json"

parole_valide = set()

# Tabella conversione accenti
trans_table = str.maketrans({
    'à': 'a', 'á': 'a',
    'è': 'e', 'é': 'e',
    'ì': 'i', 'í': 'i',
    'ò': 'o', 'ó': 'o',
    'ù': 'u', 'ú': 'u'
})

# Blacklist (via superlativi e diminutivi, teniamo comparativi)
blacklist_tag = ['SUP', 'COND', 'GER', 'IMPR', 'IND', 'SUB']

print("Inizio creazione dizionario finale...")

try:
    # Usiamo latin-1
    with open(input_file, 'r', encoding='latin-1') as f:
        for line in f:
            parts = line.strip().split()

            if len(parts) < 3: continue
                
            parola_originale = parts[0].lower()
            tag = parts[2].upper() 

            # 1. Blacklist
            dettagli_tag = tag.split(':')[-1]
            if any(b in dettagli_tag for b in blacklist_tag):
                continue

            # 2. LOGICA PARTI DEL DISCORSO
            keep = False
            
            if (tag.startswith('ADJ') or 
                tag.startswith('ADV') or 
                tag.startswith('ART') or 
                tag.startswith('ARTPRE') or
                tag.startswith('ASP') or
                tag.startswith('AUX') or
                tag.startswith('CAU') or
                tag.startswith('CON') or 
                tag.startswith('DET-DEMO') or
                tag.startswith('DET-INDEF') or
                tag.startswith('DET-NUM-CARD') or
                tag.startswith('DET-POSS') or
                tag.startswith('DET-WH') or
                tag.startswith('INT') or 
                tag.startswith('MOD') or
                tag.startswith('NOUN') or
                tag.startswith('PRO-DEMO') or
                tag.startswith('PRO-INDEF') or
                tag.startswith('PRO-NUM') or
                tag.startswith('PRO-PERS') or
                tag.startswith('PRO-WH') or
                tag.startswith('WH')):  
                keep = True
            
            elif tag.startswith('VER'):
                if ':INF' in tag and parola_originale.endswith('e'):
                    keep = True
                elif ':PART' in tag:
                    keep = True

            if not keep: continue

            # 3. Normalizzazione
            parola_pulita = parola_originale.translate(trans_table)

            if len(parola_pulita) < 4: continue
            if not parola_pulita.isalpha(): continue

            parole_valide.add(parola_pulita)

    lista_finale = sorted(list(parole_valide))
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(lista_finale, f)

    print(f"FATTO! Salvate {len(lista_finale)} parole.")
    print(f"Check 'cortissimo': {'cortissimo' in parole_valide}")
    print(f"Check 'andante': {'andante' in parole_valide}")
    print(f"Check 'cedere': {'cedere' in parole_valide}")

except FileNotFoundError:
    print(f"Errore: File {input_file} non trovato.")