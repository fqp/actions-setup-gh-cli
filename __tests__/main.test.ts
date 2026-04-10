import {jest, describe, beforeEach, test, expect} from '@jest/globals'
import type * as coreType from '@actions/core'
import type {install} from '../src/install'

jest.mock('@actions/core')
jest.mock('../src/install')
jest.mock('@actions/http-client')
jest.mock('@actions/tool-cache')
jest.mock('fs', () => ({
  ...jest.requireActual<typeof import('fs')>('fs'),
  chmodSync: jest.fn()
}))

function getMocks(): {
  mockSetFailed: jest.MockedFunction<typeof coreType.setFailed>
  mockInstall: jest.MockedFunction<typeof install>
} {
  const {setFailed} = jest.requireMock<typeof coreType>('@actions/core')
  const {install: mockInstall} = jest.requireMock<{
    install: jest.MockedFunction<typeof install>
  }>('../src/install')
  return {
    mockSetFailed: setFailed as jest.MockedFunction<typeof coreType.setFailed>,
    mockInstall
  }
}

describe('main', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  test('calls setFailed when install throws', async () => {
    const {mockInstall, mockSetFailed} = getMocks()
    mockInstall.mockRejectedValue(new Error('download failed'))

    require('../src/main')
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(mockSetFailed).toHaveBeenCalledWith('download failed')
  })

  test('does not call setFailed when install succeeds', async () => {
    const {mockInstall, mockSetFailed} = getMocks()
    mockInstall.mockResolvedValue(undefined)

    require('../src/main')
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(mockSetFailed).not.toHaveBeenCalled()
  })
})
