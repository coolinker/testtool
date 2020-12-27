// tslint:disable: no-unsafe-any

export const testToolEnhancer = (createStore: any) => (
    reducer: any,
    initialState: any,
    enhancer: any
  ) => {
    const monitoredReducer = (state: any, action: any) => {
      const newState = reducer(state, action);
      window.postMessage({
        source: "ftt_page",
        type: "ACTION",
        message: {
            action,
            state: newState,
        },
        time: Date.now(),
      }, "*");

      return newState;
    };

    const store = createStore(monitoredReducer, initialState, enhancer);

    return store;
  };
