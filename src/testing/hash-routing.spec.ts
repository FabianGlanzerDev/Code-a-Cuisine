import { LocationStrategy, HashLocationStrategy } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { appConfig } from '../app/app.config';

describe('Production hash routing', /** Exercises the actual application router configuration. */ () => {
  it('creates hash links with category and page parameters through Angular', /** Prevents a return to path-only routing. */ () => {
    TestBed.configureTestingModule({ providers: appConfig.providers });
    const strategy = TestBed.inject(LocationStrategy);
    const router = TestBed.inject(Router);
    const tree = router.createUrlTree(['/recipes-list'], { queryParams: { cuisine: 'german', page: 3 } });
    expect(strategy instanceof HashLocationStrategy).toBeTrue();
    expect(strategy.prepareExternalUrl(router.serializeUrl(tree))).toBe('#/recipes-list?cuisine=german&page=3');
  });
});
