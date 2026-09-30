import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LandingPage } from './landing-page';

describe('LandingPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingPage],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('should create the landing page', () => {
    const fixture = TestBed.createComponent(LandingPage);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the feature cards', async () => {
    const fixture = TestBed.createComponent(LandingPage);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.card').length).toBe(3);
    expect(compiled.textContent).toContain('Trade confidently with a clean, live operational view.');
  });
});