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

  /** Setup: the two steps that size the fund (FR-001 through FR-005), then what it starts with. */
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
    /** Step three asks what was saved before the app was (FR-010). */
    openingTitle: 'O que você já guardou',
    openingIntro:
      'Se você já tem dinheiro separado para emergências, informe quanto. Ele conta para a meta desde o primeiro dia.',
    openingLabel: 'Saldo inicial',
    openingHelp: 'Só o que está reservado para emergências.',
    /**
     * The way past the step. It says what skipping means rather than "Pular": the user is
     * answering the question the screen asked, not declining to.
     */
    openingSkip: 'Ainda não guardei nada',
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
    /**
     * What the new target does to progress (FR-006). In words rather than with an arrow,
     * which a screen reader would read as a symbol or skip.
     *
     * @param from The formatted percentage against the stored target.
     * @param to The formatted percentage against the new one.
     * @returns The line shown under the change in target.
     */
    progressChange: (from: string, to: string): string => `Seu progresso vai de ${from} para ${to}`,
    /**
     * For a change that leaves the percentage where it was — a fund with nothing in it, or
     * one already past both targets. "De 100% para 100%" would read as a change.
     *
     * @param percent The formatted percentage, the same against either target.
     * @returns The line shown under the change in target.
     */
    progressUnchanged: (percent: string): string => `Seu progresso continua em ${percent}`,
    /** When the balance cannot be read. Never a percentage computed from nothing. */
    progressUnavailable: 'Não foi possível calcular o efeito no seu progresso.',
  },

  /**
   * Recording money moving into or out of the fund (FR-008 through FR-011).
   *
   * "Contribuição" throughout, never "depósito" — the ui-contract's rule that one concept
   * keeps one word wherever it appears.
   */
  entries: {
    contributeTitle: 'Nova contribuição',
    amountLabel: 'Valor',
    amountHelp: 'Quanto você está guardando agora.',
    noteLabel: 'Observação (opcional)',
    noteHelp: 'Para lembrar de onde veio, se quiser.',
    /** The date group. Most contributions are today, so today is where it opens. */
    dateLabel: 'Data',
    today: 'Hoje',
    yesterday: 'Ontem',
    otherDate: 'Outra data',
    otherDateExplanation: 'Para registrar uma contribuição de outro dia.',
    /** The history (FR-014). */
    historyTitle: 'Histórico',
    historyEmptyTitle: 'Nada registrado ainda',
    historyEmptyBody:
      'Cada contribuição que você registrar aparece aqui, da mais recente à mais antiga.',
    /**
     * Above the history, saying what a row does when pressed. The same thing `rowHint`
     * tells a screen reader, said once for the eye, which has no other way to learn it.
     */
    historyHint: 'Toque em um registro para corrigir ou excluir.',
    /** What a screen reader says a row in the history does when it is pressed. */
    rowHint: 'Abre o registro para corrigir ou excluir.',
    /**
     * Drawn at the end of every row, so a row looks like something that opens. Kept from
     * a screen reader, which is told by `rowHint`.
     */
    rowOpens: '›',
    /**
     * Above the history when entries are dated after today (FR-033).
     *
     * The app refuses such a date at entry, so these came from an imported file or from a
     * device clock that was ahead. They are left out of the balance until the day arrives,
     * and the copy says so: a balance missing money the user remembers saving reads as a
     * bug unless something explains it. It says where they are, too. The history is the
     * most recent first, so a future-dated entry is always at the top.
     */
    futureDated: {
      title: (count: number): string =>
        count === 1 ? 'Um registro com data no futuro' : `${count} registros com data no futuro`,
      body: (count: number): string =>
        count === 1
          ? 'Ele fica fora do saldo até essa data chegar. Se a data estiver errada, toque nele, no topo da lista, para corrigir.'
          : 'Eles ficam fora do saldo até essas datas chegarem. Se alguma estiver errada, toque no registro, no topo da lista, para corrigir.',
      /** When the check itself cannot be made. Silence would read as "none". */
      unavailable: 'Não foi possível verificar se há registros com data no futuro.',
    },
    /**
     * What a screen reader hears once an entry is recorded, corrected, or deleted: the
     * figure a sighted user sees change on Home. "Atualizado" rather than "salvo", because
     * a deletion moves the balance too.
     */
    balanceAnnounced: (amount: string): string => `Saldo atualizado: ${amount}`,
    /** Correcting or deleting an entry already recorded (FR-011). */
    editTitle: 'Corrigir registro',
    deleteAction: 'Excluir registro',
    /**
     * The question the confirmation asks, and what answering yes costs.
     *
     * Says the balance is recalculated rather than which way it moves: deleting a
     * contribution lowers it and deleting a withdrawal raises it, and one sentence has to
     * be true of both.
     */
    deleteTitle: 'Excluir este registro?',
    deleteBody: 'Ele sai do histórico e o saldo é recalculado sem ele. Não é possível desfazer.',
    /** An entry the screen was asked for and the ledger does not have. */
    missingTitle: 'Registro não encontrado',
    missingBody: 'Ele pode ter sido excluído. Volte ao histórico para ver o que está registrado.',
    /**
     * What each kind of entry is called, how it is marked, and how its amount is written.
     *
     * Three signals that do not depend on colour, because FR-014 asks for the kinds to be
     * told apart and FR-049 forbids colour from being the only way: a word, a mark beside
     * it, and a sign on the amount. The withdrawal's is a true minus (U+2212) rather than
     * a hyphen — it is as wide as the plus, so signed amounts stay aligned down a column,
     * and a screen reader says "menos" where it would skip a hyphen. An opening balance
     * carries no sign: it was not a movement, it is where the fund started.
     *
     * Keyed by `EntryType`, so a row renders whatever the domain records.
     */
    kinds: {
      opening: {
        label: 'Saldo inicial',
        mark: '=',
        /**
         * @param amount The formatted amount.
         * @returns The amount as the row shows it.
         */
        amount: (amount: string): string => amount,
      },
      contribution: {
        label: 'Contribuição',
        mark: '+',
        /**
         * @param amount The formatted amount.
         * @returns The amount as the row shows it.
         */
        amount: (amount: string): string => `+ ${amount}`,
      },
      withdrawal: {
        label: 'Retirada',
        mark: '−',
        /**
         * @param amount The formatted amount.
         * @returns The amount as the row shows it.
         */
        amount: (amount: string): string => `− ${amount}`,
      },
    },
  },

  /**
   * Recording money taken out of the fund (FR-016, FR-017).
   *
   * "Retirada" throughout, the word the history already uses, and never a word for failure:
   * taking money out is what an emergency fund is for, and the copy says so by saying
   * nothing about it either way.
   */
  withdrawal: {
    title: 'Registrar retirada',
    amountHelp: 'Quanto saiu da reserva.',
    otherDateExplanation: 'Para registrar uma retirada de outro dia.',
    reasonLabel: 'Motivo',
    /**
     * The predefined reasons, keyed as the domain stores them, so the screen offers
     * whatever `WITHDRAWAL_REASONS` holds. Each says what it covers, so a reader can tell
     * which one describes them.
     */
    reasons: {
      medical: { label: 'Saúde', description: 'Consultas, exames, remédios ou internação.' },
      'car-repair': { label: 'Conserto do carro', description: 'Mecânico, peças ou guincho.' },
      'home-repair': {
        label: 'Reparo em casa',
        description: 'Um vazamento, a parte elétrica, um eletrodoméstico que quebrou.',
      },
      'income-loss': {
        label: 'Perda de renda',
        description: 'Desemprego, ou uma queda no que você recebe.',
      },
      family: { label: 'Ajuda à família', description: 'Uma emergência de alguém próximo.' },
    },
    otherReason: 'Outro motivo',
    otherReasonDescription: 'Para descrever com as suas palavras.',
    otherReasonLabel: 'Descreva o motivo',
    /** The save button. The verb, as the title says it, rather than "Salvar". */
    saveAction: 'Registrar retirada',
    /** When the withdrawal is more than the fund holds (FR-017). */
    overBalanceTitle: 'A retirada é maior que o saldo',
    /**
     * What recording it means, in figures, so the user can tell a typo from what happened.
     * How far below zero rather than a signed balance: the formatter writes a negative as
     * "-R$", which is easy to miss.
     *
     * @param balance The formatted balance.
     * @param belowZero How far below zero the withdrawal would leave it, formatted, unsigned.
     * @returns The sheet's body.
     */
    overBalanceBody: (balance: string, belowZero: string): string =>
      `Seu saldo é de ${balance}. Com esta retirada, ele fica ${belowZero} abaixo de zero. Registre assim se o valor estiver certo.`,
    overBalanceConfirm: 'Registrar mesmo assim',
  },

  /**
   * What a withdrawal left to restore, on Home (FR-018).
   *
   * Said as something to restore, at the user's own pace, rather than as a loss. "Recompor",
   * never "déficit" or "prejuízo".
   */
  recovery: {
    label: 'A recompor',
    explanation: 'O que falta para o saldo voltar ao valor mais alto que já teve, até a meta.',
    /**
     * When the fund will be back, and the pace that says so — never a date without it.
     *
     * @param pace The formatted contribution pace per month.
     * @param paceMonths The complete months it was measured over, three to six.
     * @param months Whole months until the shortfall is restored, at least one.
     * @param month The month it will be, formatted.
     * @returns The estimate.
     */
    estimate: (pace: string, paceMonths: number, months: number, month: string): string =>
      `No ritmo das suas contribuições nos últimos ${paceMonths} meses completos, ${pace} por mês, isso leva ${
        months === 1 ? '1 mês' : `${months} meses`
      }: até ${month}.`,
    /**
     * Too little history for a pace (FR-029, as on the forecast).
     *
     * @param needed Complete months still to come, at least one.
     * @returns The sentence in place of the estimate.
     */
    insufficient: (needed: number): string =>
      needed === 1
        ? 'Falta 1 mês completo de histórico para estimar quanto tempo isso leva.'
        : `Faltam ${needed} meses completos de histórico para estimar quanto tempo isso leva.`,
    /** No contribution in the window, so no pace and no date (FR-030, as on the forecast). */
    noPace:
      'Nos últimos meses completos não houve contribuição, então não há como estimar quanto tempo isso leva. Uma nova contribuição retoma a estimativa.',
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
    /** Where the fund stands (FR-013, FR-015). */
    balanceLabel: 'Saldo',
    /**
     * How far along the fund is.
     *
     * @param percent The formatted percentage, `%` included.
     * @returns The line under the balance.
     */
    progress: (percent: string): string => `${percent} da meta`,
    /**
     * What is still to be saved. Never shown once the goal is reached — FR-015.
     *
     * @param amount The formatted amount.
     * @returns The line under the balance.
     */
    remaining: (amount: string): string => `Faltam ${amount}`,
    reached: 'Meta alcançada',
    /**
     * How far the balance has passed the target. Not shown at exactly the target, where it
     * would be a sentence about nothing.
     *
     * @param amount The formatted surplus.
     * @returns The line under "Meta alcançada".
     */
    surplus: (amount: string): string => `${amount} além da meta`,
    /** The way to the contribute screen. The same words as its title, deliberately. */
    contributeAction: 'Nova contribuição',
    /** The way to the withdraw screen (FR-016). The same words as its title. */
    withdrawAction: 'Registrar retirada',
    /** The way to the history (FR-014). */
    historyAction: 'Ver histórico',
    /**
     * Under the coverage meter: how many months the balance covers, and of how many. Both
     * numbers, because the meter is hidden from a screen reader and a filled count without
     * its total is not something a reader can place.
     *
     * @param covered Whole months covered, already capped at the plan.
     * @param planned The formatted duration of the plan.
     * @returns The caption.
     */
    coverage: (covered: number, planned: string): string =>
      `Seu saldo cobre ${covered} de ${planned}`,
  },

  /**
   * A milestone crossed by a save (FR-024), on the screen the user lands on and through the
   * screen reader after the balance.
   *
   * The 100% case has words of its own. "Você chegou a 100% da sua meta" is true, but it is
   * the moment the fund is complete, and Home says so in the same words.
   */
  milestones: {
    /**
     * @param threshold The milestone crossed.
     * @param percent The same threshold, formatted.
     * @returns The banner's title, which is also what is announced.
     */
    title: (threshold: number, percent: string): string =>
      threshold === 100 ? 'Você alcançou sua meta' : `Você chegou a ${percent} da sua meta`,
    /**
     * @param threshold The milestone crossed.
     * @returns The line under the title.
     */
    body: (threshold: number): string =>
      threshold === 100
        ? 'Sua reserva de emergência está completa. O que você guardar daqui em diante é folga.'
        : 'Cada contribuição deixa você mais perto da reserva completa.',
    dismiss: 'Fechar',
  },

  /**
   * The statistics view (FR-020 – FR-025).
   *
   * Every figure is written out with its label rather than drawn: this release has no
   * charts (research D-011, amended), so the words are the whole of what the screen says.
   */
  statistics: {
    title: 'Estatísticas',
    /** The way in, from Home. */
    action: 'Ver estatísticas',
    periodLabel: 'Período',
    /** The filter's options (FR-023). Keyed so the screen offers whatever the domain does. */
    allTime: 'Desde o início',
    /**
     * @param months How many complete months.
     * @returns The option's name.
     */
    recent: (months: number): string => `Últimos ${months} meses`,
    /**
     * What a period covers, said in months so "last 3 months" cannot be misread as the
     * last ninety days. A recent period is complete months only, and this is where the
     * user can see that the month in progress is not in it.
     *
     * @param from The first month, formatted.
     * @param to The last month, formatted.
     * @returns The line under the option, and above the figures.
     */
    covers: (from: string, to: string): string => (from === to ? from : `De ${from} a ${to}`),
    /** Under a filter option whose period has no complete month yet. */
    periodNoMonths: 'Ainda sem um mês completo',
    /** In place of the figures, for a recent period with no complete month yet. */
    periodEmpty:
      'Ainda não há um mês completo neste período. Ele passa a contar quando o primeiro mês do seu histórico terminar.',
    /** Before the first contribution (FR-025): what will be here, and what makes it appear. */
    emptyTitle: 'Suas estatísticas começam na primeira contribuição',
    emptyBody:
      'Aqui você vai ver quanto já guardou, sua média por mês, há quantos meses contribui sem falhar e como o saldo cresceu mês a mês.',
    /** The totals (FR-020). */
    totalsHeading: 'Movimentação',
    totalContributed: 'Total contribuído',
    totalWithdrawn: 'Total retirado',
    /** Contributed less withdrawn — what the period added to the fund by the user's hand. */
    netSaved: 'Guardado no período',
    contributionCount: 'Contribuições',
    largestContribution: 'Maior contribuição',
    noContribution: 'Nenhuma contribuição neste período.',
    averageContribution: 'Média por mês',
    /**
     * What the average divides by, so the figure can be checked.
     *
     * @param months Complete months in the period.
     * @returns The caption under the average.
     */
    averageBasis: (months: number): string =>
      months === 1 ? 'Em 1 mês completo' : `Em ${months} meses completos`,
    averageUnavailable: 'A média aparece quando o primeiro mês do seu histórico terminar.',
    /** The streaks (FR-021). */
    streaksHeading: 'Constância',
    streaksHelp: 'Meses seguidos com pelo menos uma contribuição.',
    currentStreak: 'Sequência atual',
    longestStreak: 'Maior sequência',
    /**
     * @param months The length of a streak.
     * @returns The streak as text, agreeing in number.
     */
    streak: (months: number): string =>
      months === 0 ? 'Nenhum mês' : months === 1 ? '1 mês' : `${months} meses`,
    /** Month by month (FR-019, FR-022): the flows, and where the balance closed. */
    breakdownHeading: 'Mês a mês',
    contributed: 'Contribuído',
    withdrawn: 'Retirado',
    closingBalance: 'Saldo no fim do mês',
    /** The month in progress has not closed, so its balance is today's. */
    balanceSoFar: 'Saldo até hoje',
    /**
     * A month of the breakdown as a screen reader hears it: one sentence, in the order the
     * row is laid out.
     *
     * @param month The month, formatted.
     * @param contributed What went in, formatted.
     * @param withdrawn What went out, formatted.
     * @param balance Where the balance closed, formatted.
     * @param inProgress Whether the month is still running, so the balance is today's.
     * @returns The row's accessible name.
     */
    monthSummary: (
      month: string,
      contributed: string,
      withdrawn: string,
      balance: string,
      inProgress: boolean,
    ): string =>
      inProgress
        ? `${month}, até hoje: contribuído ${contributed}, retirado ${withdrawn}, saldo ${balance}`
        : `${month}: contribuído ${contributed}, retirado ${withdrawn}, saldo no fim do mês ${balance}`,
  },

  /**
   * The forecast (FR-026 – FR-032).
   *
   * The pace is always stated beside the date it produces (FR-028): a date the user cannot
   * trace back to what they save each month is a number they cannot evaluate. "Ritmo",
   * never "taxa" — one word per concept, as the ui-contract asks.
   */
  forecast: {
    title: 'Previsão',
    /** The way in, from Home. */
    action: 'Ver previsão',
    /** Above the projected date (FR-027). */
    projectedLabel: 'Você deve alcançar a meta em',
    /**
     * How far away the projected date is, in months (FR-027).
     *
     * @param months Whole months, at least one.
     * @returns The line under the date.
     */
    monthsAway: (months: number): string =>
      months === 1 ? 'Daqui a 1 mês' : `Daqui a ${months} meses`,
    /**
     * The assumption the date rests on (FR-028), with what the pace was measured over.
     *
     * @param pace The formatted pace per month.
     * @param months How many complete months it was measured over — three to six.
     * @returns The sentence under the date.
     */
    assumption: (pace: string, months: number): string =>
      `Supondo que você continue guardando ${pace} por mês, a sua média nos últimos ${months} meses completos.`,
    /** Too little history for a pace (FR-029). */
    insufficientTitle: 'Ainda é cedo para uma previsão',
    /**
     * How much more history the forecast needs.
     *
     * @param needed Complete months still to come, at least one.
     * @returns The sentence that leads the card.
     */
    insufficientBody: (needed: number): string =>
      needed === 1
        ? 'Falta 1 mês completo de histórico para calcular o seu ritmo.'
        : `Faltam ${needed} meses completos de histórico para calcular o seu ritmo.`,
    /**
     * Why the history is needed, and how much there is.
     *
     * @param minimum The months the pace needs.
     * @param available Complete months so far, possibly none.
     * @returns The explanation under it.
     */
    insufficientHelp: (minimum: number, available: number): string =>
      `A previsão parte da média que você guarda por mês e precisa de pelo menos ${minimum} meses completos. ${
        available === 0
          ? 'Ainda não há nenhum.'
          : available === 1
            ? 'Até agora há 1.'
            : `Até agora há ${available}.`
      }`,
    /** A pace of zero or less (FR-030): why there is no date, and what brings one back. */
    noPaceTitle: 'Não há como prever uma data',
    noPaceBody:
      'Nos últimos meses completos, o que você retirou igualou ou superou o que contribuiu. Nesse ritmo a meta não chega, então não há data a mostrar. Uma nova contribuição retoma a previsão.',
    /** Nothing left to save. */
    reachedBody: 'Sua reserva já chegou à meta, então não há data a prever.',
    /** The desired completion date (FR-031), read back on the forecast and the goal screen. */
    desiredHeading: 'Data desejada',
    /**
     * @param month The desired month, formatted.
     * @returns The line naming it.
     */
    desiredTarget: (month: string): string => `Concluir até ${month}`,
    /**
     * @param amount The formatted contribution per month.
     * @returns The required contribution.
     */
    desiredRequired: (amount: string): string => `Para chegar lá: ${amount} por mês`,
    /**
     * @param pace The formatted pace per month.
     * @returns The comparison, when the required amount is more.
     */
    desiredExceeds: (pace: string): string => `Acima do seu ritmo de ${pace} por mês`,
    /** The comparison against a pace of zero or less, which is not worth quoting as money. */
    desiredExceedsNoPace: 'Acima do seu ritmo, que nos últimos meses completos não passou de zero',
    /**
     * @param pace The formatted pace per month.
     * @returns The comparison, when the pace already covers it.
     */
    desiredWithin: (pace: string): string => `Dentro do seu ritmo de ${pace} por mês`,
    desiredUnmeasured: 'Ainda não há histórico suficiente para comparar com o seu ritmo.',
    desiredCovered: 'Seu saldo já cobre esta meta.',
    desiredPassed: 'Essa data já passou. Escolha outra para ver quanto guardar por mês.',
    /** When the ledger cannot be read. Never an amount computed from nothing. */
    desiredUnavailable: 'Não foi possível calcular quanto guardar por mês.',
    /** The way to the goal screen, where the date is set. */
    desiredSetAction: 'Definir data desejada',
    desiredChangeAction: 'Alterar data desejada',
  },

  /**
   * Choosing the desired completion date on the goal screen (FR-031).
   *
   * A month rather than a day: the required contribution counts whole months, and a date is
   * reached "by the end of" its month, so the day would be a choice that changes nothing.
   * The buttons say in words which way they move, because "−1" is read aloud as a symbol.
   */
  desiredDate: {
    label: 'Data desejada',
    help: 'Opcional. Diga até quando quer completar a reserva e veja quanto guardar por mês.',
    none: 'Nenhuma data definida.',
    add: 'Definir uma data',
    remove: 'Remover a data',
    previousYear: 'Ano anterior',
    previousMonth: 'Mês anterior',
    nextMonth: 'Próximo mês',
    nextYear: 'Próximo ano',
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
    entryAmountMustBePositive: 'Informe um valor maior que zero.',
    entryDateInFuture: 'A data não pode ser no futuro.',
    entryNoteTooLong: 'A observação ficou longa demais.',
    entryOpeningAlreadyExists: 'Você já registrou um saldo inicial.',
    entryReasonRequired: 'Escolha um motivo ou escreva o seu.',
    entryReasonTooLong: 'O motivo ficou longo demais.',
    /** Only an import or a bug could reach this: no form offers a reason for anything else. */
    entryReasonNotAllowed: 'Só uma retirada tem motivo.',
    desiredDateNotAhead: 'Escolha uma data depois de hoje.',
    /** For a key no screen knows about — an older stored value, or a new rule. */
    unknown: 'Confira este valor.',
  },

  /** The states any data-backed view can be in, before its own content has anything to say. */
  /**
   * The development-only seed screen (T087). Read by whoever ran `npm run seed`, never by a
   * user, so the problems name the flags to fix.
   */
  dev: {
    seedTitle: 'Dados de exemplo',
    seeding: 'Gerando o histórico de exemplo…',
    seedFailed: 'Não foi possível gerar os dados. O motivo está no log do Metro.',
    seedProblems: {
      'months-missing': 'Diga quantos meses gerar, como em --months 8, ou use --reset sozinho.',
      'months-out-of-range': 'Os meses vão de 1 a 120, em número inteiro.',
      'pattern-unknown': 'O padrão é steady ou erratic.',
    },
  },

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
