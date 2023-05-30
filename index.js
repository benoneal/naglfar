Object.defineProperty(exports, '__esModule', { value: true });

var React = require('react');
var reactRedux = require('react-redux');
var routePattern = require('route-parser');
var qs = require('query-string');

function objectWithoutProperties (obj, exclude) { var target = {}; for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && exclude.indexOf(k) === -1) target[k] = obj[k]; return target; }

var keys = Object.keys;
var values = Object.values;
var redirect = {};
var routes = {};

var isString = function (s) { return typeof s === 'string'; };

var whitelist = function () { return [...keys(redirect), ...keys(routes)]; };

var qs_options = {arrayFormat: 'comma', parseNumbers: true, parseBooleans: true};

var trimTrailingSlash = function (path) {
  if ( path === void 0 ) path = '';

  if (path !== '/' && path.slice(-1) === '/') { return path.slice(0, -1) }
  return path
};

var registerRedirect = function (fromPath, toPath) { return redirect[fromPath] = toPath; };

var registerRoute = function (route, action) {
  if ( action === void 0 ) action = 'MATCHED_ROUTE_WITH_NO_ACTIONS';

  if (routes[route]) { return }
  routes[route] = {
    pattern: new routePattern(route),
    actions: Array.isArray(action) ? action : [action]
  };
};

var findMatches = function (path) { return (
  values(routes).reduce(function (acc, ref) {
    var pattern = ref.pattern;
    var actions = ref.actions;

    var params = pattern.match(path);
    return params ? acc.concat(actions.map(function (action) { return ({params: params, action: action}); })) : acc
  }, [])
); };

var matchRoute = function (route, path) { return routes[route] && routes[route].pattern.match(path); };

var resolveLocation = function (path, dispatch) { return new Promise(function (resolve) {
  var ref = matchStatus(path);
  var status = ref.status;
  var matches = ref.matches;
  var url = ref.url;
  if (status !== 200) { return resolve({status: status, url: url}) }

  Promise.all(matches
    .map(function (ref) {
      var params = ref.params;
      var action = ref.action;

      if (typeof action === 'function') { return dispatch(action(params)) }
      if (typeof action === 'object' && action.type) { return dispatch(Object.assign({}, action, {params: params})) }
      if (typeof action === 'string') { return dispatch({type: action, payload: params}) }
    })
    .filter(function (action) { return action instanceof Promise; })
  ).then(
    function (_) { return resolve({status: status}); },
    function (_) { return resolve({status: 500}); }
  );
}); };

var matchStatus = function (path) {
  path = trimTrailingSlash(path);
  var url = redirect[path];
  var matches = findMatches(path);
  var status = url ? 302 : !matches.length ? 404 : 200;
  return {status: status, matches: matches, url: url}
};

var buildLocationState = function (location, ref) {
  if ( ref === void 0 ) ref = {};
  var rest = objectWithoutProperties( ref, ["entering"] );
  var locationState = rest;

  var ref$1 = matchStatus(location.pathname + location.search);
  var status = ref$1.status;
  var matches = ref$1.matches;
  return Object.assign({}, locationState,
    location,
    {status: location.status || status,
    params: matches.reduce(function (acc, ref) {
      var params = ref.params;

      return (Object.assign({}, acc, params));
  }, {}),
    query: qs.parse(location.search.split('?')[1] || '', qs_options)})
};

var push;
var replace;
var createNav = function (navMethod, dispatch) { return function (path) {
  dispatch(enteringRoute(path));
  navMethod(path);
}; };
var initialisedRoute = function () { return ({type: 'INITIALISED_ROUTER'}); };
var enteredRoute = function (payload) { return ({type: 'ENTERED_ROUTE', payload: payload}); };
var enteringRoute = function (payload) { return ({type: 'ENTERING_ROUTE', payload: payload}); };
var prefetch = function (path, state) { return resolveLocation(path, function (a) { return a(function (b) { return b; }, function () { return state; }); }); };
var locationChange = function (dispatch) { return function (action) {
  var location = action.location || action;
  return resolveLocation(location.pathname + location.search, dispatch)
    .then(function (ref) {
      var status = ref.status;
      var url = ref.url;

      if (url) { return replace(url) }
      return dispatch(enteredRoute(Object.assign({}, location, {status: status, url: url})))
    })
}; };

var navigateTo = function (path) { return push(path); };

var reducer = function (state, ref) {
  if ( state === void 0 ) state = {};
  var type = ref.type;
  var payload = ref.payload;

  if (type === 'INITIALISED_ROUTER') { return Object.assign({}, state, {location: Object.assign({}, state.location, {initialised: true})}) }
  if (type === 'ENTERED_ROUTE') { return Object.assign({}, state, {location: buildLocationState(payload, state.location)}) }
  if (type === 'ENTERING_ROUTE') { return Object.assign({}, state, {location: Object.assign({}, state.location, {entering: payload})}) }
  return state
};

