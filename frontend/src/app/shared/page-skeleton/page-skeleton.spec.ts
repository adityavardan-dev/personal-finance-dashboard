import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageSkeleton } from './page-skeleton';

describe('PageSkeleton', () => {
  let fixture: ComponentFixture<PageSkeleton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PageSkeleton] }).compileComponents();
    fixture = TestBed.createComponent(PageSkeleton);
  });

  it('renders a responsive history-shaped placeholder', () => {
    fixture.componentRef.setInput('kind', 'history');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.history-donut-skeleton')).toBeTruthy();
    expect(element.querySelectorAll('.transaction-row')).toHaveLength(5);
  });

  it('renders the authentication form shape without the application shell', () => {
    fixture.componentRef.setInput('kind', 'auth');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.auth-card-skeleton')).toBeTruthy();
    expect(element.querySelector('.app-frame')).toBeFalsy();
  });
});
