
# Naglfar

A router that keeps all state in redux. It treats the url like a form input: it fires actions on change which update the location in your state. This is accessible from any connected component: no need for a separate `RouteProvider` or other such nonsense. 

It doesn't need to own/wrap your application. It provides a `Fragment` pattern to partition your UI based on current route, including route status codes.

It works both in the browser and on the server, and offers: 

- Status codes
- Data fetching (via dispatching actions)
- Not-found routes (and any status-code based route)
- Redirects
- Prefetching data (pre-firing actions) for Links 

Depends on the `history` module.  

## How to use

Install via `npm i -S naglfar` or `yarn add naglfar`.

Create your routes. Example: 

```js
// routes.js
import {routeFragment, routeRedirect} from 'naglfar'
import {
  getFrontPageFeed,
  getSubredditFeed,
  getStory
} from './actions'

export const SubredditRoute = routeFragment('/r/:subreddit', getSubredditFeed)
export const StoryRoute = routeFragment('/r/:subreddit/:story', getStory)
export const NotFoundRoute = routeFragment(404)
export const ErrorRoute = routeFragment(500)

routeRedirect('/', '/r/front_page')
```
Actions are passed the route params, and should return promises (this isn't necessary, but all promises return by your actions will be resolved before the state will transition to the specified route).

Create your app: 

```js
import {Link} from 'naglfar'
import {
  FrontPageRoute,
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
import router from 'naglfar'
import App from './App'
import reducer from './store'

const createStoreWithMiddleware = applyMiddleware(thunk, router(createHistory()))(createStore)

const store = createStoreWithMiddleware(reducer)

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

const renderHtml = ({bundle, store}) => {
  const body = renderToString(
    <Provider store={store}>
      <App />
    </Provider>
  )

  const rootMarkup = renderToStaticMarkup(
    <Root 
      content={body}
      initialState={store.getState()}
      bundle={bundle}
    />
  )

  return `<!doctype html>\n${rootMarkup}`
}

const resolveRoute = ({path, res, bundle, store}) => {
  resolveLocation(path, config.store.dispatch)
    .then(({status, url}) => {
      if (url) return res.redirect(status, url)
      res.status(status).send(renderHtml({bundle, store}))
    })
}

const renderMiddleware = (bundle) => (req, res) => {
  const history = createHistory({
    initialEntries: [req.url]
  })
  resolveRoute({path: req.url, res, bundle, store: configureStore(history)})
}

export default renderMiddleware

// use like:
// server.get('*', renderMiddleware(webpackConfig.output.filename))
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
