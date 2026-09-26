import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { HeroCard } from './hero-card';

describe('HeroCard', () => {
  let component: HeroCard;
  let fixture: ComponentFixture<HeroCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroCard],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows a visible alert after 80 percent of budget is used', () => {
    fixture.componentRef.setInput('spent', 850);
    fixture.componentRef.setInput('budget', 1000);
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('Monthly budget warning');
    expect(alert.textContent).toContain('85%');
  });

  it('shows an exceeded alert above 100 percent', () => {
    fixture.componentRef.setInput('spent', 850);
    fixture.componentRef.setInput('budget', 800);
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('Monthly budget exceeded');
    expect(alert.textContent).toContain('50');
  });

  it('emits a setup request without navigating', () => {
    const emit = vi.spyOn(component.budgetSetupRequested, 'emit');
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.textContent).toContain('Set budget');
    button.click();
    expect(emit).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('a[href="#budget-settings"]')).toBeNull();
  });
});
