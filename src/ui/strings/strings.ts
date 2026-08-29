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

  /**
   * The conservativeness levels, named and explained (FR-002, FR-003).
   *
   * Keyed by `LevelKey` so the level screen renders whatever the domain offers, rather
   * than holding its own list that could fall out of step with `COVERAGE_MONTHS`. The
   * durations are not repeated here — they come from the domain, formatted at the screen.
   *
   * FR-003 asks each explanation to say *who* the level suits rather than what it is. A
   * user picking between 3 and 12 months already knows the difference is duration; what
   * they cannot tell is which one describes them.
   */
  levels: {
    lean: {
      name: 'Enxuta',
      explanation: 'Para quem tem renda estável, poucos dependentes e outras reservas à mão.',
    },
    balanced: {
      name: 'Equilibrada',
      explanation:
        'O ponto de partida mais comum: cobre a maioria das situações sem exigir anos guardando.',
    },
    cautious: {
      name: 'Cautelosa',
      explanation:
        'Para renda variável, trabalho autônomo, ou quando outras pessoas dependem de você.',
    },
    maximum: {
      name: 'Máxima',
      explanation:
        'Para renda instável, trabalho por projeto, ou para quem prefere a maior folga possível.',
    },
    custom: {
      name: 'Personalizada',
      explanation: 'Escolha a duração que faz sentido para a sua situação.',
    },
  },

  /**
   * The help text under the custom duration input.
   *
   * A template taking the bounds rather than prose naming them, so the sentence cannot
   * contradict `MINIMUM_COVERAGE_MONTHS` and `MAXIMUM_COVERAGE_MONTHS`. It sits outside
   * `levels` because it belongs to the control that enforces the range, not to the level
   * that offers it — and because every entry in `levels` has the same shape, which is what
   * lets the level screen render them by iterating.
   *
   * @param minimum The shortest permitted duration.
   * @param maximum The longest permitted duration.
   * @returns The help text for the duration input.
   */
  coverageRangeHelp: (minimum: number, maximum: number): string =>
    `Entre ${minimum} e ${maximum} meses.`,

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
