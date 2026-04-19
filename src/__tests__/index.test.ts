import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetDetection } from '../detect.js';
import { install, uninstall, VERSION } from '../index.js';

describe('@ait-co/polyfill — index', () => {
  beforeEach(() => {
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = 'browser';
  });

  afterEach(() => {
    uninstall();
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = undefined;
  });

  it('exports a VERSION string', () => {
    expect(typeof VERSION).toBe('string');
    expect(VERSION.length).toBeGreaterThan(0);
  });

  it('install() returns an uninstall function', () => {
    const off = install();
    expect(typeof off).toBe('function');
    off();
  });

  it('install() is idempotent', () => {
    const off1 = install();
    const off2 = install();
    off1();
    off2();
  });

  it('install() replaces every shim target on navigator', () => {
    install();
    expect(typeof navigator.clipboard.writeText).toBe('function');
    expect(typeof navigator.geolocation.getCurrentPosition).toBe('function');
    expect(
      typeof (navigator as Navigator & { share?: (d?: ShareData) => Promise<void> }).share,
    ).toBe('function');
    expect(
      typeof (navigator as Navigator & { vibrate?: (p: VibratePattern) => boolean }).vibrate,
    ).toBe('function');
    expect(Object.getOwnPropertyDescriptor(navigator, 'onLine')).toBeDefined();
    expect(Object.getOwnPropertyDescriptor(navigator, 'connection')).toBeDefined();
  });

  it('uninstall() removes instance-level overrides', () => {
    install();
    uninstall();
    expect(Object.getOwnPropertyDescriptor(navigator, 'onLine')).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(navigator, 'connection')).toBeUndefined();
  });
});