function index (history, uses_ssr) {
  if ( uses_ssr === void 0 ) uses_ssr = false;

  return function (store) {
  var originalPush = history.push.bind(history);
  var originalReplace = history.replace.bind(history);
  history.push = createNav(originalPush, store.dispatch);
  history.replace = createNav(originalReplace, store.dispatch);
  push = history.push;
  replace = history.replace;
  history.listen(locationChange(store.dispatch));

  var initialised = uses_ssr;
  var initialise = function (_) {
    initialised = true;
    resolveLocation(history.location.pathname + history.location.search, store.dispatch)
      .then(function () { return store.dispatch(initialisedRoute()); });
  };

  return function (next) { return function (action) {
    next(action);
    if (!initialised) { initialise(); }
  }; }
};
}

var selectStatus = function (ref) {
  var location = ref.location;

  return location.status;
};
var selectPath = function (ref) {
    var location = ref.location;

    return location.initialised ? (location.pathname + location.search) : '';
};

var Fragment = function (ref) {
  var forRoute = ref.forRoute;
  var beforeEnter = ref.beforeEnter;
  var Element = ref.Element; if ( Element === void 0 ) Element = React.Fragment;
  var condition = ref.condition; if ( condition === void 0 ) condition = function () { return true; };
  var children = ref.children;

  var status = reactRedux.useSelector(selectStatus);
  var path = reactRedux.useSelector(selectPath);
  var canRender = reactRedux.useSelector(condition);
  isString(forRoute) && registerRoute(forRoute, beforeEnter);
  var renderChildren = canRender && Boolean(forRoute === status || (status === 200 && matchRoute(forRoute, path)));
  return renderChildren && React.createElement( Element, { key: forRoute }, children)
};

var routeFragment = function (route, actions, Element, condition) {
  isString(route) && registerRoute(route, actions);

  return function (ref) {
    var children = ref.children;

    return (
    React.createElement( Fragment, { forRoute: route, beforeEnter: actions, Element: Element, condition: condition },
      children
    )
  );
  }
};

var isNotLeftClick = function (e) { return !!e.button; };
var hasModifier = function (e) { return Boolean(e.shiftKey || e.altKey || e.metaKey || e.ctrlKey); };
var shouldIgnoreClick = function (e, target) { return (
  hasModifier(e) ||
  isNotLeftClick(e) ||
  e.defaultPrevented ||
  target
); };

var selectQuery = function (ref) {
  var location = ref.location;

  return location.search;
};
var selectCurrentPath = function (ref) {
    var location = ref.location;

    return location.initialised ? location.pathname : '';
};

var Link = React.forwardRef(function (ref$1, ref) {
  var to = ref$1.to;
  var target = ref$1.target;
  var prefetchData = ref$1.prefetchData; if ( prefetchData === void 0 ) prefetchData = false;
  var persistQuery = ref$1.persistQuery; if ( persistQuery === void 0 ) persistQuery = true;
  var replaceLocation = ref$1.replaceLocation; if ( replaceLocation === void 0 ) replaceLocation = false;
  var className = ref$1.className; if ( className === void 0 ) className = '';
  var activeClassName = ref$1.activeClassName; if ( activeClassName === void 0 ) activeClassName = '';
  var onClick = ref$1.onClick; if ( onClick === void 0 ) onClick = function () {};
  var children = ref$1.children;
  var rest$1 = objectWithoutProperties( ref$1, ["to", "target", "prefetchData", "persistQuery", "replaceLocation", "className", "activeClassName", "onClick", "children"] );
  var rest = rest$1;

  var query = reactRedux.useSelector(selectQuery);
  var currentPath = reactRedux.useSelector(selectCurrentPath);
  var state = reactRedux.useSelector(function (s) { return s; });
  var linkTo = "" + to + (persistQuery ? query : '');
  React.useEffect(function () {if (prefetchData) { prefetch(linkTo, state); }}, []);
  var classes = [className, to === currentPath && activeClassName].filter(Boolean).join(' ');
  return (
    React.createElement( 'a', Object.assign({},
      { ref: ref }, rest, { className: classes, href: to, target: target, onClick: function (e) {
        onClick(e);
        if (shouldIgnoreClick(e, target)) { return }
        e.preventDefault();
        replaceLocation ? replace(linkTo) : push(linkTo);
      } }),
      children
    )
  )
});

exports.Fragment = Fragment;
exports.Link = Link;
exports.buildLocationState = buildLocationState;
exports.default = index;
exports.navigateTo = navigateTo;
exports.reducer = reducer;
exports.registerRedirect = registerRedirect;
exports.registerRoute = registerRoute;
exports.resolveLocation = resolveLocation;
exports.routeFragment = routeFragment;
exports.whitelist = whitelist;
