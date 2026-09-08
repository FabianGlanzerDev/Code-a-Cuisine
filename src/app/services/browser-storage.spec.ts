import { readBrowserValue, writeBrowserValue } from './browser-storage';

/**
 * Verifies denied storage access does not break the recipe flow.
 */
function storageSuite(): void {
  it('tolerates denied writes', /** Verifies: tolerates denied writes. */ () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('Storage blocked');
    expect(writeBrowserValue('test', [])).toBeFalse();
  });
  it('tolerates malformed saved JSON', /** Verifies: tolerates malformed saved JSON. */ () => {
    spyOn(Storage.prototype, 'getItem').and.returnValue('{');
    expect(readBrowserValue('test', [])).toEqual([]);
  });
}



describe('Browser storage', storageSuite);
