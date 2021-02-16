// tslint:disable
let store: any = null;
//(window as any).__FTT_PLAY_STARTED__ = false;
export const testToolEnhancer = (next: any) => (
    reducer: any,
    initialState: any,
    enhancer: any
  ) => {
    const monitoredReducer = (state: any, action: any) => {
      // if (action.type === "RESET_PLAY") {
      //   (window as any).__FTT_PLAY_STARTED__ = true;

      //   return reducer(undefined, { type: "RESET_PLAY" });
      // }
      // console.log("__FTT_PLAY_STARTED__", (window as any).__FTT_PLAY_STARTED__, action);
      // if ((window as any).__FTT_PLAY_STARTED__) {
      //   console.log("__FTT_PLAY_STARTED__", action);
      //   return state;
      // }
      const newState = reducer(state, action);
      const time = Date.now() ;
      const newAction = {
        ...action,
        payload: (action as any).payload instanceof MouseEvent ? undefined : (action as any).payload,
      };
      window.postMessage({
        source: "ftt_page",
        type: "REDUX_ACTION",
        message: {
            action: newAction,
            state: newState,
        },
        time,
      }, "*");

      return newState;
    };

    store = next(monitoredReducer, initialState, enhancer);

    return store;
  };

window.addEventListener("message", (event: any) => {
  if (event.source !== window || !event.data) {

    return;
  }
  const message = event.data;
  if (message.source === "ftt_page") {

    return;
  }

  if (message.type === "FTT_REDUX_ACTION_PLAY") {
    const action = message.action;
    store.dispatch(action);
    
    //console.log("FTT_REDUX_ACTION_PLAY action", action);
    return;
  }

  console.log("FTT Action triggered!", message.source, message.type);
});

  