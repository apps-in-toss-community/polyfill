import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDetection } from '../detect.js';
import { installShareShim, uninstallShareShim } from '../shims/share.js';

function attachFakeNativeShare() {
  const share = vi.fn(async (_data?: ShareData) => undefined);
  const canShare = vi.fn((_data?: ShareData) => true);
  Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
  Object.defineProperty(navigator, 'canShare', {
    value: canShare,
    configurable: true,
    writable: true,
  });
  return { share, canShare };
}

describe('installShareShim — browser mode', () => {
  beforeEach(() => {
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = 'browser';
  });

  afterEach(() => {
    uninstallShareShim();
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = undefined;
  });

  it('forwards to the native share when available', async () => {
    const native = attachFakeNativeShare();
    installShareShim();

    await (navigator as Navigator & { share: (d?: ShareData) => Promise<void> }).share({
      text: 'hi',
    });

    expect(native.share).toHaveBeenCalledWith({ text: 'hi' });
  });

  it('delegates canShare to native', () => {
    const native = attachFakeNativeShare();
    installShareShim();

    const result = (navigator as Navigator & { canShare: (d?: ShareData) => boolean }).canShare({
      text: 'x',
    });

    expect(result).toBe(true);
    expect(native.canShare).toHaveBeenCalled();
  });
});

describe('installShareShim — Toss mode', () => {
  beforeEach(() => {
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = 'toss';
  });

  afterEach(() => {
    uninstallShareShim();
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = undefined;
    vi.resetModules();
  });

  it('concatenates title + text + url into SDK `message`', async () => {
    const share = vi.fn(async () => undefined);
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText: vi.fn(),
      share,
    }));

    attachFakeNativeShare();
    installShareShim();

    await (navigator as Navigator & { share: (d?: ShareData) => Promise<void> }).share({
      title: 'Title',
      text: 'Body',
      url: 'https://example.com',
    });

    expect(share).toHaveBeenCalledWith({
      message: 'Title\nBody\nhttps://example.com',
    });
  });

  it('throws TypeError on empty ShareData', async () => {
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText: vi.fn(),
      share: vi.fn(),
    }));

    attachFakeNativeShare();
    installShareShim();

    await expect(
      (navigator as Navigator & { share: (d?: ShareData) => Promise<void> }).share({}),
    ).rejects.toThrow(TypeError);
  });
});

describe('installShareShim — neither Toss nor browser share', () => {
  let originalShare: PropertyDescriptor | undefined;
  let originalCanShare: PropertyDescriptor | undefined;

  beforeEach(() => {
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = 'browser';
    originalShare = Object.getOwnPropertyDescriptor(navigator, 'share');
    originalCanShare = Object.getOwnPropertyDescriptor(navigator, 'canShare');
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    uninstallShareShim();
    if (originalShare) Object.defineProperty(navigator, 'share', originalShare);
    if (originalCanShare) Object.defineProperty(navigator, 'canShare', originalCanShare);
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = undefined;
  });

  it('surfaces NotSupportedError when neither Toss nor browser can share', async () => {
    installShareShim();

    await expect(
      (navigator as Navigator & { share: (d?: ShareData) => Promise<void> }).share({ text: 'x' }),
    ).rejects.toMatchObject({ name: 'NotSupportedError' });
  });
});
