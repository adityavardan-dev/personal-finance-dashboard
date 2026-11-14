import { DecimalPipe, DOCUMENT } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PeerSplitsService } from '../../peer-splits/peer-splits.service';
import { parseSplitPrompt } from '../../peer-splits/prompt-parser';
import { localDate, parseSplitDateFollowUp } from '../../peer-splits/split-date';
import { BudgetStore } from '../../../core/budget/budget.store';
import { FinanceMetricsStore } from '../../../core/finance/finance-metrics.store';
import {
  ParseBatchResult,
  ParseResult,
  ParserCategory,
  ParserMissingField,
} from '../../../core/parser/parser.models';
import { ParserService } from '../../../core/parser/parser.service';
import { AppLayout } from '../../../shared/app-layout/app-layout';
import { CreateExpensePayload, ExpenseService, TransactionType } from '../expense.service';
import { ContextIntakeSessionService } from './context-intake-session.service';

type IntakeStatus = 'idle' | 'parsing' | 'draft' | 'saving' | 'error';
type SplitResolution = '' | 'personal' | 'split';
type ChatRole = 'user' | 'assistant';
type DraftSaveStatus = 'draft' | 'saving' | 'saved' | 'error';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: string;
  savedSummary?: SavedTransactionSummary;
  splitPreview?: {
    id: string;
    totalAmountMinor: number;
    currency: string;
    people: number;
    date: string | null;
    title: string;
  };
}

interface SavedTransactionSummary {
  count: number;
  total: number;
  currency: 'INR' | 'USD' | 'EUR';
  remainingCount: number;
  items: Array<{
    label: string;
    category: string;
    date: string;
    amount: number;
  }>;
}

interface IntakeDraft {
  id: string;
  type: TransactionType;
  amount: string;
  category: string;
  merchant: string;
  date: string;
  note: string;
  detectedCurrency: 'INR' | 'USD' | 'EUR' | null;
  originalAmount: number | null;
  splitFactor: string;
  splitResolution: SplitResolution;
  selected: boolean;
  expanded: boolean;
  currencyAcknowledged: boolean;
  categoryResolutionMessage: string;
  saveStatus: DraftSaveStatus;
  errorMessage: string;
}

interface ConversationSnapshot {
  messages: ChatMessage[];
  drafts: IntakeDraft[];
}

@Component({
  selector: 'app-context-intake',
  imports: [AppLayout, FormsModule, RouterLink, DecimalPipe],
  templateUrl: './context-intake.html',
  styleUrl: './context-intake.css',
})
export class ContextIntakeComponent {
  private readonly parserService = inject(ParserService);
  private readonly expenseService = inject(ExpenseService);
  private readonly metricsStore = inject(FinanceMetricsStore);
  private readonly session = inject(ContextIntakeSessionService);
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly peerSplits = inject(PeerSplitsService);
  protected readonly splitMode = this.route.snapshot.queryParamMap?.get('mode') === 'split';
  protected readonly budgetStore = inject(BudgetStore);

  protected readonly status = signal<IntakeStatus>('idle');
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly drafts = signal<IntakeDraft[]>([]);
  protected readonly errorMessage = signal('');
  protected readonly applicationCurrency = computed(() => this.budgetStore.currency());
  protected readonly readyCount = computed(
    () =>
      this.drafts().filter((draft) => this.canSaveDraft(draft) && draft.saveStatus !== 'saved')
        .length,
  );
  protected readonly selectedReadyCount = computed(
    () =>
      this.drafts().filter(
        (draft) => draft.selected && this.canSaveDraft(draft) && draft.saveStatus !== 'saved',
      ).length,
  );

  protected rawText = '';
  protected readonly expenseCategories = [
    'Food & Dining',
    'Shopping',
    'Transport',
    'Utilities',
    'Entertainment',
    'Other',
  ];
  protected readonly incomeCategories = ['Salary', 'Freelance', 'Refund', 'Other'];
  protected conversationId: string = crypto.randomUUID();
  protected expiresAt = '';

