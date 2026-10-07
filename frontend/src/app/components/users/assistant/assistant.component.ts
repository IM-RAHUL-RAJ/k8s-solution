import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, effect, inject, signal, viewChild, Injector } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnimationName } from '../../../core/mascot/pixel-mascot';
import { ChatResponse, QuickAction } from '../../../core/models/assistant.model';
import { AccountContextService } from '../../../core/services/account-context.service';
import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';
import { AssistantService } from '../../../core/services/assistant.service';
import { IconComponent } from '../shared/icon/icon.component';
import { MascotComponent } from '../shared/mascot/mascot.component';

/** One line of the conversation. A bot line has the full response (cards, redirect) or an error. */
export interface ChatMessage {
  id: number;
  role: 'user' | 'bot';
  text: string;
  response?: ChatResponse;
  error?: boolean;
  /** What to send again when an error line's Retry is pressed. */
  retry?: { message: string; quickAction?: string };
}

/** The same questions the server offers; shown at once, and replaced by the server's list when it arrives. */
export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { id: 'portfolio_performance', label: 'What is my portfolio performance today and all-time?' },
  { id: 'top_movers', label: 'Show my top 5 gainers and losers in current holdings' },
  { id: 'last_transactions', label: 'Show my last 10 transactions' },
  { id: 'buy_sell_week', label: 'How many BUY vs SELL orders did I place this week?' },
  { id: 'open_orders', label: 'Which orders are still NEW or recently REJECTED?' },
  { id: 'stale_prices', label: 'Which positions are currently stale-priced or unpriced?' },
  { id: 'pnl_summary', label: 'Summarize realised vs unrealised PnL for my account' },
  { id: 'activity_trend', label: 'Show activity trend over last 30 days based on my orders' }
];

const MAX_LENGTH = 500;

/**
 * The in-app companion: ask about your own orders, positions, profit and loss, alerts and activity. Answers come from
 * the server (which holds the model key); the figures are drawn as cards. It cannot place or change anything, and it
 * does not give investment advice: a question that asks for it is sent to the Advice page.
 */
@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [RouterLink, IconComponent, MascotComponent],
  templateUrl: './assistant.component.html',
  styleUrl: './assistant.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssistantComponent {
  private readonly service = inject(AssistantService);
  private readonly accountContext = inject(AccountContextService);
  private readonly errors = inject(ApiErrorMessageService);
  private readonly injector = inject(Injector);

  protected readonly maxLength = MAX_LENGTH;
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly draft = signal('');
  protected readonly loading = signal(false);
  protected readonly quickActions = signal<QuickAction[]>(DEFAULT_QUICK_ACTIONS);
  private conversationId: string | undefined;
  private nextId = 1;

  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  protected readonly canSend = computed(() => !this.loading() && this.draft().trim().length > 0 && this.draft().length <= MAX_LENGTH);

  /** What the mascot does: thinks while it works, wobbles on a refusal or an error, cheers an answer. */
  protected readonly mood = computed<AnimationName>(() => {
    if (this.loading()) {
      return 'think';
    }
    const last = this.messages().at(-1);
    if (!last || last.role === 'user') {
      return 'wave';
    }
    if (last.error) {
      return 'sad';
    }
    if (last.response?.intent === 'GREETING') {
      return 'wave';
    }
    if (last.response?.advisoryBlocked || last.response?.intent === 'BLOCKED' || last.response?.intent === 'OFF_TOPIC') {
      return 'think';
    }
    return 'happy';
  });

  constructor() {
    this.service.quickActions(this.accountId()).subscribe({
      next: (actions) => actions.length > 0 && this.quickActions.set(actions),
      error: () => undefined
    });
    // Keep the newest line in view.
    effect(() => {
      this.messages();
      this.loading();
      afterNextRender(() => {
        const element = this.thread()?.nativeElement;
        if (element) {
          element.scrollTop = element.scrollHeight;
        }
      }, { injector: this.injector });
    });
  }

  private accountId(): number {
    return this.accountContext.getCurrentAccount().accountNumericId;
  }

  protected onInput(value: string): void {
    this.draft.set(value);
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected send(): void {
    if (!this.canSend()) {
      return;
    }
    const message = this.draft().trim();
    this.draft.set('');
    this.ask(message);
  }

  protected askQuick(action: QuickAction): void {
    if (this.loading()) {
      return;
    }
    this.ask(action.label, action.id);
  }

  protected retry(message: ChatMessage): void {
    if (this.loading() || !message.retry) {
      return;
    }
    this.messages.update((list) => list.filter((entry) => entry.id !== message.id));
    this.ask(message.retry.message, message.retry.quickAction, false);
  }

  protected clear(): void {
    this.messages.set([]);
    this.conversationId = undefined;
  }

  private ask(message: string, quickAction?: string, showQuestion = true): void {
    if (showQuestion) {
      this.push({ role: 'user', text: message });
    }
    this.loading.set(true);
    this.service.chat(this.accountId(), { message, conversationId: this.conversationId, selectedQuickAction: quickAction }).subscribe({
      next: (response) => {
        this.conversationId = response.conversationId;
        if (response.quickActions.length > 0) {
          this.quickActions.set(response.quickActions);
        }
        this.push({ role: 'bot', text: response.answer, response });
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.push({ role: 'bot', text: this.errors.getMessage(error), error: true, retry: { message, quickAction } });
        this.loading.set(false);
      }
    });
  }

  private push(entry: Omit<ChatMessage, 'id'>): void {
    this.messages.update((list) => [...list, { ...entry, id: this.nextId++ }]);
  }
}
