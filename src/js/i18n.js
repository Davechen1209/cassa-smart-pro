// ─── Internationalization (IT / ZH) ───

const translations = {
  it: {
    // App
    'app.title': 'Cassa Smart Pro',
    'app.cloudDisconnected': 'Cloud non connesso',

    // PIN
    'pin.title': 'Cassa Smart Pro',
    'pin.subtitle': 'Inserisci il PIN per accedere',
    'pin.blocked': 'Accesso bloccato permanentemente',
    'pin.tooMany': 'Troppi tentativi errati',
    'pin.remaining_one': 'tentativo rimanente',
    'pin.remaining_other': 'tentativi rimanenti',
    'pin.change': 'Cambia PIN',
    'pin.oldPin': 'PIN attuale',
    'pin.newPin': 'Nuovo PIN',
    'pin.confirmPin': 'Conferma PIN',
    'pin.save': 'Salva',
    'pin.wrongOld': 'PIN attuale non corretto',
    'pin.invalidLength': 'Il PIN deve essere tra 4 e 8 cifre',
    'pin.noMatch': 'I PIN non corrispondono',
    'pin.changed': 'PIN cambiato con successo',
    'pin.chooseTitle': 'Benvenuto',
    'pin.chooseNew': 'Scegli il tuo PIN',
    'pin.confirmNew': 'Conferma il tuo PIN',
    'pin.mismatchRetry': 'I PIN non corrispondono, riprova',

    // Tabs
    'tab.registra': 'Registra',
    'tab.rubriche': 'Rubriche',
    'tab.storico': 'Storico',
    'tab.report': 'Report',
    'report.preset.thisMonth': 'Questo mese',
    'report.preset.lastMonth': 'Mese scorso',
    'report.preset.last3': 'Ultimi 3 mesi',
    'report.preset.thisYear': "Quest'anno",
    'report.preset.custom': 'Personalizzato',
    'report.from': 'Dal',
    'report.to': 'Al',
    'report.comparedTo': 'confronto con',
    'report.noChange': 'invariato',
    'report.monthByMonth': 'Mese per mese',
    'report.month': 'Mese',
    'report.total': 'Totale',
    'report.dailyTrend': 'Andamento giornaliero',
    'report.averages': 'Medie e giorni',
    'report.nettoFormula': 'contanti − uscite',
    'report.depTitolo': 'Depositi in banca',
    'report.depNota': "Non sono una spesa e restano fuori dalle uscite, ma i contanti dalla cassa escono lo stesso: il netto li sottrae.",
    'report.depMovimenti': '{n} versamenti',
    'report.depMovimentiUno': '1 versamento',
    'report.nettoFormulaDep': 'contanti − uscite − depositi',
    'report.depVersato': 'Versato',
    'pdf.fattPagato': 'Pagato',
    'pdf.fattPagamenti': 'Pagamenti alle fatture nel mese',
    'pdf.fattResiduo': 'Residuo',
    'report.fattPagato': 'Pagato',
    'report.fattNelPeriodo': 'nel periodo',
    'report.fattSenzaData': 'Pagato senza data (registrato prima o importato)',
    'report.fattTitolo': 'Fatture fornitori',
    'report.fattArrivate': 'Arrivate nel periodo',
    'report.fattDaPagare': 'Da pagare',
    'report.fattScadute': 'Scadute',
    'report.fattAOggi': 'a oggi',
    'report.fattNumero': '{n} fatture',
    'report.fattNumeroUno': '1 fattura',
    'report.fattInScadenza': 'In scadenza nel periodo',
    'report.fattResiduoArrivate': 'Residuo sulle fatture del periodo',
    'report.fattTopFornitori': 'Fornitori del periodo',
    'report.fattResiduoBreve': 'residuo',
    'report.fattNota': 'Le fatture non entrano nei conti di cassa qui sopra: una fattura pagata in contanti e\' gia\' un\'uscita nel registro.',
    'report.avgIncome': 'Incasso medio',
    'report.avgExpense': 'Uscita media',
    'report.workedDays': 'Giorni con movimenti',
    'report.bestDay': 'Giorno migliore',
    'report.worstDay': 'Giorno peggiore',
    'report.byWeekday': 'Incasso medio per giorno della settimana',
    'report.emptyPeriod': 'Nessun movimento nel periodo selezionato.',
    'tab.fatture': 'Fatture',

    // Saldo
    'saldo.title': 'SALDO TOTALE CASSA',
    'saldo.updated': 'Saldo aggiornato',

    // Settings
    'settings.title': 'Impostazioni',
    'settings.back': 'Indietro',
    'settings.lang': 'Lingua',
    'settings.langLabel': 'Seleziona lingua',
    'settings.saldo': 'Saldo manuale',
    'settings.saldoLabel': 'Imposta il saldo corrente',
    'settings.saldoPlaceholder': 'Imposta saldo...',
    'settings.update': 'Aggiorna Saldo',
    'settings.reset': 'Reset Dati',
    'settings.dangerZone': 'Zona pericolosa',
    'settings.dangerInfo': 'Questa azione eliminera\' tutti i movimenti, le rubriche e le fatture. Non e\' reversibile.',
    'settings.resetTitle': 'Reset Dati',
    'settings.resetMsg': 'Tutti i movimenti e le rubriche verranno eliminati. Continuare?',
    'settings.resetConfirm2': 'Sei sicuro?',
    'settings.resetMsg2': 'Questa azione e\' irreversibile. Tutti i dati verranno persi definitivamente.',
    'settings.resetDone': 'Dati resettati',
    'settings.general': 'Generale',
    'settings.fattureAi': 'Fatture & AI',
    'settings.cloudBackup': 'Cloud & Backup',
    'settings.advanced': 'Avanzate',

    // Cloud
    'cloud.title': 'Sincronizzazione Cloud',
    'cloud.connected': 'Cloud connesso',
    'cloud.lastSync': 'Ultimo sync:',
    'cloud.autoSave': 'I tuoi dati vengono salvati automaticamente nel cloud Firebase ad ogni modifica.',
    'cloud.reload': 'Ricarica dal Cloud',
    'cloud.disconnect': 'Disconnetti',
    'cloud.notConfigured': 'Cloud non configurato',
    'cloud.setupInfo': 'Configura Firebase per salvare i dati nel cloud in modo automatico e sicuro. Servono 5 minuti (una sola volta).',
    'cloud.step1': 'Vai su console.firebase.google.com e crea un nuovo progetto (nome a piacere, disattiva Google Analytics).',
    'cloud.step2': 'Nel progetto, clicca "Crea" > "Firestore Database" nel menu a sinistra. Scegli "Avvia in modalita\' test" e seleziona la region piu\' vicina.',
    'cloud.step3': 'Nel menu "Creazione" > "Authentication", clicca "Inizia", poi abilita il provider "Google".',
    'cloud.step4': 'Vai in Impostazioni progetto (icona ingranaggio in alto) > scorri fino a "Le tue app" > clicca "Web" (icona </>) > Dai un nome e clicca Registra. Copia il blocco firebaseConfig e incollalo qui sotto.',
    'cloud.connect': 'Connetti al Cloud',
    'cloud.synced': 'Cloud sincronizzato',
    'cloud.syncing': 'Sincronizzazione in corso...',
    'cloud.syncError': 'Errore di sincronizzazione',
    'cloud.reloaded': 'Dati ricaricati dal cloud',
    'cloud.noData': 'Nessun dato trovato nel cloud',
    'cloud.loginToSync': 'Accedi per sincronizzare',
    'cloud.loginInfo': 'Accedi con il tuo account Google per sincronizzare i dati tra tutti i tuoi dispositivi.',
    'cloud.loginGoogle': 'Accedi con Google',
    'cloud.or': 'oppure',
    'cloud.removeConfig': 'Rimuovi configurazione',
    'cloud.connError': 'Errore connessione cloud: ',
    'cloud.connectedAs': 'Connesso come ',
    'cloud.loginError': 'Errore accesso: ',
    'cloud.invalidConfig': 'Configurazione non valida. Controlla il formato.',
    'cloud.connecting': 'Connessione al cloud in corso...',
    'cloud.disconnectTitle': 'Disconnetti Cloud',
    'cloud.disconnectMsg': 'I dati locali rimarranno salvati. Vuoi disconnettere la sincronizzazione cloud?',
    'cloud.disconnected': 'Cloud disconnesso',

    // Condivisione dati
    'share.title': 'Condivisione dati',
    'share.ownerInfo': "Aggiungi l'email dell'account Google delle persone che possono vedere i tuoi dati. Loro vedranno tutto in tempo reale ma in sola lettura: solo tu puoi modificare.",
    'share.add': 'Aggiungi',
    'share.remove': 'Rimuovi',
    'share.roleViewer': 'sola lettura',
    'share.noneYet': 'Non hai ancora condiviso i tuoi dati con nessuno.',
    'share.receivedTitle': 'Dati condivisi con te',
    'share.switchLabel': 'Quali dati vuoi vedere',
    'share.myData': 'I miei dati',
    'share.rename': 'Rinomina attività',
    'share.noneReceived': 'Nessuno ha ancora condiviso dei dati con te.',
    'share.view': 'Apri',
    'share.exit': 'Torna ai miei dati',
    'share.refresh': 'Aggiorna elenco',
    'share.refreshed': 'Elenco condivisioni aggiornato',
    'share.added': 'Persona autorizzata',
    'share.removed': 'Autorizzazione revocata',
    'share.removeTitle': 'Revoca accesso',
    'share.removeMsg': 'Vuoi togliere l\'accesso ai tuoi dati a ',
    'share.invalidEmail': 'Inserisci un indirizzo email valido',
    'share.cannotShareSelf': 'Non puoi condividere i dati con te stesso',
    'share.alreadyShared': 'Questa persona e\' gia\' autorizzata',
    'share.error': 'Errore condivisione: ',
    'share.nowViewing': 'Stai vedendo i dati di ',
    'share.backToMine': 'Sei tornato ai tuoi dati',
    'share.viewingBanner': 'Sola lettura — dati di ',
    'share.readOnlyBlocked': 'Sola lettura: solo il proprietario puo\' modificare questi dati',
    'share.revoked': 'Il proprietario ha revocato il tuo accesso',

    // Backup
    'backup.title': 'oppure backup manuale',
    'backup.titleCard': 'Backup & Import',
    'backup.download': 'Scarica',
    'backup.restore': 'Ripristina',
    'backup.export': 'Esporta',
    'backup.import': 'Importa',
    'backup.excelTitle': 'importa dati da Excel',
    'backup.downloadTemplate': '1. Scarica Template',
    'backup.uploadFile': '2. Carica File',
    'backup.excelHelp': 'Scarica il template, compilalo con i tuoi dati, poi caricalo',
    'backup.templateDone': 'Template scaricato! Compilalo e ricaricalo',
    'backup.fileEmpty': 'File vuoto',
    'backup.noValidData': 'Nessun dato valido trovato',
    'date.prev': 'Giorno precedente',
    'date.next': 'Giorno successivo',
    'autoBackup.toggleAria': 'Backup automatico ogni settimana',
    'autoBackup.askTitle': 'Copia di sicurezza',
    'autoBackup.askMsg': 'E\' passata una settimana dall\'ultima copia. Vuoi scaricare adesso un backup dei tuoi dati?',
    'backup.noColumns': 'Colonne non riconosciute ({cols}). Usa il template o rinomina le colonne.',
    'backup.fileError': 'Errore lettura file: ',
    'backup.moreItems': '...e altri {n} movimenti',
    'backup.totalItems': '{n} movimenti totali',
    'backup.imported': '{n} movimenti importati!',
    'backup.importedFatture': '{n} fatture importate!',
    'backup.totalFatture': '{n} fatture totali',
    'backup.excelFattureTitle': 'Importa Fatture da Excel',
    'backup.excelFattureHelp': 'Colonne: Data, Numero, Azienda, Importo, Tipo Pagamento, Scadenza, Note',
    'backup.downloaded': 'Backup scaricato! Salvalo in un posto sicuro',
    'backup.invalidFile': 'File non valido: non e\' un backup di Cassa Smart Pro',
    'backup.restoreTitle': 'Ripristina Backup',
    'backup.restoreMsg': 'Backup del {date} con {n} movimenti. I dati attuali verranno sostituiti. Continuare?',
    'backup.restoreDone': 'Dati ripristinati! {n} movimenti caricati',
    'backup.readError': 'Errore nella lettura del file',
    'backup.exportDone': 'Movimenti esportati!',
    'backup.exportMovimenti': 'Esporta Movimenti',

    // Excel hardcoded labels
    'excel.imported': 'Importato',
    'excel.deposit': 'Deposito',
    'excel.refund': 'Reso cliente',
    'exp.reso': 'Reso al cliente',
    'exp.resoPlaceholder': 'Cliente o motivo (facoltativo)',
    'excel.colArrivalDate': 'Data Arrivo',
    'excel.colNumber': 'Numero',
    'excel.colSupplier': 'Azienda/Fornitore',
    'excel.colPaymentType': 'Tipo Pagamento',
    'excel.colDueDate': 'Scadenza',
    'excel.colNotes': 'Note',
    'excel.colPaid': 'Pagata',

    // Statistics
    'stats.title': 'Statistiche',
    'stats.net': 'Netto',
    'stats.monthlyTrend': 'Andamento mensile',
    'stats.categories': 'Categorie spese (mese corrente)',
    'report.categories': 'Spese per categoria',
    'report.totalTakings': 'Totale incassi',
    'report.ofWhichPos': 'di cui POS',
    'report.mix': 'Contanti e POS',
    'report.cash': 'Contanti',
    'report.posBefore': 'Nel periodo precedente il POS era il',
    'report.compareLabel': 'Confronta con',
    'report.compare.previous': 'Periodo precedente',
    'report.compare.lastYear': 'Anno prima',
    'report.compare.customCompare': 'Scegli periodo',

    // Excel import preview
    'excel.previewTitle': 'Anteprima Importazione',
    'excel.cancel': 'Annulla',
    'excel.importAll': 'Importa Tutto',
    'excel.colDate': 'Data',
    'excel.colDesc': 'Descrizione',
    'excel.colAmount': 'Importo',
    'excel.colTotal': 'TOTALE',
    'excel.colPos': 'POS',
    'excel.colCash': 'Contanti',
    'excel.colCashOut': 'Uscita Cash',
    'excel.colExpItem': 'Voce Spesa',
    'excel.colDeposit': 'Deposito',
    'excel.colRefund': 'Reso',
    'excel.incomes': 'Incassi',
    'excel.expenses': 'Uscite',
    'excel.net': 'Netto',

    // Incassi
    'incassi.title': 'Incassi',
    'incassi.add': 'Aggiungi Cassa',
    'incassi.cassa': 'Cassa',
    'incassi.totaleZ': 'TOTALE',
    'incassi.totaleLabel': 'TOTALE',
    'incassi.pos': 'POS',

    // Uscite
    'uscite.title': 'Uscite',
    'uscite.add': 'Aggiungi Spesa',
    'uscite.registra': 'Registra Chiusura',
    'uscite.registered': '\u2713 Registrato!',
    'uscite.noData': 'Inserisci incassi o aggiungi spese',
    'uscite.expenses': 'uscite',
    'bridge.fattureCreate': '{n} in Fatture',

    // Expense sheet
    'exp.title': 'Aggiungi Spesa',
    'exp.currency': 'EUR',
    'exp.other': 'Altro',
    'exp.type': 'Tipologia',
    'exp.fornitori': 'Fornitori',
    'exp.stipendi': 'Stipendi',
    'exp.abitudinarie': 'Abitudinarie',
    'exp.libera': 'Libera',
    'exp.selectVoice': 'Seleziona voce',
    'exp.searchVoice': 'Cerca...',
    'exp.noVoices': 'Nessuna voce in questa categoria. Usa "+ Nuova".',
    'exp.noMatch': 'Nessun risultato',
    'exp.moreVoices': 'Altri {n}: continua a scrivere per restringere',
    'exp.description': 'Descrizione',
    'exp.descPlaceholder': 'Nome della spesa...',
    'exp.fattura': 'N\u00B0 Fattura',
    'exp.fatturaPlaceholder': 'Numero fattura...',
    'exp.note': 'Note (opzionale)',
    'exp.notePlaceholder': 'Aggiungi una nota...',
    'exp.cancel': 'Annulla',
    'exp.add': 'Aggiungi',
    'exp.invalidAmount': 'Inserisci un importo valido',
    'exp.selectOrFree': 'Seleziona una voce o usa "Libera"',
    'exp.enterFattNum': 'Inserisci il numero fattura',
    'exp.added': ' aggiunta',
    'exp.noPending': 'Nessuna spesa aggiunta',
    'exp.fatt': 'Fatt. ',
    'exp.totalExpenses': 'Totale uscite',
    'exp.removed': ' rimossa',
    'exp.newVoice': '+ Nuova',
    'exp.genericExpense': 'Spesa generica',
    'exp.expense': 'Spesa',
    'exp.fornitore': 'Fornitore',
    'exp.stipendio': 'Stipendio',

    // Depositi in banca
    'dep.title': 'Depositi in banca',
    'dep.add': 'Aggiungi Deposito',
    'dep.sheetTitle': 'Deposito in banca',
    'dep.log': 'Deposito in banca',
    'dep.note': 'Banca o nota (opzionale)',
    'dep.notePlaceholder': 'Es. versamento del mattino',
    'dep.noPending': 'Nessun deposito aggiunto',
    'dep.total': 'Totale depositi',
    'dep.added': ' messo in deposito',
    'dep.removed': ' rimosso',
    'dep.hint': 'Contanti portati in banca: escono dalla cassa ma non sono una spesa.',

    // Rubrica
    'rub.fornitori': 'Fornitori',
    'rub.stipendi': 'Stipendi',
    'rub.abitudinarie': 'Abitudinarie',
    'rub.voce_one': 'voce',
    'rub.voce_other': 'voci',
    'rub.addFornitore': 'Aggiungi fornitore',
    'rub.addStipendio': 'Aggiungi stipendio',
    'rub.addVoce': 'Aggiungi voce',
    'rub.deleteTitle': 'Elimina',
    'rub.deleteMsg': 'Rimuovere "{name}" dalla rubrica?',
    'rub.deleted': '"{name}" eliminato',
    'rub.rename': 'Rinomina',
    'rub.newFornitore': 'Nuovo Fornitore',
    'rub.newStipendio': 'Nuovo Stipendio',
    'rub.newVoce': 'Nuova Voce Abitudinaria',
    'rub.renamed': '"{old}" rinominato in "{new}"',
    'rub.added': '"{name}" aggiunto',

    // Modal
    'modal.add': 'Aggiungi',
    'modal.name': 'Nome',
    'modal.namePlaceholder': 'Inserisci nome...',
    'modal.cancel': 'Annulla',

    // Confirm
    'confirm.title': 'Conferma',
    'confirm.msg': 'Sei sicuro?',
    'confirm.cancel': 'Annulla',
    'confirm.delete': 'Elimina',

    // Date
    'date.past': 'Passata',
    'date.future': 'Futura',

    // Day summary
    'day.noMovement': 'Nessun movimento il ',
    'day.endBalance': 'Saldo a fine giornata',
    'day.registeredOn': 'Registrato il ',
    'day.total': 'Totale giorno',
    'day.closeEdit': 'Chiudi Modifica',
    'day.editDay': 'Modifica Giornata',
    'day.share': 'Condividi Giornata',
    'day.shareTitle': 'Cassa del ',
    'day.copied': 'Copiato negli appunti!',
    'share.previewTitle': 'Anteprima Condivisione',
    'share.copy': 'Copia',
    'share.send': 'Condividi',
    'day.downloaded': 'Immagine salvata',
    'day.totalCash': 'Totale cassa',
    'day.yesterdayBalance': 'Saldo ieri',
    'day.shareIncassi': 'Incassi',
    'day.shareUscite': 'Uscite',
    'day.shareDepositi': 'Depositi in banca',
    'day.shareTotalCash': 'Totale contanti',
    'day.shareRemaining': 'Rimasto in cassa',
    'day.deleteTitle': 'Elimina Movimento',
    'day.deleteMsg': 'Rimuovere "{name}"? Il saldo verra\' ricalcolato.',
    'day.deleted': 'Movimento eliminato',
    'day.cashBalance': 'Saldo cassa',
    'day.dayTotal': 'Totale giorno',

    // History
    'history.empty': 'Nessun movimento registrato',
    'history.searchPlaceholder': 'Cerca movimenti...',
    'history.noResults': 'Nessun risultato trovato',
    'history.deleteTitle': 'Elimina Movimento',
    'history.deleteMsg': 'Rimuovere "{name}" dallo storico? Il saldo verr\u00E0 ricalcolato.',
    'history.deleted': 'Movimento eliminato',

    // Fatture
    'fatt.new': 'Nuova Fattura',
    'fatt.edit': 'Modifica Fattura',
    'fatt.save': 'Salva',
    'fatt.update': 'Aggiorna',
    'fatt.data': 'Data',
    'fatt.numero': 'N\u00B0 Fattura',
    'fatt.numeroPlaceholder': 'N\u00B0 fattura',
    'fatt.fornitore': 'Fornitore',
    'fatt.fornitorePlaceholder': 'Seleziona fornitore',
    'fatt.newFornitore': 'Nome del nuovo fornitore:',
    'fatt.importo': 'Importo',
    'fatt.tipo': 'Tipo di pagamento',
    'fatt.select': 'Seleziona...',
    'fatt.contanti': 'Contanti',
    'fatt.bonifico': 'Bonifico',
    'fatt.assegno': 'Assegno',
    'fatt.numAssegno': 'Numero assegno',
    'fatt.numAssegnoPlaceholder': 'N\u00B0 assegno',
    'fatt.ciclo': 'Ciclo pagamento',
    'fatt.30days': '30 giorni',
    'fatt.60days': '60 giorni',
    'fatt.90days': '90 giorni',
    'fatt.120days': '120 giorni',
    'fatt.custom': 'Personalizzato',
    'fatt.scadenza': 'Scadenza',
    'fatt.note': 'Note',
    'fatt.notePlaceholder': 'Note opzionali...',
    'fatt.foto': 'Foto fattura',
    'fatt.attachPhoto': '\uD83D\uDCF7 Allega foto',
    'fatt.cancel': 'Annulla',
    'fatt.detail': 'Dettaglio Fattura',
    'fatt.modifica': 'Modifica',
    'fatt.elimina': 'Elimina',
    'fatt.deleteTitle': 'Elimina Fattura',
    'fatt.deleteMsg': 'Vuoi eliminare questa fattura?',
    'fatt.deleted': 'Fattura eliminata',
    'fatt.updated': 'Fattura aggiornata',
    'fatt.added': 'Fattura aggiunta',
    'fatt.enterFornitore': 'Inserisci il fornitore',
    'fatt.invalidAmount': 'Inserisci un importo valido',
    'fatt.selectTipo': 'Seleziona il tipo di pagamento',
    'fatt.enterAssegno': 'Inserisci il numero assegno',
    'fatt.empty': 'Nessuna fattura registrata',
    'fatt.emptyFilter': 'Nessuna fattura in questa categoria',
    'fatt.daPagare': 'Da pagare',
    'fatt.inScadenza': 'In scadenza',
    'fatt.filterAll': 'Tutte',
    'fatt.filterOpen': 'Da pagare',
    'fatt.filterPaid': 'Pagate',
    'fatt.filterExpired': 'Scadute',
    'fatt.sortDate': 'Data',
    'fatt.sortAlpha': 'A-Z',
    'fatt.sortAmount': 'Importo',
    'fatt.sortStatus': 'Stato',
    'fatt.paid': 'Pagata',
    'fatt.unpaid': 'Da pagare: ',
    'fatt.unpaidLabel': 'Da pagare',
    'fatt.markPaid': 'Segna come pagata',
    'fatt.markUnpaid': 'Segna come non pagata',
    'fatt.markedPaid': 'Fattura segnata come pagata',
    'fatt.markedUnpaid': 'Fattura riaperta',
    'fatt.tipoPagamento': 'Tipo pagamento',
    'fatt.cicloPagamento': 'Ciclo pagamento',
    'fatt.days': ' giorni',
    'fatt.fotoLabel': 'Foto',
    'fatt.legacyCash': 'Pag. contanti',
    'fatt.legacyAuto': '(auto)',
    'fatt.legacyBonifico': 'Bonifico/Assegno',
    'fatt.legacyUnpaid': 'Non pagato',
    'fatt.incassoCash': 'Incasso Contanti',

    // ANTICIPI REMOVED - keys kept for log translation
    'ant.logAdvance': 'Anticipo',
    'ant.logRepay': 'Rimborso anticipo',

    // Rubriche page
    'rub.pageTitle': 'Rubriche',

    // Scanner PDF
    'fatt.scanning': 'Scansione in corso...',
    'fatt.scanDone': 'PDF creato',
    'fatt.downloadPdf': 'Scarica PDF',
    'fatt.pdfAttached': 'PDF allegato',
    'fatt.pdfLabel': 'Documento',
    'fatt.noPdf': 'Nessun PDF allegato',
    'fatt.viewPhoto': 'Apri',

    // Dati Azienda
    'azienda.title': 'Dati Azienda',
    'azienda.info': 'I tuoi dati aziendali. Servono per distinguere i tuoi dati da quelli del fornitore durante la scansione automatica.',
    'azienda.nome': 'Nome azienda',
    'azienda.nomePlaceholder': 'Es. Ristorante Da Mario...',
    'azienda.piva': 'P.IVA / Codice Fiscale',
    'azienda.pivaPlaceholder': 'Es. IT01234567890...',
    'azienda.saved': 'Dati azienda salvati',
    'azienda.save': 'Salva',

    // AI Invoice Recognition
    'ocr.title': 'Riconoscimento Fatture (AI)',
    'ocr.info': 'Inserisci la tua API key OpenAI per compilare automaticamente i campi delle fatture dalla foto.',
    'ocr.keyPlaceholder': 'sk-...',
    'ocr.save': 'Salva',
    'ocr.configured': 'Configurato',
    'ocr.notConfigured': 'Non configurato',
    'ocr.remove': 'Rimuovi',
    'ocr.extracting': 'Analisi fattura...',
    'ocr.extracted': 'Campi compilati automaticamente',
    'ocr.extractError': 'Impossibile analizzare la fattura',

    // Contabile vocale (AI)
    'voice.title': 'Contabile',
    'voice.greeting': 'Ciao! Sono il tuo contabile. Tocca il microfono e dimmi cosa fare: posso registrare incassi, spese, fatture o rispondere alle tue domande.',
    'voice.tapToSpeak': 'Tocca il microfono e parla',
    'voice.listening': 'Ti ascolto...',
    'voice.transcribing': 'Trascrizione...',
    'voice.thinking': 'Sto pensando...',
    'voice.notUnderstood': 'Non ho capito, riprova.',
    'voice.error': 'Si è verificato un errore. Riprova.',
    'voice.micDenied': 'Microfono non disponibile. Consenti l\'accesso al microfono.',
    'voice.needKey': 'Serve la tua chiave Gemini gratuita (Impostazioni › Fatture & AI).',
    'voice.needKeyLong': 'Per usare il contabile vocale inserisci la tua chiave gratuita Google Gemini in Impostazioni › Fatture & AI. È gratis: si crea in un minuto su Google AI Studio.',
    'gemini.title': 'Contabile Vocale (AI gratis)',
    'gemini.info': 'Usa Google Gemini (gratis) per il contabile vocale. Crea una chiave gratuita su Google AI Studio e incollala qui.',
    'gemini.getKey': 'Ottieni una chiave gratuita →',
    'voice.confirmTitle': 'Confermi questa operazione?',
    'voice.confirmSpoken': 'Confermi?',
    'voice.confirm': 'Conferma',
    'voice.cancel': 'Annulla',
    'voice.cancelled': 'Ok, ho annullato.',
    'voice.done': 'Fatto.',
    'voice.fab': 'Contabile vocale',
    'voice.act.incasso': 'Registro un incasso di {cash} (totale {tot}, POS {pos})',
    'voice.act.spesa': 'Registro una spesa di {importo} per {nome}',
    'voice.act.fattura': 'Registro una fattura di {importo} da {fornitore}',
    'voice.act.pagata': 'Segno come pagata la fattura {rif}',
    'voice.act.saldo': 'Imposto il saldo di cassa a {saldo}',
    'voice.res.incasso': 'Registrato incasso di {cash}.',
    'voice.res.spesa': 'Registrata spesa di {importo} per {nome}.',
    'voice.res.fattura': 'Registrata fattura di {importo} da {fornitore}.',
    'voice.res.pagata': 'Fattura di {fornitore} segnata come pagata.',
    'voice.res.saldo': 'Saldo impostato a {saldo}.',
    'voice.res.invalid': 'Dati non validi, operazione annullata.',
    'voice.res.notFound': 'Non ho trovato la fattura indicata.',
    'voice.err.generic': 'Qualcosa non ha funzionato. Riprova.',
    'voice.err.net': 'Non riesco a raggiungere Google. Controlla la connessione.',
    'voice.err.key': 'La chiave Gemini non è valida: controlla di averla copiata per intero.',
    'voice.err.denied': 'Questa chiave non ha il permesso di usare Gemini. Controlla le restrizioni della chiave su Google AI Studio.',
    'voice.err.quota': 'Per adesso hai esaurito le richieste gratuite. Riprova fra qualche minuto.',
    'voice.err.model': 'Il modello non è disponibile per questa chiave. Prova a crearne una nuova su Google AI Studio.',
    'voice.err.busy': 'Google è sovraccarico in questo momento. Riprova fra poco.',
    'gemini.test': 'Prova la chiave',
    'gemini.testing': 'Sto provando…',
    'gemini.testOk': 'La chiave funziona (modello {m}).',
    'gemini.noKey': 'Prima incolla la chiave.',

    // Offline
    'offline.banner': 'Modalità offline — i dati verranno sincronizzati al ritorno online',
    'offline.backOnline': 'Connessione ripristinata, sincronizzazione in corso...',

    // Search
    'search.aria': 'Cerca',
    'search.placeholder': 'Cerca in tutto...',
    'search.cancel': 'Annulla',
    'search.noResults': 'Nessun risultato trovato',
    'search.in': 'in',
    'search.typeMovimento': 'Movimenti',
    'search.typeFattura': 'Fatture',
    'search.typeRubrica': 'Rubriche',


    // PDF Report
    'pdf.reportBtn': 'Report PDF',
    'pdf.title': 'Report Mensile',
    'pdf.selectMonth': 'Seleziona mese',
    'pdf.print': 'Stampa / PDF',
    'pdf.summary': 'Riepilogo del mese',
    'pdf.expenseCategories': 'Uscite per categoria',
    'pdf.depositi': 'Depositi in banca',
    'pdf.invoices': 'Fatture del mese',
    'pdf.status': 'Stato',
    'pdf.generated': 'Generato il',
    'pdf.currentBalance': 'Saldo attuale',

    // Dashboard
    'dash.title': 'Riepilogo',
    'dash.tapDetail': 'Tocca per dettagli',
    'dash.totalCassa': 'Totale in cassa',
    'dash.fattureMese': 'Fatture in scadenza questo mese',
    'dash.speseExtra': 'Altre spese del mese',
    'dash.fattureScadute': 'Fatture scadute non saldate',
    'dash.invoices': 'fatture',

    // Custom Categories
    'customCats.title': 'Categorie Personalizzate',
    'customCats.info': 'Crea categorie di spesa personalizzate.',
    'customCats.namePlaceholder': 'Nome categoria...',
    'customCats.add': 'Aggiungi',
    'customCats.empty': 'Nessuna categoria personalizzata',
    'customCats.enterName': 'Inserisci il nome della categoria',
    'customCats.added': '"{name}" aggiunta',

    // Fatture due notifications
    'fatt.dueWarningTitle': '{n} fatture in scadenza',
    'fatt.dueToday': 'Scade oggi',
    'fatt.dueInDays': 'Scade tra {n} giorni',
    'fatt.overdue': 'Scaduta da {n} giorni',

    // Auto Backup
    'autoBackup.title': 'Backup Automatico',
    'autoBackup.info': 'Scarica automaticamente un backup JSON ogni 7 giorni.',
    'autoBackup.lastLabel': 'Ultimo backup',
    'autoBackup.never': 'Mai',
    'autoBackup.manualBtn': 'Scarica backup ora',
  },

  zh: {
    // App
    'app.title': '智能收银Pro',
    'app.cloudDisconnected': '云端未连接',

    // PIN
    'pin.title': '智能收银Pro',
    'pin.subtitle': '请输入密码',
    'pin.blocked': '账户已被锁定',
    'pin.tooMany': '错误次数过多',
    'pin.remaining_one': '次机会',
    'pin.remaining_other': '次机会',
    'pin.change': '修改密码',
    'pin.oldPin': '当前密码',
    'pin.newPin': '新密码',
    'pin.confirmPin': '确认新密码',
    'pin.save': '保存',
    'pin.wrongOld': '当前密码不正确',
    'pin.invalidLength': '密码必须为4-8位数字',
    'pin.noMatch': '两次输入的密码不一致',
    'pin.changed': '密码修改成功',
    'pin.chooseTitle': '欢迎',
    'pin.chooseNew': '设置您的密码',
    'pin.confirmNew': '确认您的密码',
    'pin.mismatchRetry': '两次密码不一致，请重试',

    // Tabs
    'tab.registra': '收银',
    'tab.rubriche': '名册',
    'tab.storico': '记录',
    'tab.report': '报表',
    'report.preset.thisMonth': '本月',
    'report.preset.lastMonth': '上月',
    'report.preset.last3': '近三个月',
    'report.preset.thisYear': '今年',
    'report.preset.custom': '自定义',
    'report.from': '从',
    'report.to': '到',
    'report.comparedTo': '对比',
    'report.noChange': '无变化',
    'report.monthByMonth': '逐月对比',
    'report.month': '月份',
    'report.total': '合计',
    'report.dailyTrend': '每日走势',
    'report.averages': '平均值与单日',
    'report.nettoFormula': '现金 − 支出',
    'report.depTitolo': '银行存款',
    'report.depNota': '存款不是支出，不计入支出，但现金确实从收银台出去了：净额里会扣掉。',
    'report.depMovimenti': '{n} 笔',
    'report.depMovimentiUno': '1 笔',
    'report.nettoFormulaDep': '现金 − 支出 − 存款',
    'report.depVersato': '存入',
    'pdf.fattPagato': '已付',
    'pdf.fattPagamenti': '本月发票付款',
    'pdf.fattResiduo': '未付余额',
    'report.fattPagato': '已付',
    'report.fattNelPeriodo': '本期',
    'report.fattSenzaData': '无日期的付款（旧记录或导入）',
    'report.fattTitolo': '供应商发票',
    'report.fattArrivate': '本期到货',
    'report.fattDaPagare': '待付',
    'report.fattScadute': '逾期',
    'report.fattAOggi': '截至今天',
    'report.fattNumero': '{n} 张发票',
    'report.fattNumeroUno': '1 张发票',
    'report.fattInScadenza': '本期到期',
    'report.fattResiduoArrivate': '本期发票未付余额',
    'report.fattTopFornitori': '本期供应商',
    'report.fattResiduoBreve': '未付',
    'report.fattNota': '发票不计入上方的现金账目：用现金支付的发票已经记为一笔支出。',
    'report.avgIncome': '平均收入',
    'report.avgExpense': '平均支出',
    'report.workedDays': '有记录的天数',
    'report.bestDay': '最佳单日',
    'report.worstDay': '最差单日',
    'report.byWeekday': '各星期平均收入',
    'report.emptyPeriod': '所选期间没有记录。',
    'tab.fatture': '账单',

    // Saldo
    'saldo.title': '收银总余额',
    'saldo.updated': '余额已更新',

    // Settings
    'settings.title': '设置',
    'settings.back': '返回',
    'settings.lang': '语言',
    'settings.langLabel': '选择语言',
    'settings.saldo': '手动设置余额',
    'settings.saldoLabel': '设置当前余额',
    'settings.saldoPlaceholder': '输入余额...',
    'settings.update': '更新余额',
    'settings.reset': '清空数据',
    'settings.dangerZone': '危险操作',
    'settings.dangerInfo': '此操作将删除所有流水、名册和账单，且无法恢复。',
    'settings.resetTitle': '清空数据',
    'settings.resetMsg': '所有流水和名册将被删除，是否继续？',
    'settings.resetConfirm2': '确定要删除吗？',
    'settings.resetMsg2': '此操作无法撤销，所有数据将永久丢失。',
    'settings.resetDone': '数据已清空',
    'settings.general': '通用',
    'settings.fattureAi': '账单 & AI',
    'settings.cloudBackup': '云端 & 备份',
    'settings.advanced': '高级',

    // Cloud
    'cloud.title': '云端同步',
    'cloud.connected': '云端已连接',
    'cloud.lastSync': '上次同步：',
    'cloud.autoSave': '每次修改都会自动同步到Firebase云端。',
    'cloud.reload': '从云端重新加载',
    'cloud.disconnect': '断开连接',
    'cloud.notConfigured': '云端未配置',
    'cloud.setupInfo': '配置Firebase后可自动将数据保存到云端，只需设置一次（约5分钟）。',
    'cloud.step1': '打开 console.firebase.google.com，创建一个新项目（名字随意，关闭Google Analytics）。',
    'cloud.step2': '在项目中，点击左侧菜单 "Build" > "Firestore Database"，选择 "Start in test mode"，选择最近的地区。',
    'cloud.step3': '在 "Build" > "Authentication" 中，点击 "Get started"，然后启用 "Google" 登录方式。',
    'cloud.step4': '进入项目设置（顶部齿轮图标）> 向下滑到 "Your apps" > 点击 "Web"（</>图标）> 填写名称并注册。复制 firebaseConfig 代码并粘贴到下方。',
    'cloud.connect': '连接云端',
    'cloud.synced': '已同步',
    'cloud.syncing': '同步中...',
    'cloud.syncError': '同步失败',
    'cloud.reloaded': '已从云端重新加载数据',
    'cloud.noData': '云端没有数据',
    'cloud.loginToSync': '请登录以同步',
    'cloud.loginInfo': '用Google账号登录，即可在多个设备间同步数据。',
    'cloud.loginGoogle': '用Google登录',
    'cloud.or': '或',
    'cloud.removeConfig': '删除配置',
    'cloud.connError': '连接失败：',
    'cloud.connectedAs': '已登录：',
    'cloud.loginError': '登录失败：',
    'cloud.invalidConfig': '配置格式有误，请检查。',
    'cloud.connecting': '正在连接云端...',
    'cloud.disconnectTitle': '断开云端',
    'cloud.disconnectMsg': '本地数据会保留，确定断开云端同步吗？',
    'cloud.disconnected': '已断开云端',

    // 数据共享
    'share.title': '数据共享',
    'share.ownerInfo': '添加可以查看你数据的人的Google账号邮箱。他们能实时看到全部内容，但只能查看：只有你可以修改。',
    'share.add': '添加',
    'share.remove': '移除',
    'share.roleViewer': '只读',
    'share.noneYet': '你还没有把数据分享给任何人。',
    'share.receivedTitle': '共享给你的数据',
    'share.switchLabel': '查看哪份数据',
    'share.myData': '我的数据',
    'share.rename': '重命名店铺',
    'share.noneReceived': '还没有人把数据分享给你。',
    'share.view': '打开',
    'share.exit': '返回我的数据',
    'share.refresh': '刷新列表',
    'share.refreshed': '共享列表已刷新',
    'share.added': '已授权该用户',
    'share.removed': '已撤销授权',
    'share.removeTitle': '撤销访问权限',
    'share.removeMsg': '确定要取消此人对你数据的访问权限吗？',
    'share.invalidEmail': '请输入有效的邮箱地址',
    'share.cannotShareSelf': '不能把数据分享给自己',
    'share.alreadyShared': '该用户已被授权',
    'share.error': '共享失败：',
    'share.nowViewing': '正在查看的数据来自 ',
    'share.backToMine': '已返回你自己的数据',
    'share.viewingBanner': '只读 — 数据来自 ',
    'share.readOnlyBlocked': '只读模式：只有数据所有者可以修改',
    'share.revoked': '所有者已撤销你的访问权限',

    // Backup
    'backup.title': '手动备份',
    'backup.titleCard': '备份与导入',
    'backup.download': '下载',
    'backup.restore': '恢复',
    'backup.export': '导出',
    'backup.import': '导入',
    'backup.excelTitle': '从Excel导入数据',
    'backup.downloadTemplate': '1. 下载模板',
    'backup.uploadFile': '2. 上传文件',
    'backup.excelHelp': '先下载模板，填好数据后再上传',
    'backup.templateDone': '模板已下载，填好后重新上传',
    'backup.fileEmpty': '文件是空的',
    'backup.noValidData': '没有找到有效数据',
    'date.prev': '前一天',
    'date.next': '后一天',
    'autoBackup.toggleAria': '每周自动备份',
    'autoBackup.askTitle': '数据备份',
    'autoBackup.askMsg': '距离上次备份已过去一周。现在下载一份数据备份吗？',
    'backup.noColumns': '无法识别列名（{cols}）。请使用模板或重命名列。',
    'backup.fileError': '读取文件出错：',
    'backup.moreItems': '...还有{n}条',
    'backup.totalItems': '共{n}条记录',
    'backup.imported': '成功导入{n}条记录！',
    'backup.importedFatture': '成功导入{n}张账单！',
    'backup.totalFatture': '共{n}张账单',
    'backup.excelFattureTitle': '从Excel导入账单',
    'backup.excelFattureHelp': '列：日期、编号、供应商、金额、付款方式、到期日、备注',
    'backup.downloaded': '备份已下载，请妥善保存',
    'backup.invalidFile': '文件无效，不是本应用的备份文件',
    'backup.restoreTitle': '恢复备份',
    'backup.restoreMsg': '{date}的备份，含{n}条记录。当前数据将被覆盖，是否继续？',
    'backup.restoreDone': '恢复成功！已加载{n}条记录',
    'backup.readError': '读取文件出错',
    'backup.exportDone': '流水已导出！',
    'backup.exportMovimenti': '导出流水',

    // Excel hardcoded labels
    'excel.imported': '已导入',
    'excel.deposit': '存款',
    'excel.refund': '退款',
    'exp.reso': '客人退钱',
    'exp.resoPlaceholder': '客人或原因（可选）',
    'excel.colArrivalDate': '到达日期',
    'excel.colNumber': '编号',
    'excel.colSupplier': '供应商',
    'excel.colPaymentType': '付款方式',
    'excel.colDueDate': '到期日',
    'excel.colNotes': '备注',
    'excel.colPaid': '已付',

    // Statistics
    'stats.title': '统计',
    'stats.net': '净额',
    'stats.monthlyTrend': '月度走势',
    'stats.categories': '本月支出分类',
    'report.categories': '按类别支出',
    'report.totalTakings': '总收入',
    'report.ofWhichPos': '其中POS',
    'report.mix': '现金与POS',
    'report.cash': '现金',
    'report.posBefore': '上期POS占比为',
    'report.compareLabel': '对比',
    'report.compare.previous': '上一期',
    'report.compare.lastYear': '去年同期',
    'report.compare.customCompare': '自选期间',

    // Excel
    'excel.previewTitle': '导入预览',
    'excel.cancel': '取消',
    'excel.importAll': '全部导入',
    'excel.colDate': '日期',
    'excel.colDesc': '说明',
    'excel.colAmount': '金额',
    'excel.colTotal': '总计',
    'excel.colPos': 'POS',
    'excel.colCash': '现金',
    'excel.colCashOut': '现金支出',
    'excel.colExpItem': '支出项目',
    'excel.colDeposit': '存款',
    'excel.colRefund': '退款',
    'excel.incomes': '收入',
    'excel.expenses': '支出',
    'excel.net': '净额',

    // Incassi
    'incassi.title': '收入',
    'incassi.add': '添加收银台',
    'incassi.cassa': '收银台',
    'incassi.totaleZ': '总计',
    'incassi.totaleLabel': '总计',
    'incassi.pos': 'POS',

    // Uscite
    'uscite.title': '支出',
    'uscite.add': '添加支出',
    'uscite.registra': '登记结账',
    'uscite.registered': '\u2713 已登记！',
    'uscite.noData': '请先输入收入或添加支出',
    'uscite.expenses': '笔支出',
    'bridge.fattureCreate': '{n} 张发票已记入',

    // Expense sheet
    'exp.title': '添加支出',
    'exp.currency': 'EUR',
    'exp.other': '其他',
    'exp.type': '分类',
    'exp.fornitori': '供应商',
    'exp.stipendi': '工资',
    'exp.abitudinarie': '日常支出',
    'exp.libera': '自定义',
    'exp.selectVoice': '选择项目',
    'exp.searchVoice': '搜索...',
    'exp.noVoices': '此分类还没有条目。用"+ 新建"添加。',
    'exp.noMatch': '没有匹配项',
    'exp.moreVoices': '还有 {n} 项：继续输入以缩小范围',
    'exp.description': '说明',
    'exp.descPlaceholder': '支出名称...',
    'exp.fattura': '账单号',
    'exp.fatturaPlaceholder': '账单号码...',
    'exp.note': '备注（可选）',
    'exp.notePlaceholder': '添加备注...',
    'exp.cancel': '取消',
    'exp.add': '添加',
    'exp.invalidAmount': '请输入正确的金额',
    'exp.selectOrFree': '请选择项目或使用"自定义"',
    'exp.enterFattNum': '请输入账单号',
    'exp.added': '已添加',
    'exp.noPending': '暂无支出',
    'exp.fatt': '单号 ',
    'exp.totalExpenses': '支出合计',
    'exp.removed': '已移除',
    'exp.newVoice': '+ 新建',
    'exp.genericExpense': '其他支出',
    'exp.expense': '支出',
    'exp.fornitore': '供应商',
    'exp.stipendio': '工资',

    // Depositi in banca
    'dep.title': '银行存款',
    'dep.add': '添加存款',
    'dep.sheetTitle': '银行存款',
    'dep.log': '银行存款',
    'dep.note': '银行或备注（可选）',
    'dep.notePlaceholder': '例如：早上存款',
    'dep.noPending': '暂无存款',
    'dep.total': '存款合计',
    'dep.added': '已存入',
    'dep.removed': '已移除',
    'dep.hint': '存入银行的现金：从收银台出去，但不是支出。',

    // Rubrica
    'rub.fornitori': '供应商',
    'rub.stipendi': '工资',
    'rub.abitudinarie': '日常支出',
    'rub.voce_one': '项',
    'rub.voce_other': '项',
    'rub.addFornitore': '添加供应商',
    'rub.addStipendio': '添加工资项',
    'rub.addVoce': '添加项目',
    'rub.deleteTitle': '删除',
    'rub.deleteMsg': '确定从名册中移除"{name}"？',
    'rub.deleted': '已删除"{name}"',
    'rub.rename': '重命名',
    'rub.newFornitore': '新供应商',
    'rub.newStipendio': '新工资项',
    'rub.newVoce': '新日常支出项',
    'rub.renamed': '已将"{old}"重命名为"{new}"',
    'rub.added': '已添加"{name}"',

    // Modal
    'modal.add': '添加',
    'modal.name': '名称',
    'modal.namePlaceholder': '输入名称...',
    'modal.cancel': '取消',

    // Confirm
    'confirm.title': '确认',
    'confirm.msg': '确定吗？',
    'confirm.cancel': '取消',
    'confirm.delete': '删除',

    // Date
    'date.past': '过去',
    'date.future': '未来',

    // Day summary
    'day.noMovement': '当日无记录 ',
    'day.endBalance': '当日结余',
    'day.registeredOn': '登记于 ',
    'day.total': '当日合计',
    'day.closeEdit': '关闭编辑',
    'day.editDay': '编辑当日',
    'day.share': '分享当日',
    'day.shareTitle': '收银记录 ',
    'day.copied': '已复制！',
    'share.previewTitle': '分享预览',
    'share.copy': '复制',
    'share.send': '分享',
    'day.downloaded': '图片已保存',
    'day.totalCash': '收银总额',
    'day.yesterdayBalance': '昨日余额',
    'day.shareIncassi': '收入',
    'day.shareUscite': '支出',
    'day.shareDepositi': '银行存款',
    'day.shareTotalCash': '现金总额',
    'day.shareRemaining': '剩余现金',
    'day.deleteTitle': '删除记录',
    'day.deleteMsg': '确定移除"{name}"？余额将重新计算。',
    'day.deleted': '记录已删除',
    'day.cashBalance': '收银余额',
    'day.dayTotal': '当日合计',

    // History
    'history.empty': '暂无流水记录',
    'history.searchPlaceholder': '搜索...',
    'history.noResults': '没有找到相关记录',
    'history.deleteTitle': '删除记录',
    'history.deleteMsg': '确定从历史中移除"{name}"？余额将重新计算。',
    'history.deleted': '记录已删除',

    // Fatture
    'fatt.new': '新账单',
    'fatt.edit': '编辑账单',
    'fatt.save': '保存',
    'fatt.update': '更新',
    'fatt.data': '日期',
    'fatt.numero': '账单号',
    'fatt.numeroPlaceholder': '账单号',
    'fatt.fornitore': '供应商',
    'fatt.fornitorePlaceholder': '选择供应商',
    'fatt.newFornitore': '新供应商名称：',
    'fatt.importo': '金额',
    'fatt.tipo': '付款方式',
    'fatt.select': '请选择...',
    'fatt.contanti': '现金',
    'fatt.bonifico': '银行转账',
    'fatt.assegno': '支票',
    'fatt.numAssegno': '支票号',
    'fatt.numAssegnoPlaceholder': '支票号码',
    'fatt.ciclo': '付款周期',
    'fatt.30days': '30天',
    'fatt.60days': '60天',
    'fatt.90days': '90天',
    'fatt.120days': '120天',
    'fatt.custom': '自定义',
    'fatt.scadenza': '到期日',
    'fatt.note': '备注',
    'fatt.notePlaceholder': '备注（可选）...',
    'fatt.foto': '账单照片',
    'fatt.attachPhoto': '\uD83D\uDCF7 拍照/选择',
    'fatt.cancel': '取消',
    'fatt.detail': '账单详情',
    'fatt.modifica': '编辑',
    'fatt.elimina': '删除',
    'fatt.deleteTitle': '删除账单',
    'fatt.deleteMsg': '确定要删除这张账单？',
    'fatt.deleted': '账单已删除',
    'fatt.updated': '账单已更新',
    'fatt.added': '账单已添加',
    'fatt.enterFornitore': '请输入供应商名称',
    'fatt.invalidAmount': '请输入正确的金额',
    'fatt.selectTipo': '请选择付款方式',
    'fatt.enterAssegno': '请输入支票号',
    'fatt.empty': '暂无账单',
    'fatt.emptyFilter': '该分类暂无账单',
    'fatt.daPagare': '待付',
    'fatt.inScadenza': '即将到期',
    'fatt.filterAll': '全部',
    'fatt.filterOpen': '待付',
    'fatt.filterPaid': '已付',
    'fatt.filterExpired': '已过期',
    'fatt.sortDate': '日期',
    'fatt.sortAlpha': 'A-Z',
    'fatt.sortAmount': '金额',
    'fatt.sortStatus': '状态',
    'fatt.paid': '已付',
    'fatt.unpaid': '待付：',
    'fatt.unpaidLabel': '待付',
    'fatt.markPaid': '标为已付',
    'fatt.markUnpaid': '标为未付',
    'fatt.markedPaid': '已标记为已付款',
    'fatt.markedUnpaid': '已标记为未付款',
    'fatt.tipoPagamento': '付款方式',
    'fatt.cicloPagamento': '付款周期',
    'fatt.days': '天',
    'fatt.fotoLabel': '照片',
    'fatt.legacyCash': '现金付款',
    'fatt.legacyAuto': '(自动)',
    'fatt.legacyBonifico': '转账/支票',
    'fatt.legacyUnpaid': '未付款',
    'fatt.incassoCash': '现金收入',

    'ant.logAdvance': '借支',
    'ant.logRepay': '归还借支',

    // Rubriche page
    'rub.pageTitle': '名册',

    // Scanner PDF
    'fatt.scanning': '正在扫描...',
    'fatt.scanDone': 'PDF已创建',
    'fatt.downloadPdf': '下载PDF',
    'fatt.pdfAttached': '已附PDF',
    'fatt.pdfLabel': '文件',
    'fatt.noPdf': '无附件PDF',
    'fatt.viewPhoto': '查看',

    // Dati Azienda
    'azienda.title': '企业信息',
    'azienda.info': '你的企业信息，用于在自动扫描时区分你的数据和供应商的数据。',
    'azienda.nome': '企业名称',
    'azienda.nomePlaceholder': '例如：马里奥餐厅...',
    'azienda.piva': '税号',
    'azienda.pivaPlaceholder': '例如：IT01234567890...',
    'azienda.saved': '企业信息已保存',
    'azienda.save': '保存',

    // AI Invoice Recognition
    'ocr.title': '账单识别 (AI)',
    'ocr.info': '输入OpenAI API密钥，拍照后可自动识别并填写账单信息。',
    'ocr.keyPlaceholder': 'sk-...',
    'ocr.save': '保存',
    'ocr.configured': '已配置',
    'ocr.notConfigured': '未配置',
    'ocr.remove': '删除',
    'ocr.extracting': '正在分析账单...',
    'ocr.extracted': '已自动填写',
    'ocr.extractError': '无法分析账单',

    // 语音会计 (AI)
    'voice.title': '会计助手',
    'voice.greeting': '你好！我是你的会计助手。点击麦克风告诉我要做什么：我可以记录收入、支出、账单，或回答你的问题。',
    'voice.tapToSpeak': '点击麦克风开始说话',
    'voice.listening': '正在聆听...',
    'voice.transcribing': '正在转写...',
    'voice.thinking': '正在思考...',
    'voice.notUnderstood': '没有听清，请再试一次。',
    'voice.error': '出现错误，请重试。',
    'voice.micDenied': '麦克风不可用，请允许麦克风权限。',
    'voice.needKey': '需要你的免费 Gemini 密钥（设置 › 账单与AI）。',
    'voice.needKeyLong': '使用语音会计前，请在 设置 › 账单与AI 中填写你的免费 Google Gemini 密钥。完全免费，在 Google AI Studio 一分钟即可创建。',
    'gemini.title': '语音会计（免费AI）',
    'gemini.info': '使用 Google Gemini（免费）驱动语音会计。在 Google AI Studio 创建免费密钥并粘贴到此处。',
    'gemini.getKey': '获取免费密钥 →',
    'voice.confirmTitle': '确认这项操作吗？',
    'voice.confirmSpoken': '确认吗？',
    'voice.confirm': '确认',
    'voice.cancel': '取消',
    'voice.cancelled': '好的，已取消。',
    'voice.done': '完成。',
    'voice.fab': '语音会计',
    'voice.act.incasso': '记录一笔收入 {cash}（合计 {tot}，POS {pos}）',
    'voice.act.spesa': '记录一笔支出 {importo}，用于 {nome}',
    'voice.act.fattura': '登记一张账单 {importo}，来自 {fornitore}',
    'voice.act.pagata': '将账单 {rif} 标记为已付',
    'voice.act.saldo': '将现金余额设为 {saldo}',
    'voice.res.incasso': '已记录收入 {cash}。',
    'voice.res.spesa': '已记录支出 {importo}，用于 {nome}。',
    'voice.res.fattura': '已登记账单 {importo}，来自 {fornitore}。',
    'voice.res.pagata': '来自 {fornitore} 的账单已标记为已付。',
    'voice.res.saldo': '余额已设为 {saldo}。',
    'voice.res.invalid': '数据无效，操作已取消。',
    'voice.res.notFound': '未找到对应的账单。',
    'voice.err.generic': '出了点问题，请重试。',
    'voice.err.net': '连不上 Google，请检查网络连接。',
    'voice.err.key': 'Gemini 密钥无效：请检查是否完整复制。',
    'voice.err.denied': '该密钥没有使用 Gemini 的权限。请在 Google AI Studio 检查密钥限制。',
    'voice.err.quota': '免费额度暂时用完了，请过几分钟再试。',
    'voice.err.model': '该密钥无法使用这个模型。可以在 Google AI Studio 重新创建一个密钥。',
    'voice.err.busy': 'Google 当前繁忙，请稍后再试。',
    'gemini.test': '测试密钥',
    'gemini.testing': '正在测试…',
    'gemini.testOk': '密钥可用（模型 {m}）。',
    'gemini.noKey': '请先粘贴密钥。',

    // Offline
    'offline.banner': '离线模式 — 恢复联网后将自动同步数据',
    'offline.backOnline': '已恢复网络连接，正在同步...',

    // Search
    'search.aria': '搜索',
    'search.placeholder': '全局搜索...',
    'search.cancel': '取消',
    'search.noResults': '未找到相关结果',
    'search.in': '在',
    'search.typeMovimento': '流水记录',
    'search.typeFattura': '账单',
    'search.typeRubrica': '名册',

    // PDF Report
    'pdf.reportBtn': 'PDF报告',
    'pdf.title': '月度报告',
    'pdf.selectMonth': '选择月份',
    'pdf.print': '打印 / PDF',
    'pdf.summary': '本月概览',
    'pdf.expenseCategories': '支出分类',
    'pdf.depositi': '银行存款',
    'pdf.invoices': '本月账单',
    'pdf.status': '状态',
    'pdf.generated': '生成于',
    'pdf.currentBalance': '当前余额',

    // Dashboard
    'dash.title': '概览',
    'dash.tapDetail': '点击查看详情',
    'dash.totalCassa': '收银总额',
    'dash.fattureMese': '本月到期账单',
    'dash.speseExtra': '本月其他支出',
    'dash.fattureScadute': '逾期未付账单',
    'dash.invoices': '张账单',

    // Custom Categories
    'customCats.title': '自定义分类',
    'customCats.info': '创建自定义支出分类。',
    'customCats.namePlaceholder': '分类名称...',
    'customCats.add': '添加',
    'customCats.empty': '暂无自定义分类',
    'customCats.enterName': '请输入分类名称',
    'customCats.added': '已添加"{name}"',

    // Fatture due notifications
    'fatt.dueWarningTitle': '{n}张账单即将到期',
    'fatt.dueToday': '今天到期',
    'fatt.dueInDays': '{n}天后到期',
    'fatt.overdue': '已逾期{n}天',

    // Auto Backup
    'autoBackup.title': '自动备份',
    'autoBackup.info': '每7天自动下载一次JSON备份。',
    'autoBackup.lastLabel': '上次备份',
    'autoBackup.never': '从未',
    'autoBackup.manualBtn': '立即下载备份',
  }
};

