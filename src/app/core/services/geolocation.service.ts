import { Injectable } from '@angular/core';

export interface Coordinates {
  lat: number;
  lng: number;
}

export type GeolocationPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

const ERROR_MESSAGES: Record<number, string> = {
  1: 'Location access was denied. Enter your coordinates below to search manually.',
  2: 'Your location could not be determined. Enter your coordinates below to search manually.',
  3: 'Locating you took too long. Enter your coordinates below to search manually.',
};

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  getCurrentPosition(): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        (error) => reject(new Error(ERROR_MESSAGES[error.code] ?? error.message)),
        { timeout: 10000 },
      );
    });
  }

  // The browser only ever shows its native permission prompt again when the
  // state is 'prompt' (undecided) — once a user has explicitly blocked
  // location, no amount of re-calling getCurrentPosition() reopens it, so the
  // UI needs to know which case it's in rather than just retrying blindly.
  // Not every browser supports the Permissions API for geolocation (Safari
  // notably doesn't), so an unavailable or failing query degrades to
  // 'unsupported' rather than throwing.
  async checkPermissionState(): Promise<GeolocationPermissionState> {
    if (!navigator.permissions?.query) {
      return 'unsupported';
    }
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return status.state as GeolocationPermissionState;
    } catch {
      return 'unsupported';
    }
  }
}
