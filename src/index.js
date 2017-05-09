import React, {Component} from 'react'
import {connect} from 'react-redux'
import routePattern from 'route-parser'
import isString from 'lodash/isString'
import qs from 'qs'
import {createAction} from 'sleipnir'

const {keys} = Object
const navigation = {}
const redirect = {}
const routes = {}

const trimTrailingSlash = (path) => {
  if (path !== '/' && path.slice(-1) === '/') return path.slice(0, -1)
  return path
}

export const routeRedirect = (fromPath, toPath) => {
  redirect[fromPath] = toPath
}

export const registerRoute = (route, action) => {
  if (routes[route]) return
  routes[route] = {
    pattern: new routePattern(route),
    action
  }
}

const findMatches = (path) => (
  keys(routes).reduce((acc, key) => {
    const {pattern, action} = routes[key]
    const params = pattern.match(path)
    return params ? [...acc, {params, action}] : acc
  }, [])
)

const matchRoute = (route, path) => (
  routes[route] && routes[route].pattern.match(path)
)

export const resolveLocation = (path, dispatch) => new Promise((resolve) => {
  path = trimTrailingSlash(path)
  if (redirect[path]) return resolve({status: 302, url: redirect[path]})
  
  const matches = findMatches(path)

  if (!matches.length) return resolve({status: 404})

  Promise.all(matches
    .map(({params, action}) => typeof action === 'function' && dispatch(action(params)))
    .filter((action) => action instanceof Promise)
  ).then(
    () => resolve({status: 200}),
    () => resolve({status: 500})
  )
})

const buildLocationState = (location) => ({
  ...location,
  params: findMatches(location.pathname).reduce((acc, {params}) => ({...acc, ...params}), {}),
  query: qs.parse(location.search.split('?')[1] || '')
})

export default (history) => {
  navigation.push = createAction('GO_TO_LOCATION', {
    sideEffect: (path, state) => history.push(path)
  })

  navigation.replace = createAction('REPLACE_LOCATION', {
    sideEffect: (path, state) => history.replace(path)
  })

  navigation.setLocation = createAction('SET_LOCATION', {
    handler: (state, {payload: location}) => ({
      ...state,
      location: buildLocationState(location)
    }),
    initialState: {location: buildLocationState(history.location)}
  })

  navigation.prefetch = createAction('LOCATION_PREFETCH', {
    sideEffect: (path, state) => resolveLocation(path, a => a(b => b, () => state))
  })

  navigation.locationChange = createAction('LOCATION_CHANGE', {
    async: (location, state, dispatch) => resolveLocation(location.pathname + location.search, dispatch)
      .then(({status, url}) => {
        if (url) return dispatch(navigation.replace(url))
        return dispatch(navigation.setLocation({...location, status, url}))
      })
  })

  return (store) => {
    history.listen((location) => {
      store.dispatch(navigation.locationChange(location))
    })

    return (next) => (action) => next(action)
  }
}

const isNotLeftClick = (e) => !!e.button

const hasModifier = (e) => Boolean(e.shiftKey || e.altKey || e.metaKey || e.ctrlKey)

const shouldIgnoreClick = (e, target) => (
  hasModifier(e) ||
  isNotLeftClick(e) ||
  e.defaultPrevented ||
  target
)

const mapStateToLink = ({
  location
}) => ({
  query: location.search,
  currentPath: location.pathname
})

const mapDispatchToLink = (dispatch) => ({
  push: (path) => dispatch(navigation.push(path)),
  replace: (path) => dispatch(navigation.replace(path)), 
  prefetch: (path) => dispatch(navigation.prefetch(path))
})

class LinkClass extends Component {
  componentDidMount () {
    const {
      to,
      prefetch,
      prefetchData,
      persistQuery,
      query
    } = this.props
    prefetchData && prefetch(`${to}${persistQuery ? query : ''}`)
  }

  render () {
    const {
      to,
      push,
      replace,
      prefetch,
      prefetchData,
      query,
      persistQuery,
      replaceLocation,
      className,
      currentPath,
      activeClassName,
      onClick,
      children,
      target,
      ...rest
    } = this.props

    return (
      <a {...rest}
        className={`${className} ${to === currentPath ? activeClassName : ''}`}
        href={to} 
        onClick={(e) => {
          onClick(e)
          if (shouldIgnoreClick(e, target)) return
          e.preventDefault()
          const navigate = replaceLocation ? replace : push
          navigate(`${to}${persistQuery ? query : ''}`)
        }}
      >
        {children}
      </a>
    )
  }
}
LinkClass.defaultProps = {
  persistQuery: true,
  replaceLocation: false,
  activeClassName: '',
  onClick: () => {}
}

export const Link = connect(mapStateToLink, mapDispatchToLink)(LinkClass)

const mapStateToFragment = ({
  location
}) => ({
  location,
  currentPath: location.pathname + location.search
})

export const Fragment = connect(mapStateToFragment)(({
  location,
  currentPath,
  forRoute,
  withCondition = ({status}) => !status || status === 200,
  element, 
  children
}) => {
  isString(forRoute) && registerRoute(forRoute)
  const renderChildren = Boolean(withCondition(location) && 
      (forRoute === location.status || matchRoute(forRoute, currentPath)))
  const El = element || 'div'
  return renderChildren && <El key={forRoute}>{children}</El>
})

export const routeFragment = (route, action, condition, element) => {
  isString(route) && registerRoute(route, action)

  return ({children}) => (
    <Fragment forRoute={route} withCondition={condition} element={element}>
      {children}
    </Fragment>
  )
}
