

const { run } = require("../nodejs/caserunner");


function getType(obj) {
  return Object.prototype.toString.call(obj).match(/\[\w+ (\w+)\]/)[1].toLowerCase();
}

function hasAdditionalKeys(deltaObj, keyTemplate) {
  const obj = deltaObj.length ? deltaObj[0] : deltaObj;
  if (getType(obj) !== "object" || getType(keyTemplate) !== "object") {
    return false;
  }
  const keys =  Object.keys(obj);
  const templateKeys = Object.keys(keyTemplate);
  const additinal = keys.filter(k => templateKeys.indexOf(k) < 0);
  
  if (additinal.length > 0) return true;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (hasAdditionalKeys(obj[k], keyTemplate[k])) {
      return true;
    }
  }

  return false;
}

(async () => {
  await run({
    caseName: "Case1",
    assert: (desc, v0, v1) => {
        //expect(v0).toBe(v1); // This works.
    },
    requestFilter: (url) => {
      return !(url.indexOf("https://c.office.com/c.gif") >= 0 
        || url.indexOf("https://c.bing.com/c.gif") >= 0);
    },
    matchRequest: (req0, req1) => {
      const url0 = req0.url;
      const url1 = req1.url;
      const vortex = "https://web.vortex.data.microsoft.com";
      const aria = "https://browser.pipe.aria.microsoft.com/";
      return url0.indexOf(vortex) === 0 && url1.indexOf(vortex) === 0
        || url0.indexOf(aria) === 0 && url1.indexOf(aria) === 0;
    },
    reduxActionDeltaFilter: (actionDelta) => {
      
      const { action: { type = {} } = { type: [], payload: {}} } = actionDelta;
      
      if (type[0]?.indexOf("@@redux/INIT") === 0 && type[1]?.indexOf("@@redux/INIT") === 0) {
        return true;
      }

      return !hasAdditionalKeys(actionDelta, {
        action: {
          payload: {"$width": 0}
        },
        delta: {
          "$submission": { "$startDate": ""},
          "$env": { '$width': 0 },
          "$poll": { "$startDate": ""},
          "$boot": { "$bootCompleteTime": ""}
        }
      })
      //const value = 0.1 + 0.2;
      //expect(value).toBeCloseTo(0.3); // This works.
    }
  });
})();
