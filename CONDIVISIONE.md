# Condivisione dei dati tra piu' utenti

Ogni utente ha un proprio archivio su Firestore (`users/{uid}`). Il
proprietario puo' autorizzare altri account Google a **vedere** quell'archivio:
gli invitati ricevono gli aggiornamenti in tempo reale, ma **in sola lettura**.
Solo il proprietario puo' modificare i dati.

## 1. Pubblicare le regole di sicurezza (una volta sola)

Senza questo passaggio l'elenco "Dati condivisi con te" resta vuoto: Firestore
rifiuta la lettura dell'archivio altrui.

1. Apri [console.firebase.google.com](https://console.firebase.google.com) e
   seleziona il progetto usato dall'app.
2. Vai su **Firestore Database → Regole**.
3. Incolla il contenuto del file [`firestore.rules`](./firestore.rules).
4. Clicca **Pubblica**.

## 2. Condividere i propri dati

Dal telefono del **proprietario**:

1. Accedi con Google (Impostazioni → Cloud & Backup → Accedi con Google).
2. Apri **Impostazioni → Cloud & Backup → Condivisione dati**.
3. Scrivi l'email dell'account Google della persona e premi **Aggiungi**.

L'elenco mostra tutte le persone autorizzate. La **×** accanto a un'email
revoca l'accesso: se in quel momento la persona sta guardando i dati, viene
riportata automaticamente ai propri.

## 3. Vedere i dati condivisi con te

Dal telefono dell'**invitato**:

1. Accedi con lo stesso account Google il cui indirizzo e' stato autorizzato.
2. Apri **Impostazioni → Cloud & Backup → Condivisione dati**.
3. Sotto **"Dati condivisi con te"** premi **Apri**.

Compare una barra blu in alto: da quel momento l'app mostra i dati del
proprietario, aggiornati in tempo reale a ogni sua modifica. I comandi di
inserimento e modifica sono nascosti e ogni tentativo di scrittura viene
bloccato. **Torna ai miei dati** riporta al proprio archivio.

Se l'elenco e' vuoto, premi **Aggiorna elenco**: viene riletto da Firestore.

## Note tecniche

- I dati propri restano in `localStorage['cassa_v6']` e non vengono **mai**
  toccati durante la vista condivisa; l'archivio condiviso viene messo in cache
  a parte in `localStorage['cassa_v6_shared']`, e cancellato all'uscita.
- La vista condivisa sopravvive alla chiusura dell'app: viene ripristinata al
  login successivo insieme al listener realtime.
- Gli **allegati delle fatture** (PDF e foto) restano nell'IndexedDB del
  dispositivo di chi li ha caricati: non transitano dal cloud e quindi non sono
  visibili agli invitati. In vista condivisa il flag `hasPdf` viene rimosso per
  non mostrare allegati che su quel dispositivo non esistono.
- Il confronto delle email e' sempre in minuscolo, sia nell'app sia nelle
  regole Firestore.
