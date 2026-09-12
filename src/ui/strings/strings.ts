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
    continue: 'Continuar',
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

  /**
   * The same bounds, said as a correction rather than as guidance.
   *
   * Separate copy from {@link strings.coverageRangeHelp} because the two appear in the same
   * place at different moments: help before the user types, this after a value was
   * refused. Identical wording would leave the field looking unchanged at the moment it
   * started rejecting what is in it.
   *
   * @param minimum The shortest permitted duration.
   * @param maximum The longest permitted duration.
   * @returns The message shown when the entered duration falls outside the range.
   */
  coverageRangeError: (minimum: number, maximum: number): string =>
    `Escolha uma duração entre ${minimum} e ${maximum} meses.`,

  /**
   * A duration in months, agreeing in number.
   *
   * A function rather than a suffix a caller appends, because "1 meses" is the kind of
   * mistake that makes an app feel machine-written, and the rule that avoids it is
   * grammatical — it belongs with the language, not with the screen.
   *
   * @param count The number of months.
   * @returns The duration as text.
   */
  coverageDuration: (count: number): string => (count === 1 ? '1 mês' : `${count} meses`),

  /** The two-step flow that sizes the fund (FR-001 through FR-005). */
  onboarding: {
    /** Step one asks for the figure everything else is derived from. */
    expensesTitle: 'Seus gastos mensais',
    expensesLabel: 'Gastos essenciais por mês',
    expensesHelp: 'Moradia, alimentação, transporte, saúde e o que mais você paga todo mês.',
    /** Step two turns that figure into a target. */
    levelTitle: 'Tamanho da reserva',
    levelIntro: 'Escolha quantos meses de gastos a sua reserva deve cobrir.',
    customMonthsLabel: 'Meses de cobertura',
    /** Shown when the level step is opened without the figure step one produces. */
    missingExpenses: 'Comece informando seus gastos mensais.',
  },

  /** The target itself, wherever it is shown or changed. */
  goal: {
    targetLabel: 'Meta',
    /**
     * How the target was arrived at (FR-004).
     *
     * The multiplication is shown rather than described, because a user who disagrees with
     * the result can only tell which half to change if they can see both.
     *
     * @param monthlyExpenses The formatted monthly expenses.
     * @param coverage The formatted duration.
     * @param target The formatted result.
     * @returns The derivation as one line.
     */
    derivation: (monthlyExpenses: string, coverage: string, target: string): string =>
      `${monthlyExpenses} × ${coverage} = ${target}`,
    /**
     * The level and duration behind a stored target.
     *
     * A sentence rather than fragments joined by a separator. "Equilibrada · 6 meses" asks
     * the reader to work out what the middle dot stands for, and a screen reader announces
     * it as two unrelated phrases; saying it in words costs three characters.
     *
     * @param level The level's name.
     * @param coverage The formatted duration.
     * @returns The summary line.
     */
    levelSummary: (level: string, coverage: string): string => `${level}, ${coverage} de cobertura`,
    /** Switching between the calculated target and one the user types (FR-005). */
    overrideAction: 'Definir a meta manualmente',
    overrideLabel: 'Meta definida por você',
    calculatedAction: 'Voltar à meta calculada',
  },

  /**
   * Changing a goal that already exists (FR-006).
   *
   * Separate from `goal` because these are the words of a second visit: what is stored,
   * what it would become, and what is preserved. The reassurance about contributions is
   * part of the requirement rather than comfort — a user who believes revising the target
   * discards their history will not revise it.
   */
  revision: {
    title: 'Ajustar meta',
    intro: 'Alterar seus gastos ou a duração recalcula a meta. Suas contribuições são mantidas.',
    currentTarget: 'Meta atual',
    /**
     * How much larger the new target is.
     *
     * A sentence rather than a signed amount: the formatter renders a negative as a minus
     * sign, which reads as a debt rather than as a smaller goal, and "+" before a currency
     * amount is not how the difference between two goals is said in Portuguese.
     *
     * @param amount The formatted difference, unsigned.
     * @returns The line shown under the two targets.
     */
    increase: (amount: string): string => `Aumento de ${amount}`,
    /**
     * How much smaller the new target is.
     *
     * @param amount The formatted difference, unsigned.
     * @returns The line shown under the two targets.
     */
    decrease: (amount: string): string => `Redução de ${amount}`,
  },

  /** The first screen after launch. */
  home: {
    title: 'Sua reserva',
    /** The way to the revision screen (FR-006). */
    reviseAction: 'Ajustar meta',
    /** No goal means setup never finished, which is the only first launch the app knows. */
    emptyTitle: 'Defina sua meta',
    emptyBody: 'Informe seus gastos mensais para descobrir de quanto a sua reserva precisa.',
    emptyAction: 'Começar',
  },

  /**
   * What a rejected value means, keyed the way the domain reports it.
   *
   * Two of the entries are shared, because "not a number" is the same problem whichever
   * amount it happened to. The mapping from key to text lives in `validation-message.ts`
   * rather than here, so that the one message needing the coverage bounds can build itself
   * from them instead of restating them in prose.
   */
  validation: {
    amountNotANumber: 'Informe um valor em números.',
    expensesMustBePositive: 'Informe quanto você gasta por mês, acima de zero.',
    coverageNotAWholeNumber: 'Use meses inteiros.',
    targetMustBePositive: 'A meta precisa ser maior que zero.',
    targetDoesNotMatch: 'A meta não corresponde aos gastos e à duração escolhidos.',
    /** For a key no screen knows about — an older stored value, or a new rule. */
    unknown: 'Confira este valor.',
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
