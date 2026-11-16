import { describe, expect, it } from 'vitest'

import { devicePlatform, shortcutKey } from './device'

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
}

describe('devicePlatform', () => {
  it('el iPhone, el iPad y el Mac son Apple, con cualquier navegador', () => {
    expect(devicePlatform(UA.iphoneSafari, 5)).toBe('apple')
    expect(devicePlatform(UA.iphoneChrome, 5)).toBe('apple')
    expect(devicePlatform(UA.macSafari, 5)).toBe('apple')
    expect(devicePlatform(UA.macSafari, 0)).toBe('apple')
    expect(devicePlatform(UA.macChrome, 0)).toBe('apple')
  })

  it('Android, con Chrome o con el navegador de Samsung', () => {
    expect(devicePlatform(UA.androidChrome, 5)).toBe('android')
    expect(devicePlatform(UA.androidSamsung, 5)).toBe('android')
  })

  it('Windows y Linux, lo demás', () => {
    expect(devicePlatform(UA.windowsEdge, 0)).toBe('other')
    expect(devicePlatform(UA.linuxFirefox, 0)).toBe('other')
  })
})

describe('shortcutKey', () => {
  it('⌘ en Apple, Ctrl en lo demás', () => {
    expect(shortcutKey('apple')).toBe('⌘')
    expect(shortcutKey('android')).toBe('Ctrl')
    expect(shortcutKey('other')).toBe('Ctrl')
  })
})
