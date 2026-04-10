import * as core from '@actions/core'
import {install} from './install'

async function run(): Promise<void> {
  try {
    await install()
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

void run()
