import { BadRequestException, Injectable } from '@nestjs/common';
import { CurrencyCode } from '../budgets/currency-code';
import {
  ParseResultDto,
  ParserCategory,
  ParserMissingField,
} from './dto/parse-result.dto';
import type { ParseBatchResultDto } from './dto/parse-batch-result.dto';

const CATEGORY_TOKENS: Readonly<Record<ParserCategory, readonly string[]>> = {
  'Food & Dining': [
    'breakfast',
    'lunch',
    'dinner',
    'brunch',
    'coffee',
    'cafe',
    'restaurant',
    'bar',
    'pub',
    'food',
    'meal',
    'snack',
    'snacks',
    'sweet',
    'sweets',
    'groceries',
    'grocery',
    'swiggy',
    'zomato',
    'zepto',
  ],
  Transportation: [
    'transport',
    'travel',
    'traveling',
    'travelling',
    'trip',
    'uber',
    'ola',
    'rapido',
    'taxi',
    'cab',
    'auto',
    'metro',
    'bus',
    'train',
    'flight',
    'fuel',
    'petrol',
    'diesel',
    'parking',
    'toll',
  ],
  Shopping: [
    'shopping',
    'amazon',
    'flipkart',
    'myntra',
    'clothes',
    'clothing',
    'apparel',
    'shoes',
    'mall',
    'purchase',
  ],
  Entertainment: [
    'entertainment',
    'movie',
    'movies',
    'cinema',
    'netflix',
    'spotify',
    'concert',
    'gaming',
    'game',
    'bookmyshow',
    'theatre',
  ],
  'Bills & Utilities': [
    'bill',
    'bills',
    'electricity',
    'water bill',
    'gas bill',
    'internet',
    'wifi',
    'broadband',
    'recharge',
    'utility',
    'utilities',
    'rent',
  ],
  'Health & Personal Care': [
    'health',
    'doctor',
    'hospital',
    'medicine',
    'medicines',
    'pharmacy',
    'medical',
    'dentist',
    'gym',
    'salon',
    'spa',
    'personal care',
  ],
  Income: [
    'income',
    'salary',
    'paycheck',
    'freelance',
    'refund',
    'bonus',
    'interest',
    'credited',
    'received payment',
  ],
  Other: ['other', 'misc', 'miscellaneous'],
};

const KNOWN_MERCHANTS: Readonly<Record<string, string>> = {
  swiggy: 'Swiggy',
  zomato: 'Zomato',
  zepto: 'Zepto',
  uber: 'Uber',
  ola: 'Ola',
  rapido: 'Rapido',
  amazon: 'Amazon',
  flipkart: 'Flipkart',
  myntra: 'Myntra',
  netflix: 'Netflix',
  spotify: 'Spotify',
  bookmyshow: 'BookMyShow',
};

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const TRANSACTION_VERB_PATTERN =
  '(?:spent|spnet|spnt|spend|paid|received|earned|debited|credited)';

const AMOUNT_CONTINUATION_PATTERN =
  '(?:(?:₹|rs\\.?|inr|us\\$|\\$|usd|€|eur)\\s*)?' +
  '\\d[\\d,]*(?:\\.\\d{1,2})?' +
  '(?:\\s*(?:inr|usd|eur|rupees?|dollars?|euros?))?' +
  '\\s+(?:on|for|at|to|from)\\b';

const COMMON_TOKEN_CORRECTIONS: Readonly<Record<string, string>> = {
  spnet: 'spent',
  spnt: 'spent',
  spend: 'spent',
  petorl: 'petrol',
  petrrol: 'petrol',
  petral: 'petrol',
  moveis: 'movies',
  movis: 'movies',
  moovies: 'movies',
  yestarday: 'yesterday',
  yestday: 'yesterday',
  ystrday: 'yesterday',
  todya: 'today',
  tody: 'today',
  swigy: 'swiggy',
  sweest: 'sweets',
};