// Known type prefixes in both languages for re-translation
const typeKeys = [
  { itVal: 'Fornitore', zhVal: '供应商', key: 'exp.fornitore' },
  { itVal: 'Stipendio', zhVal: '工资', key: 'exp.stipendio' },
  { itVal: 'Spesa', zhVal: '支出', key: 'exp.expense' },
  { itVal: 'Anticipo', zhVal: '借支', key: 'ant.logAdvance' },
  { itVal: 'Spesa generica', zhVal: '其他支出', key: 'exp.genericExpense' },
  { itVal: 'Reso al cliente', zhVal: '客人退钱', key: 'exp.reso' },
];
// Le entrate sono state scritte in forme diverse nel tempo: etichetta "Z" nelle
// versioni vecchie e "TOTALE" in quelle nuove, in italiano o in cinese, con o
// senza il prefisso della cassa. I due pattern separati per lingua ne
// riconoscevano solo una parte (130 su 551 nello storico reale), lasciando le
// altre non tradotte. Qui l'etichetta del totale non viene piu' guardata: conta
// che dentro le parentesi ci siano un importo e un POS.
const INCASSO_RE = /^(.*?)(?:Incasso Contanti|Incasso Cash|现金收入)\s*\(\s*[^:：()]+\s*[:：]\s*([\d.]+)\s+POS\s*[:：]\s*([\d.]+)\s*\)$/;