  constructor() {
    this.budgetStore.load();
    const cached = this.session.load<ConversationSnapshot>();
    if (cached) {
      this.conversationId = cached.conversationId;
      this.expiresAt = cached.expiresAt;
      const savedDrafts = cached.value.drafts.filter((draft) => draft.saveStatus === 'saved');
      const activeDrafts = cached.value.drafts.filter((draft) => draft.saveStatus !== 'saved');
      this.messages.set(cached.value.messages);
      this.drafts.set(activeDrafts);
      if (savedDrafts.length) {
        this.addMessage(
          'assistant',
          `${savedDrafts.length} ${this.pluralize('transaction', savedDrafts.length)} saved successfully.`,
          this.createSavedSummary(savedDrafts),
        );
        this.persistConversation();
      }
      this.status.set(activeDrafts.length ? 'draft' : 'idle');
    }
  }

  protected categoriesFor(draft: IntakeDraft): string[] {
    return draft.type === 'income' ? this.incomeCategories : this.expenseCategories;
  }

  protected submitMessage(): void {
    const text = this.rawText.trim();
    if (!text || this.status() === 'parsing' || this.status() === 'saving') return;
    this.addMessage('user', text);
    this.rawText = '';
    this.status.set('parsing');
    this.errorMessage.set('');

    if (this.applySplitDateFollowUp(text)) return;

    if (this.splitMode || /\b(split|share|owes|owed|among|between)\b/i.test(text)) {
      this.previewSplitMessage(text);
      return;
    }

    if (this.shouldTreatAsFollowUp(text)) {
      this.applyFollowUp(text);
      return;
    }

    this.parserService.parseBatch(text).subscribe({
      next: (result) => this.addParsedBatch(result),
      error: () => this.handleParseError(),
    });
  }

  private previewSplitMessage(text: string): void {
    const draft = parseSplitPrompt(text);
    if (!draft) {
      this.addMessage(
        'assistant',
        'I need the total and the people by name to make a peer split. Try “I paid INR 1200 with Harsha and Jaswanth, split equally”, or use the manual split form.',
      );
      this.status.set('idle');
      this.persistConversation();
      return;
    }
    const service = this.peerSplits;
    service.preview(draft.input).subscribe({
      next: (result) => {
        const title =
          text.match(/\bfor\s+([A-Za-z][A-Za-z ]{1,35})/i)?.[1]?.trim() || 'Group split';
        const date =
          text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ??
          (/\btoday\b/i.test(text) ? localDate() : null);
        const id = service.addPreview(title, draft.input.participants, result, { date, category: title });
        this.addMessage(
          'assistant',
          'Split preview ready. Open the card to review everyone’s share.',
          undefined,
          {
            id,
            totalAmountMinor: result.totalAmountMinor,
            currency: result.currency,
            people: draft.input.participants.length,
            date,
            title,
          },
        );
        this.status.set('idle');
        this.persistConversation();
      },
      error: (response: { error?: { issues?: { message: string }[] } }) => {
        this.addMessage(
          'assistant',
          response.error?.issues?.map((issue) => issue.message).join(' ') ||
            'This split needs clarification. Review the total, payers, and people in the manual split form.',
        );
        this.status.set('idle');
        this.persistConversation();
      },
    });
  }

  protected splitPreviewDate(message: ChatMessage): string | null {
    const preview = message.splitPreview;
    return preview ? (this.peerSplits.getGroup(preview.id)?.date ?? preview.date) : null;
  }

  private applySplitDateFollowUp(text: string): boolean {
    const date = parseSplitDateFollowUp(text);
    if (!date) return false;
    const previews = this.messages()
      .flatMap((message) => (message.splitPreview ? [message.splitPreview] : []))
      .filter((preview) => this.peerSplits.getGroup(preview.id));
    if (!previews.length) return false;
    const missingDates = previews.filter((preview) => !this.peerSplits.getGroup(preview.id)?.date);
    const targets = missingDates.length === 1 ? missingDates : previews.length === 1 ? previews : [];
    if (targets.length !== 1) {
      this.addMessage('assistant', 'Which split should I update? Open its details and set the date there.');
    } else if (this.peerSplits.updateDate(targets[0].id, date)) {
      this.messages.update((messages) =>
        messages.map((message) =>
          message.splitPreview?.id === targets[0].id
            ? { ...message, splitPreview: { ...message.splitPreview, date } }
            : message,
        ),
      );
      this.addMessage('assistant', `Date updated to ${date}. Review the split details.`);
    } else {
      this.addMessage('assistant', 'I could not update that split date. Open its details to edit it.');
    }
    this.status.set(this.drafts().length ? 'draft' : 'idle');
    this.persistConversation();
    return true;
  }