type AmountParse = {
  total: number | null;
  currency: CurrencyCode | null;
  ambiguous: boolean;
};

type CurrencyAmount = {
  value: number;
  currency: CurrencyCode;
};

@Injectable()
export class ParserService {
  parseBatch(
    rawText: string,
    referenceDate = new Date(),
    timeZone?: string,
  ): ParseBatchResultDto {
    const resolvedTimeZone = this.validateTimeZone(timeZone);
    const clauses = this.splitTransactionClauses(rawText);
    const sharedDate = this.extractDate(
      this.normalizeCommonTypos(rawText).replace(/\s+/g, ' '),
      referenceDate,
      resolvedTimeZone,
    );
    let inheritedVerb: string | null = null;
    const drafts = clauses.map((clause) => {
      const explicitVerb = this.extractTransactionVerb(clause);
      if (explicitVerb) inheritedVerb = explicitVerb;
      const shorthand =
        !explicitVerb && this.startsWithAmountContinuation(clause);
      const result = this.parse(
        shorthand && inheritedVerb ? `${inheritedVerb} ${clause}` : clause,
        referenceDate,
        resolvedTimeZone,
      );
      result.draft.notes = clause;
      if (result.draft.date === null && sharedDate) {
        result.draft.date = sharedDate;
        result.missingFields = result.missingFields.filter(
          (field) => field !== 'date',
        );
        result.status = result.missingFields.length
          ? 'NEEDS_CLARIFICATION'
          : 'READY';
        result.clarificationPrompt = result.missingFields.length
          ? this.buildClarificationPrompt(result.missingFields)
          : undefined;
      }
      return result;
    });
    const status = drafts.every((draft) => draft.status === 'READY')
      ? 'READY'
      : 'NEEDS_CLARIFICATION';
    const missingFields = [
      ...new Set(drafts.flatMap((draft) => draft.missingFields)),
    ];

    const hasUnclearBoundaries =
      clauses.length === 1 &&
      this.extractAmount(this.normalizeCommonTypos(rawText)).ambiguous;

    return {
      status,
      drafts,
      clarificationPrompt:
        status === 'NEEDS_CLARIFICATION'
          ? hasUnclearBoundaries
            ? 'I found several possible transaction amounts but could not separate them safely. Add “and”, commas, or repeat “spent” between transactions.'
            : `${drafts.filter((draft) => draft.status !== 'READY').length} of ${drafts.length} transaction drafts need attention. ${this.buildClarificationPrompt(missingFields)}`
          : undefined,
    };
  }

  parse(
    rawText: string,
    referenceDate = new Date(),
    timeZone?: string,
  ): ParseResultDto {
    const resolvedTimeZone = this.validateTimeZone(timeZone);
    const notes = rawText.trim();
    const text = this.normalizeCommonTypos(notes).replace(/\s+/g, ' ');
    const amountParse = this.extractAmount(text);
    const splitFactor = this.extractSplitFactor(text);
    const splitNeedsClarification = this.hasAmbiguousSharedExpense(
      text,
      splitFactor,
    );
    const date = this.extractDate(text, referenceDate, resolvedTimeZone);
    const category = this.extractCategory(text);
    const merchant = this.extractMerchant(text);

    const amount =
      amountParse.total === null
        ? null
        : this.roundMoney(amountParse.total / splitFactor);

    const missingFields: ParserMissingField[] = [];
    if (date === null) missingFields.push('date');
    if (amount === null || amountParse.ambiguous) missingFields.push('amount');
    if (category === null) missingFields.push('category');
    if (splitNeedsClarification) missingFields.push('split');

    const result: ParseResultDto = {
      status: missingFields.length === 0 ? 'READY' : 'NEEDS_CLARIFICATION',
      draft: {
        amount: amountParse.ambiguous ? null : amount,
        currency: amountParse.ambiguous ? null : amountParse.currency,
        category,
        merchant,
        date,
        notes,
      },
      missingFields,
    };

    if (
      amountParse.total !== null &&
      !amountParse.ambiguous &&
      splitFactor > 1
    ) {
      result.draft.originalAmount = amountParse.total;
      result.draft.splitFactor = splitFactor;
    }

    if (missingFields.length > 0) {
      result.clarificationPrompt = this.buildClarificationPrompt(missingFields);
    }

    return result;
  }

