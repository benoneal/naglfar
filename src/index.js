import React, {useEffect, forwardRef} from 'react'
import {useSelector} from 'react-redux'
import routePattern from 'route-parser'
import qs from 'qs'

const {keys, values} = Object
const redirect = {}
const routes = {}

const isString = s => typeof s === 'string'

export const whitelist = () => [...keys(redirect), ...keys(routes)]

const trimTrailingSlash = (path = '') => {
  if (path !== '/' && path.slice(-1) === '/') return path.slice(0, -1)
  return path
}

export const registerRedirect = (fromPath, toPath) =>
  redirect[fromPath] = toPath

export const registerRoute = (route, action = 'MATCHED_ROUTE_WITH_NO_ACTIONS') => {
  if (routes[route]) return
  routes[route] = {
    pattern: new routePattern(route),
    actions: Array.isArray(action) ? action : [action]
  }
}

const findMatches = path => (
  values(routes).reduce((acc, {pattern, actions}) => {
    const params = pattern.match(path)
    return params ? acc.concat(actions.map(action => ({params, action}))) : acc
  }, [])
)

const matchRoute = (route, path) =>
  routes[route] && routes[route].pattern.match(path)

export const resolveLocation = (path, dispatch) => new Promise(resolve => {
  const {status, matches, url} = matchStatus(path)
  if (status !== 200) return resolve({status, url})

  Promise.all(matches
    .map(({params, action}) => {
      if (typeof action === 'function') return dispatch(action(params))
      if (typeof action === 'object' && action.type) return dispatch({...action, params})
      if (typeof action === 'string') return dispatch({type: action, payload: params})
    })
    .filter(action => action instanceof Promise)
  ).then(
    _ => resolve({status}),
    _ => resolve({status: 500})
  )
})

const matchStatus = path => {
  path = trimTrailingSlash(path)
  const url = redirect[path]
  const matches = findMatches(path)
  const status = url ? 302 : !findMatches(path).length ? 404 : 200
  return {status, matches, url}
}

export const buildLocationState = location => {
  const {status, matches} = matchStatus(location.pathname + location.search)
  return {
    ...location,
    status: location.status || status,
    params: matches.reduce((acc, {params}) => ({...acc, ...params}), {}),
    query: qs.parse(location.search.split('?')[1] || '')
  }
}

let push
let replace
const createNav = (navMethod, dispatch) => path => {
  dispatch(enteringRoute(path))
  navMethod(path)
}
const enteredRoute = payload => ({type: 'ENTERED_ROUTE', payload})
const enteringRoute = payload => ({type: 'ENTERING_ROUTE', payload})
const prefetch = (path, state) => resolveLocation(path, a => a(b => b, () => state))
const locationChange = dispatch => action => {
  const location = action.location || action
  return resolveLocation(location.pathname + location.search, dispatch)
    .then(({status, url}) => {
      if (url) return replace(url)
      return dispatch(enteredRoute({...location, status, url}))
    })
}

export const navigateTo = path => push(path)

export const reducer = (state = {}, {type, payload}) => {
  if (type === 'ENTERED_ROUTE') return {...state, location: buildLocationState(payload)}
  return state
}

export default (history, uses_ssr = false) => store => {
  const originalPush = history.push.bind(history)
  const originalReplace = history.replace.bind(history)
  history.push = createNav(originalPush, store.dispatch)
  history.replace = createNav(originalReplace, store.dispatch)
  push = history.push
  replace = history.replace
  history.listen(locationChange(store.dispatch))

  let initialised = uses_ssr
  const initialise = _ => {
    initialised = true
    resolveLocation(history.location.pathname + history.location.search, store.dispatch)
  }

  return next => action => {
    next(action)
    if (!initialised) initialise()
  }
}

const selectStatus = ({location}) => location.status
const selectPath = ({location}) => location.pathname + location.search

export const Fragment = ({
  forRoute,
  beforeEnter,
  Element = React.Fragment,
  children
}) => {
  const status = useSelector(selectStatus)
  const path = useSelector(selectPath)
  isString(forRoute) && registerRoute(forRoute, beforeEnter)
  const renderChildren = Boolean(forRoute === status || (status === 200 && matchRoute(forRoute, path)))
  return renderChildren && <Element key={forRoute}>{children}</Element>
}

export const routeFragment = (route, actions, Element) => {
  isString(route) && registerRoute(route, actions)

  return ({children}) => (
    <Fragment forRoute={route} beforeEnter={actions} Element={Element}>
      {children}
    </Fragment>
  )
}

const isNotLeftClick = (e) => !!e.button
const hasModifier = (e) => Boolean(e.shiftKey || e.altKey || e.metaKey || e.ctrlKey)
const shouldIgnoreClick = (e, target) => (
  hasModifier(e) ||
  isNotLeftClick(e) ||
  e.defaultPrevented ||
  target
)

const selectQuery = ({location}) => location.search
const selectCurrentPath = ({location}) => location.pathname

export const Link = forwardRef(({
  to,
  target,
  prefetchData = false,
  persistQuery = true,
  replaceLocation = false,
  className = '',
  activeClassName = '',
  onClick = () => {},
  children,
  ...rest
}, ref) => {
  const query = useSelector(selectQuery)
  const currentPath = useSelector(selectCurrentPath)
  const state = useSelector(s => s)
  const linkTo = `${to}${persistQuery ? query : ''}`
  useEffect(() => {if (prefetchData) prefetch(linkTo, state)}, [])
  const classes = [className, to === currentPath && activeClassName].filter(Boolean).join(' ')
  return (
    <a
      ref={ref}
      {...rest}
      className={classes}
      href={to}
      target={target}
      onClick={e => {
        onClick(e)
        if (shouldIgnoreClick(e, target)) return
        e.preventDefault()
        replaceLocation ? replace(linkTo) : push(linkTo)
      }}
    >
      {children}
    </a>
  )
})
