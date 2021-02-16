
const configs = {
    caseName: "Case0",
    online: true,
    assert: (desc, a0, a1) => {},
    requestMatcher: (delta, target, source) => false,
    // matchRequestAndResponse: (reqUrl, respUrl) => false,
    domMutationMatcher: (delta, target, source) => false,
    reduxActionMatcher: (delta, target, source) => false,
    
    noiseUrlRegex: [/^https?:\/\/([a-zA-Z\d-]+\.){0,}com\/c\.gif/,
      /^https?:\/\/([a-zA-Z\d-]+\.){0,}net\/forms\/images\/favicon\.ico/,
      /^https?:\/\/browser\.pipe\.aria\.microsoft\.com/,
      /^https?:\/\/web\.vortex\.data\.microsoft\.com/,
    ],

    ignoreHeaders: ["user-agent", "x-usersessionid", "__requestverificationtoken"],
  }

  module.exports = configs;