  protected onTypeChange(draft: IntakeDraft, type: TransactionType): void {
    draft.type = type;
    draft.categoryResolutionMessage = '';
    if (!this.categoriesFor(draft).includes(draft.category)) draft.category = '';
    this.touchDrafts();
  }

  protected onSplitResolutionChange(draft: IntakeDraft): void {
    if (draft.splitResolution === 'personal' && draft.originalAmount !== null) {
      draft.amount = String(draft.originalAmount);
      draft.splitFactor = '';
    }
    if (draft.splitResolution === 'split') this.recalculateSplit(draft);
    this.touchDrafts();
  }

  protected recalculateSplit(draft: IntakeDraft): void {
    if (draft.splitResolution !== 'split' || draft.originalAmount === null) return;
    const factor = Number(draft.splitFactor);
    if (!Number.isInteger(factor) || factor < 2 || factor > 100) return;
    draft.amount = String(this.roundMoney(draft.originalAmount / factor));
    this.touchDrafts();
  }

  protected toggleDraft(draft: IntakeDraft, open: boolean): void {
    draft.expanded = open;
    this.persistConversation();
  }

  protected touchDrafts(): void {
    this.drafts.update((drafts) => [...drafts]);
    this.persistConversation();
  }

  protected canSaveDraft(draft: IntakeDraft): boolean {
    const amount = Number(draft.amount);
    const splitResolved =
      draft.splitResolution === 'personal' ||
      (draft.splitResolution === 'split' &&
        Number.isInteger(Number(draft.splitFactor)) &&
        Number(draft.splitFactor) >= 2);
    return (
      draft.saveStatus !== 'saving' &&
      Number.isFinite(amount) &&
      amount > 0 &&
      Boolean(draft.category) &&
      Boolean(draft.date) &&
      splitResolved &&
      (!this.currencyMismatch(draft) || draft.currencyAcknowledged)
    );
  }

  protected currencyMismatch(draft: IntakeDraft): boolean {
    return Boolean(draft.detectedCurrency && draft.detectedCurrency !== this.applicationCurrency());
  }

  protected isMissing(draft: IntakeDraft, field: string): boolean {
    return this.missingLabels(draft).includes(field);
  }

  protected draftStatusLabel(draft: IntakeDraft): string {
    if (draft.saveStatus === 'saved') return 'Saved';
    if (draft.saveStatus === 'saving') return 'Saving';
    const missing = this.missingLabels(draft);
    return missing.length ? `Needs ${missing[0]}` : 'Ready';
  }

  protected saveOne(draft: IntakeDraft): void {
    if (this.canSaveDraft(draft)) this.saveDrafts([draft]);
  }

  protected saveSelected(): void {
    this.saveDrafts(
      this.drafts().filter(
        (draft) => draft.selected && this.canSaveDraft(draft) && draft.saveStatus !== 'saved',
      ),
    );
  }

  protected saveAllReady(): void {
    this.saveDrafts(
      this.drafts().filter((draft) => this.canSaveDraft(draft) && draft.saveStatus !== 'saved'),
    );
  }

  protected startNewConversation(): void {
    this.session.clear();
    this.conversationId = crypto.randomUUID();
    this.expiresAt = '';
    this.messages.set([]);
    this.drafts.set([]);
    this.errorMessage.set('');
    this.rawText = '';
    this.status.set('idle');
  }

