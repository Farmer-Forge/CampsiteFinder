import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { GeolocationService } from './geolocation.service';

describe('GeolocationService', () => {
  let service: GeolocationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GeolocationService);
  });

  it('resolves coordinates from navigator.geolocation', async () => {
    const mockGeolocation = {
      getCurrentPosition: (success: PositionCallback) => {
        success({ coords: { latitude: 44.31, longitude: -68.2 } } as GeolocationPosition);
      },
    };
    Object.defineProperty(window.navigator, 'geolocation', {
      value: mockGeolocation,
      configurable: true,
    });

    const coords = await service.getCurrentPosition();
    expect(coords).toEqual({ lat: 44.31, lng: -68.2 });
  });

  it('rejects when geolocation is unsupported', async () => {
    // Delete geolocation to simulate unsupported browser
    delete (window.navigator as any).geolocation;

    await expect(service.getCurrentPosition()).rejects.toThrow(
      'Geolocation is not supported by this browser',
    );
  });

  function mockGeolocationError(code: number) {
    const mockGeolocation = {
      getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
      },
    };
    Object.defineProperty(window.navigator, 'geolocation', { value: mockGeolocation, configurable: true });
  }

  it('rejects with a clear message when permission is denied', async () => {
    mockGeolocationError(1);

    await expect(service.getCurrentPosition()).rejects.toThrow(
      'Location access was denied. Enter your coordinates below to search manually.',
    );
  });

  it('rejects with a clear message when the position is unavailable', async () => {
    mockGeolocationError(2);

    await expect(service.getCurrentPosition()).rejects.toThrow(
      'Your location could not be determined. Enter your coordinates below to search manually.',
    );
  });

  it('rejects with a clear message when the request times out', async () => {
    mockGeolocationError(3);

    await expect(service.getCurrentPosition()).rejects.toThrow(
      'Locating you took too long. Enter your coordinates below to search manually.',
    );
  });

  describe('checkPermissionState', () => {
    function mockPermissionsQuery(result: Promise<{ state: string }> | (() => Promise<{ state: string }>)) {
      Object.defineProperty(window.navigator, 'permissions', {
        value: { query: vi.fn().mockImplementation(typeof result === 'function' ? result : () => result) },
        configurable: true,
      });
    }

    it('reports the permission state when the Permissions API is available', async () => {
      mockPermissionsQuery(Promise.resolve({ state: 'denied' }));

      await expect(service.checkPermissionState()).resolves.toBe('denied');
    });

    it('reports unsupported when the Permissions API does not exist', async () => {
      Object.defineProperty(window.navigator, 'permissions', { value: undefined, configurable: true });

      await expect(service.checkPermissionState()).resolves.toBe('unsupported');
    });

    it('reports unsupported when querying geolocation permission throws', async () => {
      mockPermissionsQuery(() => Promise.reject(new Error('not supported')));

      await expect(service.checkPermissionState()).resolves.toBe('unsupported');
    });
  });
});
