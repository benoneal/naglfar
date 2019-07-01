
# Naglfar

A router that keeps all state in redux. It treats the url like a form input: it fires actions on change which update the location in your state. This is accessible from any redux-connected component: no need for a separate `RouteProvider`.

It doesn't need to own/wrap your application. It provides a `Fragment` pattern to partition your UI based on current route, including route status codes.

It works both in the browser and on the server, and offers:

- Server-side rendering
- Data fetching prior to transition (via dispatching actions)
- Status codes
- Not-found routes (and any status-code based route)
- Redirects
- Prefetching data (pre-firing actions without modifying state) for Links to speed up navigation

Requires the `history` module.

## How to use

Install via `npm i -S naglfar` or `yarn add naglfar`.

Create your routes. Example:

```js
// routes.js
import {routeFragment, routeRedirect} from 'naglfar'
import {
  getSubredditFeed,
  getStory
} from './actionCreators'

// Actions per route can be regular actionCreators, async thunks,
// action objects, or action-type strings, or an array of any of those
export const SubredditRoute = routeFragment('/r/:subreddit', getSubredditFeed)
export const StoryRoute = routeFragment('/r/:subreddit/:story', [getSubredditFeed, getStory])
export const NotFoundRoute = routeFragment(404)
export const ErrorRoute = routeFragment(500)

routeRedirect('/', '/r/front_page')
```
Actions are passed the route params, and should return promises (this isn't necessary, but all promises return by your actions will be resolved before the state will transition to the specified route).

Create your app:

```js
import {Link, Fragment} from 'naglfar'
import {
  SubredditRoute,
  StoryRoute
} from './routes'

export default () => (
  <div>
    <nav>
      <Link to='/r/all'>All</Link>
      <Link to='/r/games' prefetchData>Games</Link>
      <Link to='/r/cars'>Cars</Link>
    </nav>
     // You can create route-based views directly as well
     // But the router doesn't know about these until after the first render,
     // so their routes can't be relied on for data-fetching in SSR
    <Fragment forRoute={'/r/front_page'}>
      <FrontPage />
    </Fragment>
    <SubredditRoute>
      <Feed />
    </SubredditRoute>
    <StoryRoute>
      <Story />
    </StoryRoute>
  </div>
)
```

Render it

```js
import {createStore, applyMiddleware} from 'redux'
import thunk from 'redux-thunk'
import {Provider} from 'react-redux'
import createHistory from 'history/createBrowserHistory'
import router, {reducer: routeReducer} from 'naglfar'
import App from './App'
import appReducer from './store'

const composeReducers = (first, ...fns) =>
  (s, a) => fns.reduce((s, fn) => fn(s, a), first(s, a))

const configureStore = (history, initialState) =>
  createStore(
    composeReducers(appReducer, routeReducer),
    initialState,
    applyMiddleware(thunk, router(history))
  )

const store = configureStore(createHistory(), {})

export default () => {
  render(
    <Provider store={store}>
      <App />
    </Provider>
  )
}
```

Server-side render middleware (example using express)

```js
import React from 'react'
import {renderToString, renderToStaticMarkup} from 'react-dom/server'
import {Provider} from 'react-redux'
import createHistory from 'history/createMemoryHistory'
import {resolveLocation} from 'naglfar'
import Root from './Root'
import App from './App'

const renderHtml = ({store}) => {
  const body = renderToString(
    <Provider store={store}>
      <App />
    </Provider>
  )

  const rootMarkup = renderToStaticMarkup(
    <Root
      content={body}
      initialState={store.getState()}
    />
  )

  return `<!doctype html>\n${rootMarkup}`
}

const resolvePath = ({path, store}) => {
  resolveLocation(path, store.dispatch)
    .then(({status, url}) => {
      if (url) return {status, redirect: url}
      return {status, html: renderHtml({store})}
    })
}

const renderMiddleware = (req, res) => {
  const history = createHistory({
    initialEntries: [req.url]
  })
  resolvePath({path: req.url, store: configureStore(history)})
    .then(({redirect, status, html}) => {
      if (redirect) res.redirect(status, redirect)
      res.status(status).send(html)
    })
}

export default renderMiddleware

// use like: server.get('*', renderMiddleware)
```

### Useful stuff

If you need to access location data, such as query and route params, they are accessible on your redux store under the top level `location` key. Example:

```js
import {connect} from 'react-redux'
import FilterOptions from '../FilterOptions'

const mapStateToProps = ({location}) => ({
  sortOrder: location.query.sortOrder,
  page: location.params.page
})

export default connect(mapStateToProps)(FilterOptions)
```

If you want to only handle valid routes, you can extract the whitelist of all registered routes:

```js
import {whitelist} from 'naglfar'

const rejectInvalidRoutesMiddleware = (req, res, next) =>
  whitelist.includes(req.path) ? next() : res.status(404).send()
```