// { prefix, totale, pos, cash } oppure null se non e' un incasso.
// `totale` e' il battuto di giornata, `cash` la sola parte in contanti: e'
// quest'ultima a muovere il saldo, ma i report ragionano sul totale.
export function parseIncasso(desc) {
  const m = String(desc || '').match(INCASSO_RE);
  if (!m) return null;
  const totale = parseFloat(m[2]);
  const pos = parseFloat(m[3]);
  if (!isFinite(totale) || !isFinite(pos)) return null;
  return { prefix: m[1].trim(), totale, pos, cash: totale - pos };
}
// ─── Depositi in banca ───
// Un deposito esce dalla cassa come un'uscita, ma non e' una spesa: i soldi
// sono ancora nostri, solo in banca. Va riconosciuto ovunque si sommino le
// uscite, altrimenti gonfia le spese e affossa il netto.
// Le voci nuove portano il contrassegno `dep`; quelle vecchie e quelle
// arrivate da un import si riconoscono dalla descrizione, nelle due lingue.
const DEPOSITO_LABELS = ['Deposito in banca', '\u94f6\u884c\u5b58\u6b3e', 'Deposito', '\u5b58\u6b3e'];

// { nota } se la descrizione e' un deposito, altrimenti null.
export function parseDeposito(desc) {
  const s = String(desc || '').trim();
  for (const etichetta of DEPOSITO_LABELS) {
    if (s === etichetta) return { nota: '' };
    if (s.startsWith(etichetta + ' (') && s.endsWith(')')) {
      return { nota: s.slice(etichetta.length + 2, -1) };
    }
  }
  return null;
}