  private splitTransactionClauses(rawText: string): string[] {
    const normalized = rawText.trim().replace(/\s+/g, ' ');
    const separator = new RegExp(
      `\\s*(?:;|,(?!\\d)|\\band\\b)\\s*(?=(?:(?:i\\s+)?${TRANSACTION_VERB_PATTERN}\\b|${AMOUNT_CONTINUATION_PATTERN}))`,
      'gi',
    );
    const clauses = normalized
      .split(separator)
      .map((clause) => clause.trim().replace(/^and\s+/i, ''))
      .filter(Boolean)
      .flatMap((clause) => this.splitAtRepeatedTransactionVerbs(clause));
    return clauses.length ? clauses : [normalized];
  }

  private splitAtRepeatedTransactionVerbs(clause: string): string[] {
    const verbPattern = new RegExp(
      `\\b(?:i\\s+)?${TRANSACTION_VERB_PATTERN}\\b`,
      'gi',
    );
    const matches = [...clause.matchAll(verbPattern)];
    if (matches.length <= 1) return [clause];

    const starts = [0, ...matches.slice(1).map((match) => match.index)];
    return starts
      .map((start, index) =>
        clause.slice(start, starts[index + 1] ?? clause.length).trim(),
      )
      .filter(Boolean);
  }

  private extractTransactionVerb(text: string): string | null {
    const normalized = this.normalizeCommonTypos(text);
    const match = normalized.match(
      /\b(spent|paid|received|earned|debited|credited)\b/i,
    );
    return match?.[1].toLowerCase() ?? null;
  }

  private startsWithAmountContinuation(text: string): boolean {
    return new RegExp(`^${AMOUNT_CONTINUATION_PATTERN}`, 'i').test(text.trim());
  }

  private normalizeCommonTypos(text: string): string {
    const tokens = Object.keys(COMMON_TOKEN_CORRECTIONS).join('|');
    return text.replace(
      new RegExp(`\\b(?:${tokens})\\b`, 'gi'),
      (token) => COMMON_TOKEN_CORRECTIONS[token.toLowerCase()] ?? token,
    );
  }