  protected formatMessageTime(message: ChatMessage): string {
    return new Date(message.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private addParsedBatch(result: ParseBatchResult): void {
    const offset = this.drafts().length;
    const added = result.drafts.map((draft, index) => this.createDraft(draft, offset + index));
    this.drafts.update((drafts) => [...drafts, ...added]);
    const ready = added.filter((draft) => this.canSaveDraft(draft)).length;
    const attention = added.length - ready;
    this.addMessage(
      'assistant',
      attention
        ? `I created ${added.length} ${this.pluralize('transaction draft', added.length)}. ${result.clarificationPrompt ?? `${attention} ${attention === 1 ? 'needs' : 'need'} attention; expand the cards or reply here to complete them.`}`
        : `I created ${added.length} ready ${this.pluralize('transaction draft', added.length)}. Review the details before saving.`,
    );
    this.status.set('draft');
    this.persistConversation();
    this.focusFirstMissingControl(result.drafts, added);
  }

  private applyFollowUp(text: string): void {
    this.parserService.parse(text).subscribe({
      next: (parsed) => {
        const targets = this.resolveTargets(text);
        if (!targets.length) {
          this.addMessage(
            'assistant',
            'I could not identify which transaction to update. Try “transaction 2”, “use yesterday for all”, or expand a card and edit it.',
          );
          this.status.set('draft');
          this.persistConversation();
          return;
        }
        const changed = this.patchTargets(targets, text, parsed);
        this.drafts.update((drafts) => [...drafts]);
        this.addMessage(
          'assistant',
          changed
            ? `${changed} ${this.pluralize('transaction', changed)} updated. Review the cards before saving.`
            : 'I could not apply that change safely. Try “use yesterday for all”, “change transaction 2 to 600”, or edit the card directly.',
        );
        this.status.set('draft');
        this.persistConversation();
      },
      error: () => this.handleParseError(),
    });
  }

  private patchTargets(targets: IntakeDraft[], text: string, parsed: ParseResult): number {
    let changed = 0;
    const explicitAmount = text.match(
      /\b(?:change|set|make)(?:\s+transaction\s+\d+|\s+[a-z][a-z\s&-]*?)?\s+(?:to|as)\s*(?:₹|rs\.?|inr|\$|usd|€|eur)?\s*(\d[\d,]*(?:\.\d{1,2})?)/i,
    );
    const split = text.match(/\bsplit(?:\s+it|\s+this)?\s+(?:by|between)\s+(\d+)\b/i);
    const personal = /\b(?:already\s+)?(?:my|personal)\s+amount\b/i.test(text);

    for (const draft of targets) {
      let draftChanged = false;
      const missing = this.missingLabels(draft);
      if (explicitAmount) {
        draft.amount = explicitAmount[1].replace(/,/g, '');
        draft.originalAmount = Number(draft.amount);
        draftChanged = true;
      }
      if (split && Number(split[1]) >= 2 && Number(split[1]) <= 100) {
        if (draft.originalAmount === null) draft.originalAmount = Number(draft.amount) || null;
        draft.splitResolution = 'split';
        draft.splitFactor = split[1];
        this.recalculateSplit(draft);
        draftChanged = true;
      } else if (personal) {
        draft.splitResolution = 'personal';
        draft.splitFactor = '';
        draftChanged = true;
      }
      if (
        parsed.draft.date &&
        (missing.includes('date') || /\b(?:date|today|yesterday|ago|back|for all)\b/i.test(text))
      ) {
        draft.date = parsed.draft.date;
        draftChanged = true;
      }
      if (parsed.draft.category && (missing.includes('category') || /\bcategory\b/i.test(text))) {
        draft.category = this.mapCategory(parsed.draft.category, draft.note).category;
        draftChanged = true;
      }
      if (
        parsed.draft.merchant &&
        (missing.includes('merchant') || /\b(?:merchant|from|at)\b/i.test(text))
      ) {
        draft.merchant = parsed.draft.merchant;
        draftChanged = true;
      }
      if (!explicitAmount && parsed.draft.amount !== null && missing.includes('amount')) {
        draft.amount = String(parsed.draft.amount);
        draft.originalAmount = parsed.draft.originalAmount ?? parsed.draft.amount;
        draftChanged = true;
      }
      if (draftChanged) {
        draft.expanded = true;
        changed += 1;
      }
    }
    return changed;
  }

  private resolveTargets(text: string): IntakeDraft[] {
    const unsaved = this.drafts().filter((draft) => draft.saveStatus !== 'saved');
    if (/\b(?:for all|all transactions|all expenses)\b/i.test(text)) return unsaved;
    const numbered = text.match(/\btransaction\s+(\d+)\b/i);
    if (numbered) {
      const draft = this.drafts()[Number(numbered[1]) - 1];
      return draft && draft.saveStatus !== 'saved' ? [draft] : [];
    }
    const changeTarget = text.match(/\b(?:change|set|make)\s+(.+?)\s+(?:to|as)\b/i)?.[1];
    if (changeTarget) {
      const words = changeTarget
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 2 && word !== 'the');
      const matches = unsaved.filter((draft) => {
        const searchable = `${draft.note} ${draft.category} ${draft.merchant}`.toLowerCase();
        return words.some((word) => searchable.includes(word));
      });
      if (matches.length === 1) return matches;
      if (matches.length > 1) return [];
    }
    const needingAttention = unsaved.filter((draft) => this.missingLabels(draft).length > 0);
    if (needingAttention.length === 1) return needingAttention;
    return unsaved.length === 1 ? unsaved : [];
  }

  private focusFirstMissingControl(results: ParseResult[], drafts: IntakeDraft[]): void {
    const index = results.findIndex(
      (result, resultIndex) =>
        result.missingFields.length > 0 || this.missingLabels(drafts[resultIndex]).length > 0,
    );
    if (index < 0) return;

    const result = results[index];
    const draft = drafts[index];
    const parserField = result.missingFields[0];
    const controlId = this.controlIdForMissingField(
      draft,
      parserField ?? this.missingLabels(draft)[0],
    );
    if (!controlId) return;

    this.document.defaultView?.setTimeout(() => {
      this.document.getElementById(controlId)?.focus();
    });
  }

  private controlIdForMissingField(
    draft: IntakeDraft,
    field: ParserMissingField | string | undefined,
  ): string | null {
    if (field === 'split' || field === 'split decision') return `split-personal-${draft.id}`;
    if (field === 'amount' || field === 'category' || field === 'date' || field === 'merchant') {
      return `${field}-${draft.id}`;
    }
    if (field === 'currency review') return `currency-${draft.id}`;
    return null;
  }

  private shouldTreatAsFollowUp(text: string): boolean {
    if (!this.drafts().some((draft) => draft.saveStatus !== 'saved')) return false;
    if (/\b(?:for all|all transactions|transaction\s+\d+)\b/i.test(text)) return true;
    if (/^(?:use|set|change|make|split|already|my|personal)\b/i.test(text)) return true;
    const needingAttention = this.drafts().some((draft) => this.missingLabels(draft).length > 0);
    const newTransaction = /\b(?:spent|paid|received|earned|debited|credited)\b/i.test(text);
    return needingAttention && !newTransaction;
  }

  private saveDrafts(drafts: IntakeDraft[]): void {
    if (!drafts.length) return;
    this.status.set('saving');
    this.errorMessage.set('');
    drafts.forEach((draft) => {
      draft.saveStatus = 'saving';
      draft.errorMessage = '';
    });
    this.drafts.update((current) => [...current]);
    this.expenseService.createBatch(drafts.map((draft) => this.toPayload(draft))).subscribe({
      next: () => {
        const savedSummary = this.createSavedSummary(drafts);
        const savedIds = new Set(drafts.map((draft) => draft.id));
        this.drafts.update((current) => current.filter((draft) => !savedIds.has(draft.id)));
        this.metricsStore.refresh();
        this.addMessage(
          'assistant',
          `${drafts.length} ${this.pluralize('transaction', drafts.length)} saved successfully.`,
          savedSummary,
        );
        this.status.set('draft');
        this.persistConversation();
      },
      error: () => {
        drafts.forEach((draft) => {
          draft.saveStatus = 'error';
          draft.errorMessage = 'Could not save this transaction. Try again.';
          draft.expanded = true;
        });
        this.drafts.update((current) => [...current]);
        this.status.set('draft');
        this.errorMessage.set('No transactions from this batch were saved. Review and try again.');
        this.persistConversation();
      },
    });
  }

  private toPayload(draft: IntakeDraft): CreateExpensePayload {
    return {
      type: draft.type,
      amount: Number(draft.amount),
      category: draft.category,
      merchant: draft.merchant.trim(),
      date: draft.date,
      note: draft.note.trim() || undefined,
    };
  }

  private createDraft(result: ParseResult, index: number): IntakeDraft {
    const type: TransactionType = result.draft.category === 'Income' ? 'income' : 'expense';
    const mapped = this.mapCategory(result.draft.category, result.draft.notes);
    const splitNeeded = result.missingFields.includes('split');
    return {
      id: crypto.randomUUID(),
      type,
      amount: result.draft.amount === null ? '' : String(result.draft.amount),
      category: mapped.category,
      merchant: result.draft.merchant ?? '',
      date: result.draft.date ?? '',
      note: result.draft.notes,
      detectedCurrency: result.draft.currency,
      originalAmount: result.draft.originalAmount ?? result.draft.amount,
      splitFactor: result.draft.splitFactor ? String(result.draft.splitFactor) : '',
      splitResolution: splitNeeded ? '' : 'personal',
      selected: true,
      expanded: result.status !== 'READY' || index === 0,
      currencyAcknowledged: false,
      categoryResolutionMessage: mapped.message,
      saveStatus: 'draft',
      errorMessage: '',
    };
  }

  private mapCategory(
    category: ParserCategory | null,
    notes: string,
  ): { category: string; message: string } {
    if (category === null) return { category: '', message: '' };
    if (category === 'Transportation') {
      return { category: 'Transport', message: 'Transportation will be saved as Transport.' };
    }
    if (category === 'Bills & Utilities') {
      return { category: 'Utilities', message: 'Bills & Utilities will be saved as Utilities.' };
    }
    if (category === 'Health & Personal Care') {
      return { category: 'Other', message: 'Health & Personal Care will be saved as Other.' };
    }
    if (category === 'Income') {
      const normalized = notes.toLowerCase();
      if (normalized.includes('salary') || normalized.includes('paycheck')) {
        return { category: 'Salary', message: '' };
      }
      if (normalized.includes('freelance')) return { category: 'Freelance', message: '' };
      if (normalized.includes('refund')) return { category: 'Refund', message: '' };
      return { category: 'Other', message: '' };
    }
    return { category, message: '' };
  }

  private missingLabels(draft: IntakeDraft): string[] {
    const missing: string[] = [];
    if (!Number.isFinite(Number(draft.amount)) || Number(draft.amount) <= 0) missing.push('amount');
    if (!draft.category) missing.push('category');
    if (!draft.date) missing.push('date');
    if (!draft.splitResolution) missing.push('split decision');
    if (this.currencyMismatch(draft) && !draft.currencyAcknowledged) {
      missing.push('currency review');
    }
    return missing;
  }

  private handleParseError(): void {
    this.status.set(this.drafts().length ? 'draft' : 'error');
    this.errorMessage.set("We couldn't process that message. Your existing drafts are unchanged.");
    this.addMessage(
      'assistant',
      'I could not process that message. Try a specific instruction or edit a transaction card.',
    );
    this.persistConversation();
  }

  private createSavedSummary(drafts: IntakeDraft[]): SavedTransactionSummary {
    return {
      count: drafts.length,
      total: this.roundMoney(
        drafts.reduce((total, draft) => total + (Number(draft.amount) || 0), 0),
      ),
      currency: this.applicationCurrency(),
      remainingCount: Math.max(0, drafts.length - 3),
      items: drafts.slice(0, 3).map((draft) => ({
        label: draft.merchant || draft.category,
        category: draft.category,
        date: draft.date,
        amount: Number(draft.amount),
      })),
    };
  }

  private addMessage(
    role: ChatRole,
    text: string,
    savedSummary?: SavedTransactionSummary,
    splitPreview?: ChatMessage['splitPreview'],
  ): void {
    this.messages.update((messages) => [
      ...messages,
      {
        id: crypto.randomUUID(),
        role,
        text,
        createdAt: new Date().toISOString(),
        savedSummary,
        splitPreview,
      },
    ]);
  }

  private persistConversation(): void {
    const cached = this.session.save<ConversationSnapshot>(this.conversationId, {
      messages: this.messages(),
      drafts: this.drafts(),
    });
    this.expiresAt = cached?.expiresAt ?? '';
  }

  private pluralize(word: string, count: number): string {
    return count === 1 ? word : `${word}s`;
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