// Una riga del registro e' un deposito solo se toglie soldi dalla cassa: cosi'
// un'entrata che per caso si chiamasse "Deposito" non sparisce dalle uscite.
export function isDeposito(l) {
  if (!l || l.a >= 0) return false;
  return l.dep === true || parseDeposito(l.v) !== null;
}

const repayPatterns = [
  /^Rimborso anticipo:\s*(.+)$/,
  /^归还借支:\s*(.+)$/,
];

export function translateLogDesc(desc) {
  if (!desc) return desc;

  // Deposito in banca, con l'eventuale nota fra parentesi.
  const dep = parseDeposito(desc);
  if (dep) return t('dep.log') + (dep.nota ? ' (' + dep.nota + ')' : '');

  // Incasso: si riscrive nella lingua e nelle etichette correnti.
  const inc = parseIncasso(desc);
  if (inc) {
    const prefix = inc.prefix ? inc.prefix + ' ' : '';
    return prefix + t('fatt.incassoCash') + ' (' + t('incassi.totaleLabel') + ':' + inc.totale + ' POS:' + inc.pos + ')';
  }

  // Match anticipi repay: "Rimborso anticipo: NAME"
  for (const re of repayPatterns) {
    const m = desc.match(re);
    if (m) return t('ant.logRepay') + ': ' + m[1];
  }

  // Match expense entries: "TYPE: NAME (note)" or "TYPE: NAME"
  const colonIdx = desc.indexOf(': ');
  if (colonIdx > 0) {
    const rawType = desc.substring(0, colonIdx);
    const rest = desc.substring(colonIdx + 2);
    for (const tk of typeKeys) {
      if (rawType === tk.itVal || rawType === tk.zhVal) {
        return t(tk.key) + ': ' + rest;
      }
    }
  }

  // Voci che sono solo la tipologia, senza nome dopo i due punti: un reso al
  // cliente si registra spesso cosi', e restava non tradotto.
  for (const tk of typeKeys) {
    if (desc === tk.itVal || desc === tk.zhVal) return t(tk.key);
  }

  return desc;
}

let currentLang = localStorage.getItem('cassa_lang') || 'it';

export function t(key, params) {
  let text = translations[currentLang]?.[key] || translations.it[key] || key;
  if (params) {
    Object.keys(params).forEach(k => {
      text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
    });
  }
  return text;
}

export function getLang() { return currentLang; }

export function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('cassa_lang', lang);
  applyLanguage();
}

export function applyLanguage() {
  // Update textContent for data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.placeholder = t(key);
  });
  // Update title attributes
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.title = t(key);
  });
  // I comandi a sola icona (cerca, rubriche, impostazioni, frecce del giorno)
  // non hanno testo: senza questo, chi usa VoiceOver sente solo "pulsante".
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    if (key) el.setAttribute('aria-label', t(key));
  });
  // Update lang toggle buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
}