  private extractAmount(text: string): AmountParse {
    const currencyMatches = this.collectCurrencyAmounts(text);

    if (currencyMatches.length > 0) {
      return this.resolveCurrencyAmountCandidates(currencyMatches);
    }

    const contextualMatches = this.collectNumbers(
      text,
      /\b(?:paid|spent|cost(?:s)?|amount|debited|credited|received)\s*(?:is|was|of|by|:)?\s*(\d[\d,]*(?:\.\d{1,2})?)/gi,
    );

    if (contextualMatches.length > 0) {
      return this.resolveAmountCandidates(contextualMatches);
    }

    const scrubbed = text
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
      .replace(
        /\b(?:split\s+by|split\s+(?:between|among)|among|between)\s+\d+\b/gi,
        ' ',
      )
      .replace(/\/\s*\d+\b/g, ' ')
      .replace(
        /\b\d{1,4}\s+(?:days?|weeks?|months?|years?)\s+(?:ago|back)\b/gi,
        ' ',
      )
      .replace(
        /\b\d{1,7}\s+(?:minutes?|mins?|hours?|hrs?)\s+(?:ago|back)\b/gi,
        ' ',
      )
      .replace(
        /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi,
        ' ',
      )
      .replace(
        /\b\d{1,2}(?:st|nd|rd|th)?[-\s]+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:[-\s,]+\d{4})?\b/gi,
        ' ',
      );
    const bareMatches = this.collectNumbers(
      scrubbed,
      /\b(\d[\d,]*(?:\.\d{1,2})?)\b/g,
    );
    return this.resolveAmountCandidates(bareMatches);
  }

  private collectNumbers(text: string, pattern: RegExp): number[] {
    const values: number[] = [];
    for (const match of text.matchAll(pattern)) {
      const value = Number(match[1].replace(/,/g, ''));
      if (Number.isFinite(value) && value > 0) values.push(value);
    }
    return values;
  }

  private collectCurrencyAmounts(text: string): CurrencyAmount[] {
    const patterns: ReadonlyArray<{
      currency: CurrencyCode;
      pattern: RegExp;
    }> = [
      {
        currency: CurrencyCode.INR,
        pattern: /(?:₹\s*|\b(?:rs\.?|inr)\s*)(\d[\d,]*(?:\.\d{1,2})?)/gi,
      },
      {
        currency: CurrencyCode.INR,
        pattern: /(\d[\d,]*(?:\.\d{1,2})?)\s*\binr\b/gi,
      },
      {
        currency: CurrencyCode.INR,
        pattern:
          /\brupees?\s*(\d[\d,]*(?:\.\d{1,2})?)(?!\s+(?:days?|weeks?|months?|years?)\s+(?:ago|back))/gi,
      },
      {
        currency: CurrencyCode.INR,
        pattern: /(\d[\d,]*(?:\.\d{1,2})?)\s*\brupees?\b/gi,
      },
      {
        currency: CurrencyCode.USD,
        pattern: /(?:us\$|\$|\busd\b)\s*(\d[\d,]*(?:\.\d{1,2})?)/gi,
      },
      {
        currency: CurrencyCode.USD,
        pattern: /(\d[\d,]*(?:\.\d{1,2})?)\s*\busd\b/gi,
      },
      {
        currency: CurrencyCode.USD,
        pattern:
          /\bdollars?\s*(\d[\d,]*(?:\.\d{1,2})?)(?!\s+(?:days?|weeks?|months?|years?)\s+(?:ago|back))/gi,
      },
      {
        currency: CurrencyCode.USD,
        pattern: /(\d[\d,]*(?:\.\d{1,2})?)\s*\bdollars?\b/gi,
      },
      {
        currency: CurrencyCode.EUR,
        pattern: /(?:€|\beur\b)\s*(\d[\d,]*(?:\.\d{1,2})?)/gi,
      },
      {
        currency: CurrencyCode.EUR,
        pattern: /(\d[\d,]*(?:\.\d{1,2})?)\s*\beur\b/gi,
      },
      {
        currency: CurrencyCode.EUR,
        pattern:
          /\beuros?\s*(\d[\d,]*(?:\.\d{1,2})?)(?!\s+(?:days?|weeks?|months?|years?)\s+(?:ago|back))/gi,
      },
      {
        currency: CurrencyCode.EUR,
        pattern: /(\d[\d,]*(?:\.\d{1,2})?)\s*\beuros?\b/gi,
      },
    ];

    const values: CurrencyAmount[] = [];
    for (const { currency, pattern } of patterns) {
      for (const match of text.matchAll(pattern)) {
        const value = Number(match[1].replace(/,/g, ''));
        if (Number.isFinite(value) && value > 0) {
          values.push({ value, currency });
        }
      }
    }
    return values;
  }

  private resolveCurrencyAmountCandidates(
    candidates: CurrencyAmount[],
  ): AmountParse {
    const unique = [
      ...new Map(
        candidates.map((candidate) => [
          `${candidate.currency}:${candidate.value}`,
          candidate,
        ]),
      ).values(),
    ];
    if (unique.length === 1) {
      return {
        total: unique[0].value,
        currency: unique[0].currency,
        ambiguous: false,
      };
    }
    return { total: null, currency: null, ambiguous: true };
  }

  private resolveAmountCandidates(values: number[]): AmountParse {
    const unique = [...new Set(values)];
    if (unique.length === 1) {
      return { total: unique[0], currency: null, ambiguous: false };
    }
    if (unique.length > 1) {
      return { total: null, currency: null, ambiguous: true };
    }
    return { total: null, currency: null, ambiguous: false };
  }

  private extractSplitFactor(text: string): number {
    const textWithoutHalfHour = text.replace(
      /\bhalf(?:\s+an?)?\s+hours?\b/gi,
      ' ',
    );
    if (/\b(?:half|halved|split\s+in\s+half)\b/i.test(textWithoutHalfHour)) {
      return 2;
    }

    const splitMatch = text.match(
      /(?:\/\s*|\bsplit\s+by\s+|\bsplit\s+(?:between|among)\s+|\b(?:among|between)\s+)(\d+)\b/i,
    );
    const factor = splitMatch ? Number(splitMatch[1]) : 1;
    if (Number.isInteger(factor) && factor >= 2 && factor <= 100) return factor;
    if (
      /\bme\s+and\s+[a-z][a-z.'-]*\s+(?:spent|paid)\b/i.test(text) ||
      /\b[a-z][a-z.'-]*\s+and\s+i\s+(?:spent|paid)\b/i.test(text)
    ) {
      return 2;
    }
    return 1;
  }

  private hasAmbiguousSharedExpense(
    text: string,
    splitFactor: number,
  ): boolean {
    if (splitFactor > 1) return false;
    return (
      /\bme\s+and\s+[a-z][a-z.'-]*\s+(?:spent|paid)\b/i.test(text) ||
      /\b[a-z][a-z.'-]*\s+and\s+i\s+(?:spent|paid)\b/i.test(text) ||
      /\bwe\s+(?:spent|paid)\b/i.test(text)
    );
  }

  private extractDate(
    text: string,
    referenceDate: Date,
    timeZone?: string,
  ): string | null {
    const candidates: string[] = [];
    const referenceParts = this.getDateParts(referenceDate, timeZone);

    for (const match of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
      const parsed = this.validDate(
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
      );
      if (parsed) candidates.push(parsed);
    }

    if (/\byesterday\b/i.test(text)) {
      const parsed = this.subtractRelativeDate(
        referenceDate,
        1,
        'day',
        timeZone,
      );
      if (parsed) candidates.push(parsed);
    }

    for (const match of text.matchAll(
      /\b(\d{1,4})\s+(days?|weeks?|months?|years?)\s+(?:ago|back)\b/gi,
    )) {
      const quantity = Number(match[1]);
      if (quantity < 1) continue;
      const parsed = this.subtractRelativeDate(
        referenceDate,
        quantity,
        match[2].toLowerCase(),
        timeZone,
      );
      if (parsed) candidates.push(parsed);
    }

    if (/\bhalf(?:\s+an?)?\s+hours?\s+(?:ago|back)\b/i.test(text)) {
      candidates.push(
        this.formatInstantDate(
          new Date(referenceDate.getTime() - 30 * 60 * 1000),
          timeZone,
        ),
      );
    }

    for (const match of text.matchAll(
      /\b(\d{1,7})\s+(minutes?|mins?|hours?|hrs?)\s+(?:ago|back)\b/gi,
    )) {
      const quantity = Number(match[1]);
      if (quantity < 1 || quantity > 5_256_000) continue;
      const milliseconds = /^(?:hours?|hrs?)$/i.test(match[2])
        ? quantity * 60 * 60 * 1000
        : quantity * 60 * 1000;
      candidates.push(
        this.formatInstantDate(
          new Date(referenceDate.getTime() - milliseconds),
          timeZone,
        ),
      );
    }

    if (/\btoday\b/i.test(text)) {
      candidates.push(
        this.formatDate(
          referenceParts.year,
          referenceParts.month,
          referenceParts.day,
        ),
      );
    }

    for (const match of text.matchAll(
      /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gi,
    )) {
      const parsed = this.validDate(
        match[3] ? Number(match[3]) : referenceParts.year,
        MONTHS[match[1].toLowerCase()],
        Number(match[2]),
      );
      if (parsed) candidates.push(parsed);
    }

    for (const match of text.matchAll(
      /\b(\d{1,2})(?:st|nd|rd|th)?[-\s]+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:[-\s,]+(\d{4}))?\b/gi,
    )) {
      const parsed = this.validDate(
        match[3] ? Number(match[3]) : referenceParts.year,
        MONTHS[match[2].toLowerCase()],
        Number(match[1]),
      );
      if (parsed) candidates.push(parsed);
    }

    const unique = [...new Set(candidates)];
    if (unique.length !== 1) return null;
    return this.vagueContextAllowsPreciseDate(
      text,
      unique[0],
      referenceDate,
      timeZone,
    )
      ? unique[0]
      : null;
  }

  private vagueContextAllowsPreciseDate(
    text: string,
    candidate: string,
    referenceDate: Date,
    timeZone?: string,
  ): boolean {
    if (!this.hasVagueDateExpression(text)) return true;

    const hasLastMonth = /\blast\s+month\b/i.test(text);
    const hasLastWeek = /\blast\s+week\b/i.test(text);
    const remainingVagueText = text.replace(/\blast\s+(?:month|week)\b/gi, ' ');
    if (
      (!hasLastMonth && !hasLastWeek) ||
      this.hasVagueDateExpression(remainingVagueText)
    ) {
      return false;
    }

    const [candidateYear, candidateMonth, candidateDay] = candidate
      .split('-')
      .map(Number);
    const candidateTime = Date.UTC(
      candidateYear,
      candidateMonth - 1,
      candidateDay,
    );
    const reference = this.getDateParts(referenceDate, timeZone);

    if (hasLastMonth) {
      const previousMonth = new Date(
        Date.UTC(reference.year, reference.month - 2, 1),
      );
      if (
        candidateYear !== previousMonth.getUTCFullYear() ||
        candidateMonth !== previousMonth.getUTCMonth() + 1
      ) {
        return false;
      }
    }

    if (hasLastWeek) {
      const dayMilliseconds = 24 * 60 * 60 * 1000;
      const referenceTime = Date.UTC(
        reference.year,
        reference.month - 1,
        reference.day,
      );
      const referenceWeekday = new Date(referenceTime).getUTCDay();
      const daysSinceMonday = (referenceWeekday + 6) % 7;
      const previousWeekStart =
        referenceTime - (daysSinceMonday + 7) * dayMilliseconds;
      const previousWeekEnd = previousWeekStart + 6 * dayMilliseconds;
      if (
        candidateTime < previousWeekStart ||
        candidateTime > previousWeekEnd
      ) {
        return false;
      }
    }

    return true;
  }

  private subtractRelativeDate(
    referenceDate: Date,
    quantity: number,
    unit: string,
    timeZone?: string,
  ): string | null {
    if (!Number.isInteger(quantity) || quantity > 3650) return null;
    const referenceParts = this.getDateParts(referenceDate, timeZone);

    if (unit.startsWith('day') || unit.startsWith('week')) {
      const days = unit.startsWith('week') ? quantity * 7 : quantity;
      const date = new Date(
        Date.UTC(
          referenceParts.year,
          referenceParts.month - 1,
          referenceParts.day - days,
        ),
      );
      return this.formatDate(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
      );
    }

    const monthOffset = unit.startsWith('year') ? quantity * 12 : quantity;
    const targetMonthStart = new Date(
      Date.UTC(referenceParts.year, referenceParts.month - 1 - monthOffset, 1),
    );
    const year = targetMonthStart.getUTCFullYear();
    const month = targetMonthStart.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(referenceParts.day, lastDay);
    return this.formatDate(year, month + 1, day);
  }

  private validateTimeZone(timeZone?: string): string | undefined {
    if (!timeZone) return undefined;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
      return timeZone;
    } catch {
      throw new BadRequestException('Unsupported timeZone');
    }
  }

  private getDateParts(
    date: Date,
    timeZone?: string,
  ): { year: number; month: number; day: number } {
    if (!timeZone) {
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
      };
    }

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    return { year: value('year'), month: value('month'), day: value('day') };
  }

  private formatInstantDate(date: Date, timeZone?: string): string {
    const parts = this.getDateParts(date, timeZone);
    return this.formatDate(parts.year, parts.month, parts.day);
  }

  private hasVagueDateExpression(text: string): boolean {
    const vagueRelativeDate =
      /\b(?:(?:a\s+)?few|some|several)\s+days?\s+ago\b|\b(?:recently|the\s+other\s+day|sometime\s+(?:today|yesterday|last\s+(?:week|month)))\b|\blast\s+(?:week|month|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
    const qualifiedDate =
      /\b(?:around|about|approximately|roughly)\s+(?:today|yesterday|\d{4}-\d{2}-\d{2}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2})\b/i;
    return vagueRelativeDate.test(text) || qualifiedDate.test(text);
  }

  private validDate(year: number, month: number, day: number): string | null {
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return this.formatDate(year, month, day);
  }

  private formatDate(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private extractCategory(text: string): ParserCategory | null {
    const normalized = text.toLowerCase();
    const matches = (
      Object.entries(CATEGORY_TOKENS) as Array<
        [ParserCategory, readonly string[]]
      >
    )
      .filter(([, tokens]) =>
        tokens.some((token) => this.hasToken(normalized, token)),
      )
      .map(([category]) => category);

    return matches.length === 1 ? matches[0] : null;
  }

  private hasToken(text: string, token: string): boolean {
    const escaped = token
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+');
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(
      text,
    );
  }

  private extractMerchant(text: string): string | null {
    const match = text.match(
      /\b(?:at|to|from|merchant)\s+([a-z0-9][a-z0-9&.'-]*(?:\s+[a-z0-9][a-z0-9&.'-]*){0,5}?)(?=\s+(?:₹|rs\.?\b|inr\b|us\$|\$|usd\b|€|eur\b|\d[\d,]*(?:\.\d{1,2})?\b|on\b|today\b|yesterday\b|split\b|among\b|between\b|from\b|using\b|via\b)|[;,]|$)/i,
    );
    if (match) {
      const merchant = match[1].trim();
      if (!/^(?:a|the)\s+(?:bar|pub|restaurant|cafe)$/i.test(merchant)) {
        return merchant;
      }
    }

    const normalized = text.toLowerCase();
    for (const [token, merchant] of Object.entries(KNOWN_MERCHANTS)) {
      if (this.hasToken(normalized, token)) return merchant;
    }
    return null;
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private buildClarificationPrompt(fields: ParserMissingField[]): string {
    if (fields.length === 1) {
      if (fields[0] === 'date')
        return 'What exact date should I use for this transaction?';
      if (fields[0] === 'amount')
        return 'What amount should I use for this transaction?';
      if (fields[0] === 'split')
        return 'Is this already your personal amount, or should the total be split?';
      return 'Which category should I use for this transaction?';
    }

    if (
      fields.length === 2 &&
      fields.includes('date') &&
      fields.includes('split')
    ) {
      return 'What exact date should I use, and is this already your personal amount or a total to split?';
    }

    const labels: Record<ParserMissingField, string> = {
      date: 'date',
      amount: 'amount',
      category: 'category',
      split: 'split decision',
    };
    const requested = fields.map((field) => labels[field]);
    const last = requested.pop();
    return `Please provide the ${requested.join(', ')}${requested.length ? ' and ' : ''}${last} before confirming this draft.`;
  }
}
