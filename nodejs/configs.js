const isNoise = (msg) => {
  switch(msg.type) {
    case "DOM_MUTATION":
      const dm = msg.message;
      if (dm.domMutation.length === 1
          && dm.domMutation[0].target === "/html[1]/head[1]"
          && dm.domMutation[0].addedNodes.length === 1) {
            const v = Object.values(dm.domMutation[0].addedNodes[0])[0];
            return /src="https\:\/\/web\.vortex\.data\.microsoft\.com/.test(v);
      }
      break;
    default: ;
  }
  return false;
}
const configs = {
    caseName: "Case0",
    online: false,
    assert: (desc, a0, a1) => {},
    isNoise,
    requestMatcher: (delta, target, source) => false,
    // matchRequestAndResponse: (reqUrl, respUrl) => false,
    domMutationMatcher: (delta, target, source) => false,
    reduxActionMatcher: (delta, target, source) => false,
    
    noiseUrlRegex: [/^https?:\/\/([a-zA-Z\d-]+\.){0,}com\/c\.gif/,
      /^https?:\/\/([a-zA-Z\d-]+\.){0,}net\/forms\/images\/favicon\.ico/,
      /^https?:\/\/browser\.pipe\.aria\.microsoft\.com/,
      /^https?:\/\/web\.vortex\.data\.microsoft\.com/,
    ],

    ignoreHeaders: ["referer", "user-agent", "x-usersessionid", "__requestverificationtoken", "x-correlationid"],
  }

  module.exports = configs;