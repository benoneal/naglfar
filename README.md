
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

Done. 
