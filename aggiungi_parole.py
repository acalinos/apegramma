import json
import os

# CONFIGURAZIONE
file_json_esistente = "data/parole_ali.json"  # Il tuo dizionario attuale
file_nuove_parole = "data/parole_extra.txt"   # La lista che hai scritto tu
output_file = "data/parole_ali.json"          # Sovrascriviamo lo stesso file

# Tabella accenti (la stessa dell'altro script)
trans_table = str.maketrans({
    'à': 'a', 'á': 'a', 'è': 'e', 'é': 'e',
    'ì': 'i', 'í': 'i', 'ò': 'o', 'ó': 'o',
    'ù': 'u', 'ú': 'u'
})

def main():
    # 1. Carica il dizionario JSON esistente
    if not os.path.exists(file_json_esistente):
        print(f"ERRORE: Non trovo {file_json_esistente}")
        return

    with open(file_json_esistente, 'r', encoding='utf-8') as f:
        lista_esistente = json.load(f)
    
    set_parole = set(lista_esistente)
    print(f"Parole attuali nel dizionario: {len(set_parole)}")

    # 2. Leggi le nuove parole dal file TXT
    if not os.path.exists(file_nuove_parole):
        print(f"ERRORE: Non trovo {file_nuove_parole}. Crealo e scrivici dentro!")
        return

    aggiunte = 0
    scartate = 0

    with open(file_nuove_parole, 'r', encoding='utf-8') as f:
        for line in f:
            parola_raw = line.strip().lower()
            
            if not parola_raw: continue # Salta righe vuote

            # Pulizia (via accenti)
            parola_pulita = parola_raw.translate(trans_table)

            # Controlli base
            if len(parola_pulita) < 4:
                print(f"Scartata '{parola_raw}': troppo corta (<4)")
                scartate += 1
                continue
            
            if not parola_pulita.isalpha():
                print(f"Scartata '{parola_raw}': contiene caratteri non validi")
                scartate += 1
                continue

            # Se non c'era, la aggiungiamo
            if parola_pulita not in set_parole:
                set_parole.add(parola_pulita)
                aggiunte += 1
                # print(f"Aggiunta: {parola_pulita}") # Decommenta per vedere quali aggiunge

    # 3. Salva e chiudi
    lista_finale = sorted(list(set_parole))
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(lista_finale, f)

    print(f"\nOPERAZIONE COMPLETATA!")
    print(f"Nuove parole inserite: {aggiunte}")
    print(f"Parole scartate (troppo corte/errate): {scartate}")
    print(f"Totale parole nel dizionario ora: {len(lista_finale)}")

if __name__ == "__main__":
    main()