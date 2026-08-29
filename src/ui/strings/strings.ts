/**
 * Every user-facing string in the app, keyed by identifier.
 *
 * The text is pt-BR; the identifiers and this documentation are English, like the rest of
 * the codebase. Research decision D-020: one language ships in this release and no
 * translation library comes with it. Centralising the text anyway costs nothing now and is
 * what makes adding a library later a change to this module rather than a sweep through
 * every component.
 *
 * Two rules keep that promise real:
 *   - No component contains a user-visible literal, including accessibility labels, which
 *     screen-reader users hear and which are therefore user-facing text.
 *   - Nothing here is assembled by concatenation. A sentence built from fragments cannot be
 *     reordered into another language's grammar; a value belongs in a formatter, or in a
 *     template that takes it as a parameter.
 */
export const strings = {
  /** Verbs on buttons, reused across screens so the same action always reads the same way. */
  action: {
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    save: 'Salvar',
    delete: 'Excluir',
    retry: 'Tentar novamente',
  },

  /** The states any data-backed view can be in, before its own content has anything to say. */
  state: {
    loading: 'Carregando',
    errorTitle: 'Algo deu errado',
    errorBody: 'Não foi possível carregar essas informações.',
  },

  /**
   * Text a screen reader announces but the screen does not show. It is as user-facing as
   * anything visible, and lives here for the same reason.
   */
  accessibility: {
    /**
     * The accessible name of a required field.
     *
     * A template taking the label rather than a bare 'obrigatório' the caller appends: the
     * marker's position is part of the language, and a concatenation would fix it in
     * Portuguese order. An asterisk alone would not be announced at all.
     *
     * @param label The field's visible label.
     * @returns The name a screen reader announces for the input.
     */
    requiredFieldName: (label: string): string => `${label}, obrigatório`,
  },
} as const
