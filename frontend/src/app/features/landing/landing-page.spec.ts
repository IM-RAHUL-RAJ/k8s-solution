import { TestBed } from '@angular/core/testing';
import { LandingPage } from './landing-page';

describe('LandingPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingPage]
    }).compileComponents();
  });

  it('should create the landing page', () => {
    const fixture = TestBed.createComponent(LandingPage);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the feature cards', async () => {
    const fixture = TestBed.createComponent(LandingPage);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('article').length).toBe(3);
    expect(compiled.textContent).toContain('Standalone components');
  });
});