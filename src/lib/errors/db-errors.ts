export type DbErrorCode = 'sequence_missing' | 'odometer_continuity' | 'no_simulation_config' | 'db_error'

export interface DbError {
  code: DbErrorCode
  message: string
  hint: string
}

export function interpretDbError(raw: string): DbError {
  if (raw.includes('Brak sekwencji wpisow')) {
    return { code: 'sequence_missing', message: 'Pojazd nie jest jeszcze zainicjalizowany.', hint: 'Pojazd nie ma jeszcze zadnego wpisu i wymaga inicjalizacji przez administratora. Skontaktuj sie z administratorem lub dodaj pierwszy wpis recznie w sekcji Ewidencja.' }
  }
  if (raw.toLowerCase().includes('odometer') || raw.toLowerCase().includes('continuity') || raw.includes('licznik')) {
    return { code: 'odometer_continuity', message: 'Blad ciaglosci licznika.', hint: 'Stan licznika przed wyjazdem nie zgadza sie z ostatnim wpisem dla tego pojazdu. Sprawdz aktualny stan licznika w sekcji Ewidencja.' }
  }
  return { code: 'db_error', message: raw, hint: '' }
}
