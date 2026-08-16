import type { Result } from '../result'

/** A document chosen by the user for import. */
export interface PickedDocument {
  /** The file's name, shown back to the user when reporting a problem with it. */
  readonly name: string
  /** Raw UTF-8 contents, unparsed and untrusted. */
  readonly contents: string
}

/**
 * Moves data between the app and the user's own files.
 *
 * This is the entire backup story for the release: with device-only storage and no
 * account (FR-041), export and import are how a fund survives a reinstall or a move to a
 * new phone (FR-044, FR-045).
 */
export interface FileGateway {
  /**
   * Writes the document and hands it to the OS share sheet.
   *
   * @param fileName Suggested name, e.g. `emergency-fund-2026-08-16.json`.
   * @param contents The serialized export document.
   */
  exportDocument(fileName: string, contents: string): Promise<Result<void>>

  /**
   * Opens the system document picker.
   *
   * @returns The chosen file, or a `cancelled` failure when the user backs out — which
   *   is not an error to report, since nothing changed.
   */
  pickDocument(): Promise<Result<PickedDocument>>
}
