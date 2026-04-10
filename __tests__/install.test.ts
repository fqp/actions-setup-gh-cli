import {jest, describe, beforeEach, test, expect} from '@jest/globals'
import {install, getLatestVersion} from '../src/install'
import * as core from '@actions/core'
import {HttpClient} from '@actions/http-client'
import * as toolCache from '@actions/tool-cache'

const mockGetJson = jest.fn<() => Promise<unknown>>()

jest.mock('@actions/core')
jest.mock('@actions/http-client', () => ({
  HttpClient: jest.fn().mockImplementation(() => ({getJson: mockGetJson}))
}))
jest.mock('@actions/tool-cache')
jest.mock('fs', () => ({
  ...jest.requireActual<typeof import('fs')>('fs'),
  chmodSync: jest.fn()
}))

const mockGetInput = jest.mocked(core.getInput)
const mockSetSecret = jest.mocked(core.setSecret)
const mockAddPath = jest.mocked(core.addPath)
const mockDownloadTool = jest.mocked(toolCache.downloadTool)
const mockExtractTar = jest.mocked(toolCache.extractTar)
const mockExtractZip = jest.mocked(toolCache.extractZip)
const mockCacheFile = jest.mocked(toolCache.cacheFile)
const mockFind = jest.mocked(toolCache.find)

function setupInputs(inputs: Record<string, string>): void {
  mockGetInput.mockImplementation((name: string) => inputs[name] || '')
}

function setupToolCache(): void {
  mockFind.mockReturnValue('')
  mockDownloadTool.mockResolvedValue('/tmp/gh_tar')
  mockExtractTar.mockResolvedValue('/tmp/extracted')
  mockCacheFile.mockResolvedValue('/tmp/cached')
}

describe('getLatestVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('creates HttpClient with auth header when auth is provided', async () => {
    mockGetJson.mockResolvedValue({result: {tag_name: 'v2.50.0'}})

    await getLatestVersion('token my-github-token')

    expect(HttpClient).toHaveBeenCalledWith('gh-release', [], {
      headers: {Authorization: 'token my-github-token'}
    })
  })

  test('creates HttpClient with empty headers when no auth', async () => {
    mockGetJson.mockResolvedValue({result: {tag_name: 'v2.50.0'}})

    await getLatestVersion()

    expect(HttpClient).toHaveBeenCalledWith('gh-release', [], {
      headers: {}
    })
  })

  test('strips v prefix from tag_name', async () => {
    mockGetJson.mockResolvedValue({result: {tag_name: 'v2.45.0'}})

    const version = await getLatestVersion()

    expect(version).toBe('2.45.0')
  })

  test('returns tag_name as-is when no v prefix', async () => {
    mockGetJson.mockResolvedValue({result: {tag_name: '2.45.0'}})

    const version = await getLatestVersion()

    expect(version).toBe('2.45.0')
  })
})

describe('install', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupToolCache()
    mockGetJson.mockResolvedValue({result: {tag_name: 'v2.50.0'}})
  })

  test('registers token as secret when token is provided', async () => {
    setupInputs({token: 'my-github-token'})

    await install()

    expect(mockSetSecret).toHaveBeenCalledWith('my-github-token')
  })

  test('does not register secret when no token', async () => {
    setupInputs({})

    await install()

    expect(mockSetSecret).not.toHaveBeenCalled()
  })

  test('passes auth to downloadTool when token is provided', async () => {
    setupInputs({token: 'my-github-token'})

    await install()

    expect(mockDownloadTool).toHaveBeenCalledWith(
      expect.any(String),
      'gh_tar',
      'token my-github-token'
    )
  })

  test('passes undefined auth to downloadTool when no token', async () => {
    setupInputs({})

    await install()

    expect(mockDownloadTool).toHaveBeenCalledWith(
      expect.any(String),
      'gh_tar',
      undefined
    )
  })

  test('uses specified version instead of fetching latest', async () => {
    setupInputs({token: 'my-github-token', version: '2.30.0'})

    await install()

    expect(mockGetJson).not.toHaveBeenCalled()
    expect(mockDownloadTool).toHaveBeenCalledWith(
      expect.stringContaining('v2.30.0'),
      'gh_tar',
      'token my-github-token'
    )
  })

  test('fetches latest version when version input is not set', async () => {
    setupInputs({token: 'my-github-token'})

    await install()

    expect(mockGetJson).toHaveBeenCalledWith(
      'https://api.github.com/repos/cli/cli/releases/latest'
    )
    expect(mockDownloadTool).toHaveBeenCalledWith(
      expect.stringContaining('v2.50.0'),
      'gh_tar',
      'token my-github-token'
    )
  })

  test('skips download when tool is already cached', async () => {
    setupInputs({version: '2.30.0'})
    mockFind.mockReturnValue('/cached/path')

    await install()

    expect(mockDownloadTool).not.toHaveBeenCalled()
    expect(mockAddPath).toHaveBeenCalledWith('/cached/path')
  })

  test('uses extractZip when archive_format is zip', async () => {
    setupInputs({version: '2.30.0', archive_format: 'zip'})
    mockExtractZip.mockResolvedValue('/tmp/extracted-zip')
    mockFind.mockReturnValue('')

    await install()

    expect(mockExtractZip).toHaveBeenCalled()
    expect(mockExtractTar).not.toHaveBeenCalled()
  })

  test('uses extractTar for default tar.gz format', async () => {
    setupInputs({version: '2.30.0'})

    await install()

    expect(mockExtractTar).toHaveBeenCalled()
    expect(mockExtractZip).not.toHaveBeenCalled()
  })
})
