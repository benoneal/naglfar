import React from 'react'
import {renderToString} from 'react-dom/server'
import {Provider} from 'react-redux'
import {applyMiddleware, createStore} from 'redux'
import configureMockStore from 'redux-mock-store'
import naglfar, {
  whitelist,
  registerRedirect,
  registerRoute,
  resolveLocation,
  reducer,
  routeFragment,
  Fragment,
} from '../src'

const compose = (first, ...fns) => (state, action) => fns.reduce((acc, fn) => fn(acc, action), first(state, action))
const aggregateActions = (state = {actions: []}, {type}) => ({...state, actions: [...state.actions, type]})
const thunk = ({dispatch, getState}) => next => action =>
  typeof action === 'function' ? action(dispatch, getState) : next(action)
const createWorkingStore = (history, initialState = {}) =>
  createStore(compose(reducer, aggregateActions), {...initialState, actions: []}, applyMiddleware(thunk, naglfar(history)))

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const actionThunk = type => jest.fn(payload => ({type, payload}))
const asyncThunk = type => jest.fn(payload => dispatch => wait(1).then(() => dispatch({type, payload})))
const mockHistory = () => {
  const h = {}
  h.location = {pathname: '/', search: ''}
  h.push = jest.fn(path => {
    h.location.pathname = path
    h.listener({action: 'PUSH', location: h.location})
  })
  h.replace = jest.fn(path => {
    h.location.pathname = path
    h.listener({action: 'REPLACE', location: h.location})
  })
  h.listener = undefined,
  h.listen = jest.fn(fn => h.listener = fn)
  return h
}

describe('Naglfar', () => {
  const firstRouteActionThunk = actionThunk('firstRouteThunkSuccess')
  const secondRouteActionThunk = asyncThunk('secondRouteThunkSuccess')
  const thirdRouteActionThunk = asyncThunk('thirdRouteThunkSuccess')

  it('returns a whitelist of registered routes and redirects', () => {
    registerRoute('/t0')
    registerRoute('/t1/:test1', firstRouteActionThunk)
    registerRoute('/t3/:test3', [secondRouteActionThunk, thirdRouteActionThunk])
    registerRedirect('/t2', '/t3')
    expect(whitelist()).toEqual(['/t2', '/t0', '/t1/:test1', '/t3/:test3'])
  })

  it('matches routes and resolves all actions to a location', async () => {
    const testDispatch = jest.fn()
    await expect(resolveLocation('/t1/123', testDispatch)).resolves.toEqual({status: 200})
    expect(firstRouteActionThunk).toHaveBeenCalledWith({test1: '123'})
    expect(testDispatch).toHaveBeenCalledWith({type: 'firstRouteThunkSuccess', payload: {test1: '123'}})
    expect(secondRouteActionThunk).not.toHaveBeenCalled()
  })

  it('reduces location change actions', () => {
    const testLocation = {
      pathname: '/t3/dog',
      search: '?test=123',
      status: 200,
    }
    const expectedState = {
      location: {
        pathname: '/t3/dog',
        search: '?test=123',
        status: 200,
        params: {
          test3: 'dog'
        },
        query: {
          test: '123'
        }
      }
    }
    expect(reducer({}, {type: 'SOMETHING', payload: testLocation})).toEqual({})
    expect(reducer({}, {type: 'ENTERED_ROUTE', payload: testLocation})).toEqual(expectedState)
  })

  it('operates as middleware in redux', async () => {
    const expectedActions = [
      {
        type: 'ENTERING_ROUTE',
        payload: '/t3/cat'
      },
      {
        type: 'INITIALISED_ROUTER',
      },
      {
        type: 'secondRouteThunkSuccess',
        payload: {
          test3: 'cat',
        },
      },
      {
        type: 'thirdRouteThunkSuccess',
        payload: {
          test3: 'cat',
        },
      },
      {
        type: 'ENTERED_ROUTE',
        payload: {
          initialised: true,
          pathname: '/t3/cat',
          search: '',
          status: 200,
          url: undefined,
        },
      }
    ]
    const history = mockHistory()
    const mockStore = configureMockStore([thunk, naglfar(history)])
    const store = mockStore({})
    expect(history.listen).toHaveBeenCalledWith(expect.any(Function))
    history.push('/t3/cat')
    await wait(1)
    expect(store.getActions()).toEqual(expectedActions)
  })

  it('creates route fragment components which only render their children on route matches', async () => {
    const Element = routeFragment('/e/:element', asyncThunk('ELEMENT_SELECTED'))
    const Animal = routeFragment('/a/:animal', 'ANIMAL_SELECTED')
    const Vehicle = routeFragment('/v/:vehicle', {type: 'VEHICLE_SELECTED', payload: 'test'})
    const Food = routeFragment('/f/:food', actionThunk('FOOD_SELECTED'), 'div')
    const NotFound = routeFragment(404)

    const history = mockHistory()
    const store = createWorkingStore(history, {location: {status: 404}})

    const html = () => renderToString(
      <Provider store={store}>
        <Element>Element</Element>
        <Animal>Animal</Animal>
        <Vehicle>Vehicle</Vehicle>
        <Food>Food</Food>
        <Fragment forRoute={'/m/:mineral'} beforeEnter={payload => ({type: 'MINERAL_SELECTED', payload})}>Mineral</Fragment>
        <Fragment forRoute={'/c/:cocktail'} beforeEnter={'COCKTAIL_SELECTED'} Element={'span'}>Cocktail</Fragment>
        <NotFound>Error: 404 Not Found</NotFound>
      </Provider>
    )
    expect(html()).toBe('Error: 404 Not Found')
    history.push('/e/cadmium')
    expect(html()).toBe('Error: 404 Not Found')
    await wait(1)
    expect(html()).toBe('Element')
    history.push('/a/lion')
    await wait(1)
    expect(html()).toBe('Animal')
    history.push('/v/jeep')
    await wait(1)
    expect(html()).toBe('Vehicle')
    history.push('/f/cake')
    await wait(1)
    expect(html()).toBe('<div>Food</div>')
    history.push('/m/salt')
    await wait(1)
    expect(html()).toBe('Mineral')
    history.push('/c/manhattan')
    await wait(1)
    expect(html()).toBe('<span>Cocktail</span>')
    expect(store.getState().actions.slice(1)).toEqual([
      'ENTERING_ROUTE',
      'INITIALISED_ROUTER',
      'ELEMENT_SELECTED',
      'ENTERED_ROUTE',
      'ENTERING_ROUTE',
      'ANIMAL_SELECTED',
      'ENTERED_ROUTE',
      'ENTERING_ROUTE',
      'VEHICLE_SELECTED',
      'ENTERED_ROUTE',
      'ENTERING_ROUTE',
      'FOOD_SELECTED',
      'ENTERED_ROUTE',
      'ENTERING_ROUTE',
      'MINERAL_SELECTED',
      'ENTERED_ROUTE',
      'ENTERING_ROUTE',
      'COCKTAIL_SELECTED',
      'ENTERED_ROUTE'
    ])
  })
})

