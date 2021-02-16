

const { run } = require("../nodejs/caserunner");
const { hasAdditionalKeys } = require("../nodejs/utils");

const myArgs = process.argv.slice(2);

const requestDeltaToIgnore = {
  message: {
    headers: { "x-correlationid": ""},
    postData: { startDate: "", submitDate: "" }
  },
  time: 0,
  hash: "",
};

const reduxDeltaToIgnore = {
  action: {
    payload: {
      rowCount: 0,
      $width: 0,
      $responseId: 0,
  }
  },
  delta: {
    $submission: {
      $startDate: "",
      $responseId: 0,
    },
    $env: { $width: 0 },
    $poll: { $startDate: ""},
    $boot: { $bootCompleteTime: ""}
  }
};

(async () => {
  await run({
    caseName: myArgs[0] || "Case1",
    assert: (desc, v0, v1) => {
    },
    domMutationMatcher: (delta, target, { time, message: {domMutation}}) => {
      return false;
    },
    requestMatcher: (delta, target, source) => {
      return !hasAdditionalKeys(delta, requestDeltaToIgnore);
    },
    reduxActionMatcher: (actionDelta) => {
      const { action: { type = {} } = { type: [], payload: {}} } = actionDelta;
      
      if (type[0]?.indexOf("@@redux/INIT") === 0 && type[1]?.indexOf("@@redux/INIT") === 0) {
        return true;
      }

      return !hasAdditionalKeys(actionDelta, reduxDeltaToIgnore)
    }
  });
})();
