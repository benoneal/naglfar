import {describe, it} from 'mocha'
import assert from 'assert'
import configureMockStore from 'redux-mock-store'

import reducer, {createAction, constants, middleware} from '../src'

const mockStore = configureMockStore([middleware])

const same = (o1, o2) => JSON.stringify(o1) === JSON.stringify(o2)

describe('Naglfar', () => {
  // todo
})
