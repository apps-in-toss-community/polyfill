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
    // Should not throw.
  });
});
